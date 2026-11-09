import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryRecordingStore } from "./privateRecordingStore.js";
import {
  attachExpressRecording,
  confirmExpressPayment,
  createMemoryExpressRepository,
  dispatchPendingExpressEmails,
  loadExpressDownload,
  queueExpressDelivery,
  readExpressDownload,
  runExpressReminderPass,
  signExpressDownload,
  type ExpressPaymentInput,
} from "./expressOrderService.js";

const paidAt = new Date("2026-03-06T20:00:00.000Z");

function payment(overrides: Partial<ExpressPaymentInput> = {}): ExpressPaymentInput {
  return {
    id: "cs_test_1",
    serviceId: "past-life",
    customerName: "Ada Client",
    customerEmail: "client@example.com",
    amountCents: 4900,
    transcription: false,
    paidAt,
    intake: {
      birthdate: "1990-04-02",
      guide: "",
      question: "",
      focusAreas: [],
      healingContext: "",
      pastLifeInterest: "A coastal village",
    },
    ...overrides,
  };
}

test("a confirmed Express payment keeps intake and the promised deadline", async () => {
  const repo = createMemoryExpressRepository();
  const first = await confirmExpressPayment(repo, payment());
  assert.equal(first.duplicate, false);
  assert.equal(first.order.deliveryDate, "2026-03-09");
  assert.equal(first.order.intake.pastLifeInterest, "A coastal village");
  assert.equal(first.order.intake.birthdate, "1990-04-02");
  const second = await confirmExpressPayment(repo, payment({ paidAt: new Date("2026-03-20T20:00:00.000Z") }));
  assert.equal(second.duplicate, true);
  assert.equal(second.order.deliveryDate, "2026-03-09");
  const notices = await repo.listNotices(first.order.id);
  assert.equal(notices.length, 2);
  assert.equal(notices.every((notice) => notice.source === "template"), true);
  assert.doesNotMatch(notices.map((notice) => notice.body).join("\n"), /1990-04-02|coastal village/);
});

test("email failure keeps the paid order and a retry does not duplicate a sent notice", async () => {
  const repo = createMemoryExpressRepository();
  const saved = await confirmExpressPayment(repo, payment({ id: "cs_guest", serviceId: "ask", amountCents: 1900 }));
  const failed = await dispatchPendingExpressEmails(repo, saved.order.id, async () => ({ ok: false, error: "mailbox unavailable" }));
  assert.equal(failed.order?.paymentStatus, "paid");
  assert.equal(failed.notices.every((notice) => notice.status === "failed"), true);
  let sends = 0;
  const retried = await dispatchPendingExpressEmails(repo, saved.order.id, async () => {
    sends += 1;
    return { ok: true, messageId: `msg_${sends}` };
  });
  assert.equal(sends, 2);
  assert.equal(retried.notices.every((notice) => notice.providerMessageId?.startsWith("msg_")), true);
  const again = await dispatchPendingExpressEmails(repo, saved.order.id, async () => {
    sends += 1;
    return { ok: true, messageId: "duplicate" };
  });
  assert.equal(again.notices.length, 0);
  assert.equal(sends, 2);
});

test("delivery requires the MP3 and a purchased transcript, then serves an expiring link", async () => {
  const repo = createMemoryExpressRepository();
  const store = createMemoryRecordingStore();
  const saved = await confirmExpressPayment(repo, payment({ id: "cs_account", transcription: true, amountCents: 5800 }));
  await assert.rejects(() => queueExpressDelivery({ repo, orderId: saved.order.id }), /MP3 is required/);
  await attachExpressRecording({ repo, store, orderId: saved.order.id, mp3: new Uint8Array([9, 9]) });
  await assert.rejects(() => queueExpressDelivery({ repo, orderId: saved.order.id }), /transcript is required/);
  await attachExpressRecording({ repo, store, orderId: saved.order.id, transcript: new Uint8Array([4]) });
  const ready = await repo.get(saved.order.id);
  assert.equal(ready?.fulfillmentStatus, "ready");
  const queued = await queueExpressDelivery({ repo, orderId: saved.order.id, now: new Date("2026-03-09T18:00:00.000Z") });
  assert.match(queued.notice.body, /Your Prime Mentor Express Session Is Ready|\/api\/express\/downloads\//);
  assert.match(queued.notice.body, /Transcript:/);
  const token = queued.notice.body.match(/\/api\/express\/downloads\/(\S+)/)?.[1] ?? "";
  const file = await loadExpressDownload({ repo, store, token, now: Date.parse("2026-03-09T18:00:00.000Z") });
  assert.deepEqual(file?.bytes, new Uint8Array([9, 9]));
  assert.equal(readExpressDownload(token, Date.parse("2026-04-20T18:00:00.000Z")), null);
  const fresh = signExpressDownload(saved.order.id, "mp3", Date.parse("2026-04-21T18:00:00.000Z"));
  const renewed = await loadExpressDownload({ repo, store, token: fresh, now: Date.parse("2026-04-20T18:00:00.000Z") });
  assert.deepEqual(renewed?.bytes, new Uint8Array([9, 9]));
});

test("deadline reminders are stored once and overdue orders are flagged without moving the deadline", async () => {
  const repo = createMemoryExpressRepository();
  const saved = await confirmExpressPayment(repo, payment());
  const deadline = saved.order.deadlineAt;
  const morning = await runExpressReminderPass(repo, new Date("2026-03-09T16:00:00.000Z"));
  assert.equal(morning.queued.length, 1);
  const repeat = await runExpressReminderPass(repo, new Date("2026-03-09T17:00:00.000Z"));
  assert.equal(repeat.queued.length, 0);
  const overdue = await runExpressReminderPass(repo, new Date("2026-03-11T00:00:00.000Z"));
  assert.equal(overdue.queued.some((notice) => notice.eventType === "express_admin_overdue"), true);
  const flagged = await repo.get(saved.order.id);
  assert.equal(flagged?.refundReview, true);
  assert.equal(flagged?.deadlineAt, deadline);
  assert.equal(flagged?.paymentStatus, "paid");
  flagged!.fulfillmentStatus = "delivered";
  await repo.save(flagged!);
  const afterDelivery = await runExpressReminderPass(repo, new Date("2026-03-12T00:00:00.000Z"));
  assert.equal(afterDelivery.queued.length, 0);
});
