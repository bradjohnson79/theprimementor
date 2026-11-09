import test from "node:test";
import assert from "node:assert/strict";
import { EXPRESS_TRANSCRIPTION_CENTS, expressAmountCents, getActiveSessionOfferingByBookingTypeId, validateExpressCheckout } from "@wisdom/utils";
import { EXPRESS_ADMIN_EMAIL } from "./expressEmail.js";
import {
  claimNotification,
  confirmPaidExpressOrder,
  planExpressReminderEmails,
  prepareExpressDelivery,
  recordDeliveryAttempt,
  reviewExpressDeadlines,
  type ExpressOrderRecord,
  type NotificationRow,
} from "./expressFulfillment.js";
import { createMemoryRecordingStore } from "./privateRecordingStore.js";

const paidAt = new Date("2026-03-06T20:00:00.000Z");

function checkoutBase() {
  return {
    serviceId: "ask" as const,
    name: "Ada Client",
    email: "client@example.com",
    birthdate: "1990-04-02",
    transcription: false,
    guide: "brad" as const,
    question: "What is the next step?",
    focusAreas: [] as string[],
    healingContext: "",
    pastLifeInterest: "",
  };
}

test("Express prices stay separate from the existing email and past-life products", () => {
  assert.equal(expressAmountCents("ask", false), 1900);
  assert.equal(expressAmountCents("healing", false), 3900);
  assert.equal(expressAmountCents("past-life", false), 4900);
  assert.equal(expressAmountCents("ask", true), 2800);
  assert.equal(expressAmountCents("healing", true), 4800);
  assert.equal(expressAmountCents("past-life", true), 5800);
  assert.equal(expressAmountCents("ask", true) - expressAmountCents("ask", false), EXPRESS_TRANSCRIPTION_CENTS);
  assert.equal(getActiveSessionOfferingByBookingTypeId("email-session")?.amountCents, 5900);
  assert.equal(getActiveSessionOfferingByBookingTypeId("past-life-akashic-reading")?.amountCents, 7900);
});

test("Express checkout requires an email and does not ask for a phone or SMS choice", () => {
  const missing = validateExpressCheckout({ ...checkoutBase(), email: "" });
  assert.equal(missing.ok, false);
  const ready = validateExpressCheckout(checkoutBase());
  assert.equal(ready.ok, true);
  if (ready.ok) assert.equal(ready.amountCents, 1900);
  assert.equal("mobile" in checkoutBase(), false);
});

test("payment confirmation emails the customer and admin once", async () => {
  const orders: ExpressOrderRecord[] = [];
  const notices: NotificationRow[] = [];
  let sawSensitive = false;
  const first = await confirmPaidExpressOrder({
    id: "order-1",
    serviceId: "ask",
    customerName: "Ada Client",
    transcription: true,
    paidAt,
    customerEmail: "client@example.com",
    adminEmail: EXPRESS_ADMIN_EMAIL,
    orders,
    notices,
    model: async (_kind, fields) => {
      sawSensitive = "birthdate" in fields || "question" in fields;
      assert.equal(orders.length, 1);
      throw new Error("use the template");
    },
  });
  assert.equal(sawSensitive, false);
  assert.equal(first.order.amountCents, 2800);
  assert.equal(first.order.deliveryDate, "2026-03-09");
  assert.equal(notices.length, 2);
  assert.equal(notices.every((notice) => notice.channel === "email"), true);
  const customer = notices.find((notice) => notice.eventType === "express_customer_confirmation");
  const admin = notices.find((notice) => notice.eventType === "express_admin_purchase");
  assert.equal(customer?.subject, "Your Prime Mentor Express Order Is Confirmed");
  assert.match(customer?.body ?? "", /personalized MP3 will arrive by email/);
  assert.match(customer?.body ?? "", /2026-03-09/);
  assert.equal(admin?.recipient, EXPRESS_ADMIN_EMAIL);
  assert.equal(admin?.subject, "New Prime Mentor Express Order — Ask Brad / Adronis");
  assert.match(admin?.body ?? "", /Transcription requested: Yes/);
  assert.match(admin?.body ?? "", /order-1/);
  assert.doesNotMatch(admin?.body ?? "", /1990-04-02|next step/);

  const second = await confirmPaidExpressOrder({
    id: "order-1",
    serviceId: "ask",
    customerName: "Ada Client",
    transcription: true,
    paidAt,
    customerEmail: "client@example.com",
    adminEmail: EXPRESS_ADMIN_EMAIL,
    orders,
    notices,
  });
  assert.equal(second.duplicate, true);
  assert.equal(notices.length, 2);
});

test("a failed wording model falls back to the fixed confirmation template", async () => {
  const orders: ExpressOrderRecord[] = [];
  const notices: NotificationRow[] = [];
  await confirmPaidExpressOrder({
    id: "order-2",
    serviceId: "healing",
    customerName: "Ada Client",
    transcription: false,
    paidAt,
    customerEmail: "client@example.com",
    adminEmail: EXPRESS_ADMIN_EMAIL,
    orders,
    notices,
    model: async () => {
      throw new Error("model unavailable");
    },
  });
  assert.equal(notices[0]?.source, "template");
  assert.match(notices[0]?.body ?? "", /Prime Body Healing Express/);
  assert.match(notices[0]?.body ?? "", /2026-03-09/);
  assert.match(notices[0]?.body ?? "", /personalized MP3 will arrive by email/);
});

