import assert from "node:assert/strict";
import test from "node:test";
import {
  mapRefundReasonForStripe,
  normalizeAdminOrderRefundInput,
} from "./orderRefundService.js";

test("normalizeAdminOrderRefundInput accepts standard reasons", () => {
  const input = normalizeAdminOrderRefundInput("fraudulent");

  assert.deepEqual(input, {
    reason: "fraudulent",
    customReason: null,
  });
});

test("normalizeAdminOrderRefundInput requires a custom note for other", () => {
  assert.throws(
    () => normalizeAdminOrderRefundInput("other", "   "),
    /Custom refund reason is required/i,
  );
});

test("mapRefundReasonForStripe leaves other as a local-only reason", () => {
  assert.equal(mapRefundReasonForStripe("requested_by_customer"), "requested_by_customer");
  assert.equal(mapRefundReasonForStripe("fraudulent"), "fraudulent");
  assert.equal(mapRefundReasonForStripe("duplicate"), "duplicate");
  assert.equal(mapRefundReasonForStripe("other"), null);
});
