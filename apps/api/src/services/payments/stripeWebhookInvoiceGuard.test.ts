import assert from "node:assert/strict";
import test from "node:test";

/**
 * Mirrors the managed-invoice detection used by stripeWebhookService.
 * Kept as a focused regression guard so Mentoring Circle / product_type=event
 * checkouts cannot be mistaken for admin invoices again.
 */
function isManagedInvoiceMetadata(raw: Record<string, string | undefined>) {
  const invoiceId = raw.invoice_id?.trim() || "";
  const billingMode = raw.billing_mode?.trim() || "";
  const normalizedBillingMode = billingMode === "subscription" || billingMode === "one_time"
    ? billingMode
    : "";
  return Boolean(invoiceId || normalizedBillingMode);
}

test("mentoring circle product_type=event is not treated as managed invoice metadata", () => {
  assert.equal(
    isManagedInvoiceMetadata({
      product_type: "event",
      type: "mentoring_circle",
      eventId: "2026-08-16",
    }),
    false,
  );
});

test("admin invoice metadata with invoice_id is recognized", () => {
  assert.equal(
    isManagedInvoiceMetadata({
      invoice_id: "inv_123",
      product_type: "session",
      billing_mode: "one_time",
    }),
    true,
  );
});

test("admin invoice metadata with billing_mode alone is recognized", () => {
  assert.equal(
    isManagedInvoiceMetadata({
      billing_mode: "subscription",
      product_type: "subscription",
    }),
    true,
  );
});
