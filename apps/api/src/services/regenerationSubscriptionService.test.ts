import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { REGENERATION_MANIFESTATION_ENHANCEMENT_PRICE_ID } from "../config/regenerationBilling.js";
import {
  buildRegenerationCheckoutLineItems,
  handleRegenerationPaymentIntentSucceeded,
  processRegenerationInvoiceFailed,
  processRegenerationInvoicePaid,
} from "./regenerationSubscriptionService.js";

test("buildRegenerationCheckoutLineItems keeps checkout to base subscription without add-on", () => {
  assert.deepEqual(buildRegenerationCheckoutLineItems("price_base_monthly", false), [
    { price: "price_base_monthly", quantity: 1 },
  ]);
});

test("buildRegenerationCheckoutLineItems adds manifestation enhancement as initial checkout add-on", () => {
  assert.deepEqual(buildRegenerationCheckoutLineItems("price_base_monthly", true), [
    { price: "price_base_monthly", quantity: 1 },
    { price: REGENERATION_MANIFESTATION_ENHANCEMENT_PRICE_ID, quantity: 1 },
  ]);
});

const projectionRow = {
  id: "regen-sub-1",
  userId: "user-1",
  stripeCustomerId: "cus_123",
  stripeSubscriptionId: "sub_123",
  stripePriceId: "price_regen",
  stripeCheckoutSessionId: "cs_123",
  status: "active",
  accessState: "active",
  currentPeriodStart: new Date("2026-06-03T07:02:48.000Z"),
  currentPeriodEnd: new Date("2026-07-03T07:02:48.000Z"),
  cancelAtPeriodEnd: false,
  canceledAt: null,
  endedAt: null,
  prioritySupport: true,
  isAdminOverride: false,
  overrideExpiresAt: null,
  lastPaymentFailedAt: null,
  lastCheckoutStartedAt: new Date("2026-05-03T07:00:05.000Z"),
  lastReconciledAt: new Date("2026-06-03T08:04:43.000Z"),
  metadata: {
    productKey: "regeneration_monthly_package",
    planName: "Regeneration Monthly Package",
  },
  createdAt: new Date("2026-05-03T07:00:05.000Z"),
  updatedAt: new Date("2026-06-03T08:04:43.000Z"),
};

function makeSubscription(): Stripe.Subscription {
  return {
    id: "sub_123",
    customer: "cus_123",
    status: "active",
    cancel_at_period_end: false,
    canceled_at: null,
    metadata: {
      type: "regeneration_subscription",
      productKey: "regeneration_monthly_package",
      userId: "user-1",
    },
    items: {
      data: [{
        current_period_start: 1780470168,
        current_period_end: 1783062168,
        price: { id: "price_regen" },
      }],
    },
  } as unknown as Stripe.Subscription;
}

function makeInvoice(overrides: Partial<Stripe.Invoice> = {}): Stripe.Invoice {
  return {
    id: "in_123",
    number: "85MMUOZY-0002",
    status: "paid",
    billing_reason: "subscription_cycle",
    amount_paid: 9900,
    amount_due: 9900,
    currency: "cad",
    hosted_invoice_url: "https://stripe.example/invoice",
    status_transitions: { paid_at: 1780473883 },
    customer: "cus_123",
    subscription: "sub_123",
    parent: {
      subscription_details: {
        subscription: "sub_123",
        metadata: {
          type: "regeneration_subscription",
          productKey: "regeneration_monthly_package",
          regenerationSubscriptionId: "regen-sub-1",
        },
      },
    },
    ...overrides,
  } as unknown as Stripe.Invoice;
}

function createMockDb(selectResponses: unknown[][]) {
  const orderInserts: unknown[] = [];
  const orderUpdates: unknown[] = [];
  const db = {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit() {
                  return Promise.resolve(selectResponses.shift() ?? []);
                },
              };
            },
          };
        },
      };
    },
    insert() {
      return {
        values(value: unknown) {
          if (value && typeof value === "object" && "payment_reference" in value) {
            orderInserts.push(value);
          }
          return {
            onConflictDoUpdate() {
              return Promise.resolve();
            },
          };
        },
      };
    },
    update() {
      return {
        set(value: unknown) {
          if (value && typeof value === "object" && "stripe_invoice_id" in value) {
            orderUpdates.push(value);
          }
          return {
            where() {
              return Promise.resolve();
            },
          };
        },
      };
    },
  };
  return { db: db as never, orderInserts, orderUpdates };
}

function createMockStripe(invoices: Stripe.Invoice[] = []) {
  return {
    subscriptions: {
      retrieve: async () => makeSubscription(),
    },
    invoices: {
      retrieve: async (invoiceId: string) => invoices.find((invoice) => invoice.id === invoiceId) ?? makeInvoice({ id: invoiceId }),
      list: async () => ({ data: invoices }),
    },
    charges: {
      retrieve: async () => ({ invoice: null }),
    },
  } as never;
}

test("processRegenerationInvoicePaid creates a completed renewal order once", async () => {
  const { db, orderInserts } = createMockDb([[projectionRow], [projectionRow], []]);
  const result = await processRegenerationInvoicePaid(db, makeInvoice(), undefined, createMockStripe());

  assert.equal(result.handled, true);
  assert.equal(result.orderAction, "created");
  assert.equal(orderInserts.length, 1);
  assert.equal((orderInserts[0] as { payment_reference: string }).payment_reference, "in_123");
  assert.equal((orderInserts[0] as { status: string }).status, "completed");
});

test("processRegenerationInvoicePaid updates existing order on duplicate invoice", async () => {
  const { db, orderInserts, orderUpdates } = createMockDb([[projectionRow], [projectionRow], [{ id: "order-1" }]]);
  const result = await processRegenerationInvoicePaid(db, makeInvoice(), undefined, createMockStripe());

  assert.equal(result.handled, true);
  assert.equal(result.orderAction, "updated");
  assert.equal(orderInserts.length, 0);
  assert.equal(orderUpdates.length, 1);
  assert.equal((orderUpdates[0] as { status: string }).status, "completed");
});

test("processRegenerationInvoiceFailed creates a failed renewal order", async () => {
  const { db, orderInserts } = createMockDb([[projectionRow], [projectionRow], [projectionRow], [projectionRow], []]);
  const result = await processRegenerationInvoiceFailed(db, makeInvoice({ status: "open", amount_paid: 0 }), undefined, createMockStripe());

  assert.equal(result.handled, true);
  assert.equal(result.orderAction, "created");
  assert.equal(orderInserts.length, 1);
  assert.equal((orderInserts[0] as { status: string }).status, "failed");
});

test("payment_intent.succeeded fallback processes only matched regeneration invoices", async () => {
  const invoice = makeInvoice();
  const { db, orderInserts } = createMockDb([[projectionRow], [projectionRow], []]);
  const handled = await handleRegenerationPaymentIntentSucceeded(
    db,
    {
      id: "pi_123",
      amount: 9900,
      currency: "cad",
      customer: "cus_123",
      created: 1780473883,
      description: "Invoice 85MMUOZY-0002",
    } as unknown as Stripe.PaymentIntent,
    undefined,
    createMockStripe([invoice]),
  );

  assert.equal(handled, true);
  assert.equal(orderInserts.length, 1);
  assert.equal((orderInserts[0] as { payment_reference: string }).payment_reference, "in_123");
});
