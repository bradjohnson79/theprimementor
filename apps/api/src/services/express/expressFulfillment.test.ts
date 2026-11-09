import test from "node:test";
import assert from "node:assert/strict";
import { EXPRESS_TRANSCRIPTION_CENTS, expressAmountCents, getActiveSessionOfferingByBookingTypeId } from "@wisdom/utils";
import {
  claimNotification,
  composeExpressNotice,
  confirmPaidExpressOrder,
  reviewExpressDeadlines,
  type ExpressOrderRecord,
  type NotificationRow,
} from "./expressFulfillment.js";

const paidAt = new Date("2026-03-06T20:00:00.000Z");

test("Express prices stay separate from the existing email and past-life products", () => {
  assert.equal(expressAmountCents("ask", false), 1900);
  assert.equal(expressAmountCents("healing", false), 3900);
  assert.equal(expressAmountCents("past-life", false), 4900);
  assert.equal(expressAmountCents("ask", true), 1900 + EXPRESS_TRANSCRIPTION_CENTS);
  assert.equal(expressAmountCents("healing", true) - expressAmountCents("healing", false), 900);
  assert.equal(getActiveSessionOfferingByBookingTypeId("email-session")?.amountCents, 5900);
  assert.equal(getActiveSessionOfferingByBookingTypeId("past-life-akashic-reading")?.amountCents, 7900);
});

test("payment confirmation writes the order before wording and does not duplicate notices", async () => {
  const orders: ExpressOrderRecord[] = [];
  const notices: NotificationRow[] = [];
  let modelSawOrder = false;
  const first = await confirmPaidExpressOrder({
    id: "order-1",
    serviceId: "ask",
    transcription: true,
    paidAt,
    notify: "both",
    customerEmail: "client@example.com",
    customerMobile: "+16045550123",
    adminEmail: "admin@example.com",
    adminSms: "+16045550199",
    orders,
    notices,
    model: async (fields) => {
      modelSawOrder = orders.length === 1;
      assert.deepEqual(Object.keys(fields).sort(), ["deadlineLabel", "fulfillmentStatus", "serviceName"]);
      return "Formatted notice";
    },
  });
  assert.equal(modelSawOrder, true);
  assert.equal(first.order.amountCents, 2800);
  assert.equal(first.order.paymentStatus, "paid");
  assert.equal(first.order.fulfillmentStatus, "awaiting_fulfillment");
  assert.equal(notices.length, 4);
  assert.equal(notices[0]?.source, "model");

  const second = await confirmPaidExpressOrder({
    id: "order-1",
    serviceId: "ask",
    transcription: true,
    paidAt,
    notify: "both",
    customerEmail: "client@example.com",
    customerMobile: "+16045550123",
    adminEmail: "admin@example.com",
    adminSms: "+16045550199",
    orders,
    notices,
  });
  assert.equal(second.duplicate, true);
  assert.equal(notices.length, 4);
  assert.equal(orders.length, 1);
});

test("a failed wording model falls back to the fixed template", async () => {
  const notice = await composeExpressNotice(
    { serviceName: "Ask Brad / Adronis", deadlineLabel: "2026-03-09", fulfillmentStatus: "awaiting_fulfillment" },
    async () => {
      throw new Error("model unavailable");
    },
  );
  assert.equal(notice.source, "template");
  assert.match(notice.text, /Ask Brad \/ Adronis/);
  assert.match(notice.text, /2026-03-09/);
});

test("failed notices are retried on the same row", () => {
  const rows: NotificationRow[] = [{
    key: "express_admin_email:order-1:admin@example.com",
    eventType: "express_admin_email",
    entityId: "order-1",
    recipient: "admin@example.com",
    status: "failed",
    attempts: 1,
    body: "Express order",
    source: "template",
  }];
  const claimed = claimNotification(rows);
  assert.equal(claimed?.attempts, 2);
  assert.equal(rows.length, 1);
});

test("a missed deadline is flagged for review and a delivered order is skipped", () => {
  const delivered: ExpressOrderRecord = {
    id: "done",
    serviceId: "healing",
    serviceName: "Prime Body Healing Express",
    amountCents: 3900,
    transcription: false,
    paymentStatus: "paid",
    fulfillmentStatus: "delivered",
    paidAt: paidAt.toISOString(),
    timezone: "America/Vancouver",
    deliveryDate: "2026-03-09",
    deadlineAt: "2026-03-10T06:59:00.000Z",
    deliveredAt: "2026-03-09T18:00:00.000Z",
    notify: "email",
    customerEmail: "client@example.com",
    customerMobile: null,
  };
  const late: ExpressOrderRecord = { ...delivered, id: "late", fulfillmentStatus: "awaiting_fulfillment", deliveredAt: null };
  const review = reviewExpressDeadlines([delivered, late], new Date("2026-03-11T00:00:00.000Z"));
  assert.deepEqual(review[0], { id: "done", action: "skipped" });
  assert.equal(review[1]?.action, "flag_refund_review");
});
