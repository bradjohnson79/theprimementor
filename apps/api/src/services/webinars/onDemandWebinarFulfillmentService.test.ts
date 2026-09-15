import assert from "node:assert/strict";
import test from "node:test";
import { canAcceptOnDemandPaymentStatus } from "../../config/onDemandWebinarBilling.js";

test("shared fulfillment rejects unpaid and generic zero-total sessions", () => {
  assert.equal(canAcceptOnDemandPaymentStatus({ paymentStatus: "unpaid", amountTotal: 799 }), false);
  assert.equal(canAcceptOnDemandPaymentStatus({ paymentStatus: "no_payment_required", amountTotal: 0 }), false);
  assert.equal(canAcceptOnDemandPaymentStatus({ paymentStatus: "paid", amountTotal: 799 }), true);
});

test("duplicate charges stay distinct from the unique entitlement key", () => {
  const firstSession = "cs_test_first";
  const secondSession = "cs_test_second";
  const entitlementKey = "user-1:adronis-disclosure-to-contact-on-demand";
  const payments = new Map<string, { entitlementKey: string; duplicate: boolean }>();

  function recordPayment(sessionId: string) {
    const alreadyEntitled = [...payments.values()].some((row) => row.entitlementKey === entitlementKey && !row.duplicate);
    payments.set(sessionId, { entitlementKey, duplicate: alreadyEntitled });
    return payments.get(sessionId);
  }

  const first = recordPayment(firstSession);
  const second = recordPayment(secondSession);
  assert.equal(first?.duplicate, false);
  assert.equal(second?.duplicate, true);
  assert.equal(payments.size, 2);
});
