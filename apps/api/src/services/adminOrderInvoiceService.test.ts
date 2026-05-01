import assert from "node:assert/strict";
import test from "node:test";
import type { AdminOrder } from "./ordersService.js";
import { assertOrderCanCreateInvoice } from "./adminOrderInvoiceService.js";

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
