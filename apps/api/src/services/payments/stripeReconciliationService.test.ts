import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { reconcileSucceededSessionPaymentIntent } from "./stripeReconciliationService.js";

function createSelectChain(responses: unknown[][]) {
  const chain = {
    from() {
      return chain;
    },
    innerJoin() {
      return chain;
    },
    leftJoin() {
      return chain;
    },
    where() {
      return chain;
    },
    orderBy() {
      return chain;
    },
    limit() {
      return Promise.resolve(responses.shift() ?? []);
    },
  };
  return chain;
}

function createUpdateChain(updates: unknown[]) {
  return {
    set(value: unknown) {
      updates.push(value);
      return {
        where() {
          return Promise.resolve();
        },
      };
    },
  };
}

test("reconcileSucceededSessionPaymentIntent marks a metadata-linked session paid", async () => {
  const bookingId = "8258c09b-6d88-4f26-addd-cee3be7d1115";
  const paymentId = "payment-1";
  const lookupPayment = {
    id: paymentId,
    entityType: "session",
    entityId: bookingId,
    bookingId,
    status: "pending",
    metadata: {
      source: "session_checkout_create",
      stripeCheckoutSessionId: "cs_live_test",
    },
  };
  const paymentRow = {
    id: paymentId,
    userId: "user-1",
    userEmail: "client@example.com",
    userRole: "member",
    entityType: "session",
    entityId: bookingId,
    bookingId,
    bookingStartTimeUtc: null,
    bookingStatus: "pending_payment",
    bookingTypeId: "wisdom-mentoring-90",
    bookingTypeName: "Mentoring Session",
    amountCents: 29900,
    currency: "cad",
    status: "pending",
    provider: "stripe",
    providerPaymentIntentId: null,
    providerCustomerId: null,
    metadata: lookupPayment.metadata,
    createdAt: new Date("2026-06-20T15:53:48.000Z"),
    updatedAt: new Date("2026-06-20T15:53:48.000Z"),
  };
  const refreshedPaymentRow = {
    ...paymentRow,
    status: "paid",
    providerPaymentIntentId: "pi_123",
    providerCustomerId: "cus_123",
    updatedAt: new Date("2026-06-20T15:54:09.000Z"),
  };
  const updates: unknown[] = [];
  const selectResponses = [
    [],
    [lookupPayment],
    [paymentRow],
    [refreshedPaymentRow],
  ];
  const db = {
    select() {
      return createSelectChain(selectResponses);
    },
    update() {
      return createUpdateChain(updates);
    },
  };

  const result = await reconcileSucceededSessionPaymentIntent(db as never, {
    id: "pi_123",
    customer: "cus_123",
    metadata: {
      type: "session",
      entityType: "session",
      entityId: bookingId,
      bookingId,
      userId: "user-1",
    },
  } as unknown as Stripe.PaymentIntent);

  assert.equal(result.outcome, "paid");
  assert.equal(result.paymentId, paymentId);
  assert.equal(result.bookingId, bookingId);
  assert.equal(updates.length, 2);
  assert.equal((updates[0] as { status: string }).status, "paid");
  assert.equal((updates[0] as { provider_payment_intent_id: string }).provider_payment_intent_id, "pi_123");
  assert.equal((updates[1] as { status: string }).status, "paid");
});
