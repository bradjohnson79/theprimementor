import assert from "node:assert/strict";
import test from "node:test";
import type { AdminOrder } from "./ordersService.js";
import {
  appendInvoiceTimelineEvents,
  assertOrderCanCreateInvoice,
  buildInvoiceTimelineEvents,
  resolveInvoicePriceSnapshot,
} from "./adminOrderInvoiceService.js";

function makeOrder(overrides: Partial<Pick<AdminOrder, "type" | "status" | "metadata">> = {}): Pick<AdminOrder, "type" | "status" | "metadata"> {
  return {
    type: "session",
    status: "pending_payment",
    metadata: {
      source_status: null,
      source_created_at: "2026-05-01T00:00:00.000Z",
      birth_date: null,
      birth_time: null,
      birth_location: null,
      intake: {
        birth_date: null,
        birth_time: null,
        location: null,
        phone: null,
        timezone: null,
        consent_given: null,
        submitted_questions: [],
        topics: [],
        goals: [],
        health_focus_areas: [],
        manifestation_enhancement_selected: null,
        manifestation_goals: null,
        manifestation_enhancement: null,
        other: null,
        notes: null,
      },
      availability: null,
      report_type: null,
      report_type_id: null,
      training_package: null,
      training_package_id: null,
      selected_systems: [],
      delivery_status: null,
      session_type: "Regeneration Session",
      scheduled_at: null,
      meeting_link: null,
      plan_name: null,
      billing_cycle: null,
      renewal_date: null,
      event_name: null,
      event_date: null,
      access_link: null,
      stripe_subscription_id: null,
      billing_mode: null,
      invoice_id: null,
      invoice_status: null,
      invoice_link: null,
      invoice_expires_at: null,
      invoice_paid_at: null,
      invoice_consumed_at: null,
      stripe_invoice_id: null,
      stripe_invoice_url: null,
      stripe_invoice_status: null,
      order_variant: null,
      invoice_label: null,
      subscription_state: null,
      failure_code: null,
      failure_message: null,
      failure_message_normalized: null,
      last_payment_attempt_at: null,
      payment_match_strategy: null,
      recovery_invoice_id: null,
      recovery_invoice_sent_at: null,
      recovery_invoice_hosted_url: null,
    },
    ...overrides,
  };
}

test("assertOrderCanCreateInvoice allows unpaid session orders", () => {
  assert.doesNotThrow(() => assertOrderCanCreateInvoice(makeOrder()));
});

test("assertOrderCanCreateInvoice rejects non-session orders", () => {
  assert.throws(
    () => assertOrderCanCreateInvoice(makeOrder({ type: "report" })),
    /currently only supported for session orders/i,
  );
});

test("assertOrderCanCreateInvoice rejects closed orders", () => {
  assert.throws(
    () => assertOrderCanCreateInvoice(makeOrder({ status: "completed" })),
    /already paid or closed/i,
  );
});

test("assertOrderCanCreateInvoice rejects duplicate hosted invoices", () => {
  const order = makeOrder({
    metadata: {
      ...makeOrder().metadata,
      stripe_invoice_id: "in_123",
    },
  });

  assert.throws(
    () => assertOrderCanCreateInvoice(order),
    /invoice already exists for this order/i,
  );
});

test("resolveInvoicePriceSnapshot prefers order price snapshot over live booking type pricing", () => {
  const result = resolveInvoicePriceSnapshot({
    orderMetadata: {
      price_snapshot_cents: 12345,
      price_snapshot_currency: "CAD",
    },
    bookingIntakeSnapshot: {
      price_snapshot_cents: 99999,
      price_snapshot_currency: "USD",
    },
    fallbackAmountCents: 25000,
    fallbackCurrency: "CAD",
  });

  assert.deepEqual(result, {
    amountCents: 12345,
    currency: "CAD",
    source: "snapshot",
  });
});

test("resolveInvoicePriceSnapshot uses booking snapshot before live booking type pricing", () => {
  const result = resolveInvoicePriceSnapshot({
    bookingIntakeSnapshot: {
      priceSnapshotCents: 18000,
      priceSnapshotCurrency: "CAD",
    },
    fallbackAmountCents: 25000,
    fallbackCurrency: "CAD",
  });

  assert.deepEqual(result, {
    amountCents: 18000,
    currency: "CAD",
    source: "snapshot",
  });
});

test("resolveInvoicePriceSnapshot falls back to booking type pricing without a snapshot", () => {
  const result = resolveInvoicePriceSnapshot({
    fallbackAmountCents: 25000,
    fallbackCurrency: "CAD",
  });

  assert.deepEqual(result, {
    amountCents: 25000,
    currency: "CAD",
    source: "booking_type_fallback",
  });
});

test("invoice timeline metadata records admin-created and emailed events", () => {
  const events = buildInvoiceTimelineEvents({
    timestamp: "2026-05-06T15:00:00.000Z",
    stripeInvoiceId: "in_123",
    stripeInvoiceStatus: "open",
    actorLabel: "admin@example.com",
    adminUserId: "user_123",
  });
  const metadata = appendInvoiceTimelineEvents({
    invoice_origin: "admin_manual_recovery",
  }, events) as Record<string, unknown>;

  assert.equal(metadata.invoice_origin, "admin_manual_recovery");
  assert.deepEqual(
    (metadata.invoice_timeline as Array<{ type: string; invoice_origin: string; stripe_invoice_id: string }>).map((entry) => ({
      type: entry.type,
      invoice_origin: entry.invoice_origin,
      stripe_invoice_id: entry.stripe_invoice_id,
    })),
    [
      {
        type: "invoice_created",
        invoice_origin: "admin_manual_recovery",
        stripe_invoice_id: "in_123",
      },
      {
        type: "invoice_emailed_to_customer",
        invoice_origin: "admin_manual_recovery",
        stripe_invoice_id: "in_123",
      },
    ],
  );
});