test("failed emails are retried on the same row", () => {
  const rows: NotificationRow[] = [{
    key: "express_admin_purchase:order-1:admin@example.com",
    eventType: "express_admin_purchase",
    entityId: "order-1",
    recipient: "admin@example.com",
    channel: "email",
    status: "failed",
    attempts: 1,
    subject: "New Prime Mentor Express Order — Ask Brad / Adronis",
    body: "Express order",
    source: "template",
  }];
  const claimed = claimNotification(rows);
  assert.equal(claimed?.attempts, 2);
  assert.equal(rows.length, 1);
});

test("reminder emails follow the Vancouver deadline and skip delivered orders", async () => {
  const open: ExpressOrderRecord = {
    id: "open",
    serviceId: "ask",
    serviceName: "Ask Brad / Adronis",
    customerName: "Ada Client",
    amountCents: 1900,
    transcription: false,
    paymentStatus: "paid",
    fulfillmentStatus: "awaiting_fulfillment",
    paidAt: "2026-03-06T20:00:00.000Z",
    timezone: "America/Vancouver",
    deliveryDate: "2026-03-09",
    deadlineAt: "2026-03-10T06:59:00.000Z",
    deliveredAt: null,
    customerEmail: "client@example.com",
    mp3Key: null,
    transcriptKey: null,
  };
  const done: ExpressOrderRecord = { ...open, id: "done", fulfillmentStatus: "delivered", deliveredAt: "2026-03-09T18:00:00.000Z" };
  const notices: NotificationRow[] = [];
  const morning = await planExpressReminderEmails({
    orders: [open, done],
    now: new Date("2026-03-09T16:00:00.000Z"),
    notices,
    adminEmail: EXPRESS_ADMIN_EMAIL,
  });
  assert.equal(morning.length, 1);
  assert.equal(morning[0]?.eventType, "express_admin_reminder_morning");
  await planExpressReminderEmails({
    orders: [open, done],
    now: new Date("2026-03-09T16:30:00.000Z"),
    notices,
    adminEmail: EXPRESS_ADMIN_EMAIL,
  });
  assert.equal(notices.length, 1);
  const afternoon = await planExpressReminderEmails({
    orders: [open],
    now: new Date("2026-03-09T22:00:00.000Z"),
    notices,
    adminEmail: EXPRESS_ADMIN_EMAIL,
  });
  assert.equal(afternoon[0]?.eventType, "express_admin_reminder_afternoon");
  const overdue = await planExpressReminderEmails({
    orders: [open],
    now: new Date("2026-03-11T00:00:00.000Z"),
    notices,
    adminEmail: EXPRESS_ADMIN_EMAIL,
  });
  assert.equal(overdue[0]?.eventType, "express_admin_overdue");
  const review = reviewExpressDeadlines([done, open], new Date("2026-03-11T00:00:00.000Z"));
  assert.equal(review[0]?.action, "skipped");
  assert.equal(review[1]?.action, "flag_refund_review");
});

test("MP3 delivery emails a secure link and keeps the file if email fails", async () => {
  const orders: ExpressOrderRecord[] = [];
  const notices: NotificationRow[] = [];
  const confirmed = await confirmPaidExpressOrder({
    id: "order-3",
    serviceId: "past-life",
    customerName: "Ada Client",
    transcription: true,
    paidAt,
    customerEmail: "client@example.com",
    adminEmail: EXPRESS_ADMIN_EMAIL,
    orders,
    notices,
  });
  const store = createMemoryRecordingStore();
  const mp3 = new Uint8Array([1, 2, 3]);
  const transcript = new Uint8Array([4, 5]);
  const prepared = await prepareExpressDelivery({
    order: confirmed.order,
    store,
    mp3,
    transcript,
    notices,
  });
  const delivery = notices.find((notice) => notice.eventType === "express_customer_delivery");
  assert.equal(delivery?.subject, "Your Prime Mentor Express Session Is Ready");
  assert.match(delivery?.body ?? "", /\/api\/express\/downloads\//);
  assert.match(delivery?.body ?? "", /Transcript:/);
  assert.equal(prepared.order.fulfillmentStatus, "ready");
  recordDeliveryAttempt(prepared.order, prepared.notice, "failed", new Date("2026-03-09T18:00:00.000Z"));
  assert.equal(prepared.order.fulfillmentStatus, "ready");
  assert.equal(prepared.order.deliveredAt, null);
  assert.deepEqual(await store.get(prepared.order.mp3Key ?? ""), mp3);
  recordDeliveryAttempt(prepared.order, prepared.notice, "sent", new Date("2026-03-09T19:00:00.000Z"));
  assert.equal(prepared.order.fulfillmentStatus, "delivered");
  assert.equal(prepared.order.deliveredAt, "2026-03-09T19:00:00.000Z");
});
