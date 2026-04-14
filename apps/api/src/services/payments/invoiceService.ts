import Stripe from "stripe";
import {
  clients,
  invoices,
  orders,
  users,
  type Database,
} from "@wisdom/db";
import { desc, eq, or } from "drizzle-orm";
import { createHttpError } from "../booking/errors.js";
import { normalizePaymentFailure } from "./paymentErrorNormalizer.js";
import { ensureStripeCustomerId as ensureUsableStripeCustomerId } from "./stripeCustomerService.js";

export type InvoiceProductType = "session" | "report" | "subscription" | "webinar" | "custom";
export type InvoiceBillingMode = "one_time" | "subscription";
export type PersistedOrderStatus = "pending" | "completed" | "failed";

type DbExecutor = Pick<Database, "select" | "insert" | "update">;

type WebhookLogger = {
  info: (payload: unknown, message?: string) => void;
  warn: (payload: unknown, message?: string) => void;
  error: (payload: unknown, message?: string) => void;
};

interface InvoiceClientRow {
  clientId: string;
  userId: string;
  fullBirthName: string;
  email: string;
}

export interface InvoiceResponsePayload {
  id: string;
  client_id: string;
  user_id: string;
  stripe_payment_link: string | null;
  product_type: InvoiceProductType;
  label: string;
  amount: number;
  currency: string;
  billing_mode: InvoiceBillingMode;
  status: string;
  expires_at: string | null;
  paid_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  failure_message_normalized: string | null;
  last_payment_attempt_at: string | null;
  stripe_subscription_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
}

export interface CreateInvoicePaymentLinkInput {
  clientId: string;
  productType: InvoiceProductType;
  customLabel?: string | null;
  amount: number;
  currency?: string | null;
}

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) throw new Error("STRIPE_SECRET_KEY not set");
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveBillingMode(productType: InvoiceProductType): InvoiceBillingMode {
  return productType === "subscription" ? "subscription" : "one_time";
}

function buildInvoiceLabel(productType: InvoiceProductType, customLabel?: string | null) {
  if (productType === "custom") {
    return getString(customLabel) ?? "";
  }
  switch (productType) {
    case "session":
      return "Manual Session Invoice";
    case "report":
      return "Manual Report Invoice";
    case "subscription":
      return "Manual Subscription Invoice";
    case "webinar":
      return "Manual Webinar Invoice";
  }
}

function invoiceCorrelationId(invoiceId: string | null, fallback: string) {
  return invoiceId ?? fallback;
}

function toInvoicePayload(row: typeof invoices.$inferSelect): InvoiceResponsePayload {
  return {
    id: row.id,
    client_id: row.client_id,
    user_id: row.user_id,
    stripe_payment_link: row.stripe_payment_link ?? null,
    product_type: row.product_type as InvoiceProductType,
    label: row.label,
    amount: row.amount / 100,
    currency: row.currency,
    billing_mode: row.billing_mode as InvoiceBillingMode,
    status: row.status,
    expires_at: row.expires_at?.toISOString() ?? null,
    paid_at: row.paid_at?.toISOString() ?? null,
    failure_code: row.failure_code ?? null,
    failure_message: row.failure_message ?? null,
    failure_message_normalized: row.failure_message_normalized ?? null,
    last_payment_attempt_at: row.last_payment_attempt_at?.toISOString() ?? null,
    stripe_subscription_id: row.stripe_subscription_id ?? null,
    stripe_checkout_session_id: row.stripe_checkout_session_id ?? null,
    stripe_payment_intent_id: row.stripe_payment_intent_id ?? null,
  };
}

async function getInvoiceClient(db: DbExecutor, clientId: string): Promise<InvoiceClientRow> {
  const [client] = await db
    .select({
      clientId: clients.id,
      userId: clients.user_id,
      fullBirthName: clients.full_birth_name,
      email: users.email,
    })
    .from(clients)
    .innerJoin(users, eq(clients.user_id, users.id))
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    throw createHttpError(404, "Client not found");
  }

  return client;
}

async function ensureInvoiceStripeCustomerId(
  db: DbExecutor,
  client: InvoiceClientRow,
) {
  const stripe = getStripe();
  return ensureUsableStripeCustomerId(db, {
    stripe,
    userId: client.userId,
    email: client.email,
    name: client.fullBirthName,
    metadata: {
      userId: client.userId,
      clientId: client.clientId,
    },
  });
}

function validateInvoiceInput(input: CreateInvoicePaymentLinkInput) {
  if (!getString(input.clientId)) {
    throw createHttpError(400, "Client is required.");
  }
  if (!input.amount || Number.isNaN(input.amount) || input.amount <= 0) {
    throw createHttpError(400, "Amount must be greater than 0.");
  }
  if (!input.productType) {
    throw createHttpError(400, "Product type is required.");
  }
  if (input.productType === "custom" && !getString(input.customLabel)) {
    throw createHttpError(400, "Custom label is required.");
  }
}

function invoiceExpiryDate() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

async function createStripePaymentLinkForInvoice(input: {
  stripeCustomerId: string;
  invoiceId: string;
  client: InvoiceClientRow;
  label: string;
  amountCents: number;
  currency: string;
  productType: InvoiceProductType;
  billingMode: InvoiceBillingMode;
}) {
  const stripe = getStripe();
  const product = await stripe.products.create({
    name: input.label,
    metadata: {
      invoice_id: input.invoiceId,
      client_id: input.client.clientId,
      user_id: input.client.userId,
      stripe_customer_id: input.stripeCustomerId,
      product_type: input.productType,
      billing_mode: input.billingMode,
    },
  });

  const price = await stripe.prices.create({
    unit_amount: input.amountCents,
    currency: input.currency.toLowerCase(),
    product: product.id,
    ...(input.billingMode === "subscription"
      ? { recurring: { interval: "month" as const } }
      : {}),
    metadata: {
      invoice_id: input.invoiceId,
      client_id: input.client.clientId,
      user_id: input.client.userId,
      stripe_customer_id: input.stripeCustomerId,
      product_type: input.productType,
      billing_mode: input.billingMode,
    },
  });

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: {
      invoice_id: input.invoiceId,
      client_id: input.client.clientId,
      user_id: input.client.userId,
      stripe_customer_id: input.stripeCustomerId,
      product_type: input.productType,
      label: input.label,
      billing_mode: input.billingMode,
    },
    ...(input.billingMode === "subscription" ? { customer_creation: "always" as const } : {}),
  });

  return { product, price, paymentLink };
}

export async function createAdminInvoicePaymentLink(
  db: Database,
  input: CreateInvoicePaymentLinkInput,
  logger?: WebhookLogger,
) {
  validateInvoiceInput(input);
  const client = await getInvoiceClient(db, input.clientId);
  const label = buildInvoiceLabel(input.productType, input.customLabel);
  const billingMode = resolveBillingMode(input.productType);
  const currency = (input.currency ?? "CAD").toUpperCase();
  const amountCents = Math.round(input.amount * 100);
  const expiresAt = invoiceExpiryDate();
  const stripeCustomerId = await ensureInvoiceStripeCustomerId(db, client);

  const [createdInvoice] = await db
    .insert(invoices)
    .values({
      user_id: client.userId,
      client_id: client.clientId,
      product_type: input.productType,
      label,
      amount: amountCents,
      currency,
      billing_mode: billingMode,
      status: "pending",
      expires_at: expiresAt,
      metadata: {
        createdBy: "admin",
      },
    })
    .returning();

  const stripeResources = await createStripePaymentLinkForInvoice({
    stripeCustomerId,
    invoiceId: createdInvoice.id,
    client,
    label,
    amountCents,
    currency,
    productType: input.productType,
    billingMode,
  });

  const [updated] = await db
    .update(invoices)
    .set({
      stripe_payment_link: stripeResources.paymentLink.url,
      stripe_payment_link_id: stripeResources.paymentLink.id,
      stripe_product_id: stripeResources.product.id,
      stripe_price_id: stripeResources.price.id,
      metadata: {
        createdBy: "admin",
        stripeCustomerId,
        defaultRecurringInterval: billingMode === "subscription" ? "month" : null,
      },
      updated_at: new Date(),
    })
    .where(eq(invoices.id, createdInvoice.id))
    .returning();

  logger?.info({
    correlation_id: invoiceCorrelationId(updated.id, updated.id),
    invoiceId: updated.id,
    userId: updated.user_id,
    clientId: updated.client_id,
    billingMode,
    productType: input.productType,
    stripePaymentLinkId: updated.stripe_payment_link_id,
  }, "invoice_created");

  return toInvoicePayload(updated);
}

export async function getInvoiceById(db: DbExecutor, invoiceId: string) {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  return invoice ?? null;
}

export async function maybeExpireInvoice(db: DbExecutor, invoice: typeof invoices.$inferSelect | null) {
  if (!invoice) return null;
  if (invoice.status !== "pending") return invoice;
  if (!invoice.expires_at || invoice.expires_at.getTime() > Date.now()) return invoice;

  const [updated] = await db
    .update(invoices)
    .set({
      status: "expired",
      updated_at: new Date(),
    })
    .where(eq(invoices.id, invoice.id))
    .returning();
  return updated ?? invoice;
}

export async function regenerateAdminInvoicePaymentLink(
  db: Database,
  invoiceId: string,
  logger?: WebhookLogger,
) {
  const existingRaw = await getInvoiceById(db, invoiceId);
  const existing = await maybeExpireInvoice(db, existingRaw);
  if (!existing) {
    throw createHttpError(404, "Invoice not found");
  }
  if (existing.status === "paid" || existing.consumed_at) {
    throw createHttpError(400, "Paid invoices cannot be regenerated.");
  }

  const client = await getInvoiceClient(db, existing.client_id);
  const stripeCustomerId = await ensureInvoiceStripeCustomerId(db, client);
  const stripeResources = await createStripePaymentLinkForInvoice({
    stripeCustomerId,
    invoiceId: existing.id,
    client,
    label: existing.label,
    amountCents: existing.amount,
    currency: existing.currency,
    productType: existing.product_type as InvoiceProductType,
    billingMode: existing.billing_mode as InvoiceBillingMode,
  });

  const metadata = (existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata))
    ? existing.metadata as Record<string, unknown>
    : {};
  const retryCount = typeof metadata.retryCount === "number" ? metadata.retryCount + 1 : 1;
  const [updated] = await db
    .update(invoices)
    .set({
      stripe_payment_link: stripeResources.paymentLink.url,
      stripe_payment_link_id: stripeResources.paymentLink.id,
      stripe_product_id: stripeResources.product.id,
      stripe_price_id: stripeResources.price.id,
      status: "pending",
      expires_at: invoiceExpiryDate(),
      failure_code: null,
      failure_message: null,
      failure_message_normalized: null,
      last_payment_attempt_at: null,
      metadata: {
        ...metadata,
        retryCount,
        stripeCustomerId,
      },
      updated_at: new Date(),
    })
    .where(eq(invoices.id, existing.id))
    .returning();

  logger?.info({
    correlation_id: invoiceCorrelationId(updated.id, updated.id),
    invoiceId: updated.id,
    billingMode: updated.billing_mode,
    productType: updated.product_type,
    retryCount,
  }, "invoice_created");

  return toInvoicePayload(updated);
}

export async function resolveInvoiceByStripeReferences(
  db: DbExecutor,
  input: {
    invoiceId?: string | null;
    stripePaymentIntentId?: string | null;
    stripeCheckoutSessionId?: string | null;
    stripeSubscriptionId?: string | null;
  },
) {
  if (input.invoiceId) {
    const direct = await getInvoiceById(db, input.invoiceId);
    if (direct) return direct;
  }

  const conditions = [
    input.stripePaymentIntentId ? eq(invoices.stripe_payment_intent_id, input.stripePaymentIntentId) : null,
    input.stripeCheckoutSessionId ? eq(invoices.stripe_checkout_session_id, input.stripeCheckoutSessionId) : null,
    input.stripeSubscriptionId ? eq(invoices.stripe_subscription_id, input.stripeSubscriptionId) : null,
  ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));

  if (conditions.length === 0) {
    return null;
  }

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(or(...conditions))
    .orderBy(desc(invoices.created_at))
    .limit(1);

  return invoice ?? null;
}

export function toPersistedOrderStatus(invoiceStatus: string): PersistedOrderStatus {
  switch (invoiceStatus) {
    case "paid":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

export async function getOrderByPaymentReference(db: DbExecutor, paymentReference: string | null | undefined) {
  if (!paymentReference) return null;
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.payment_reference, paymentReference))
    .limit(1);
  return order ?? null;
}

export async function createPersistedOrderFromInvoice(
  db: DbExecutor,
  input: {
    invoice: typeof invoices.$inferSelect;
    paymentReference: string;
    stripePaymentIntentId?: string | null;
    stripeSubscriptionId?: string | null;
    orderType?: typeof orders.$inferInsert["type"];
    status: PersistedOrderStatus;
    failureCode?: string | null;
    failureMessage?: string | null;
    failureMessageNormalized?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  const existing = await getOrderByPaymentReference(db, input.paymentReference);
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(orders)
    .values({
      user_id: input.invoice.user_id,
      client_id: input.invoice.client_id,
      invoice_id: input.invoice.billing_mode === "one_time" ? input.invoice.id : null,
      subscription_id: input.invoice.billing_mode === "subscription"
        ? (input.invoice.stripe_subscription_id ?? input.stripeSubscriptionId ?? null)
        : null,
      type: input.orderType ?? input.invoice.product_type,
      label: input.invoice.label,
      amount: input.invoice.amount,
      currency: input.invoice.currency,
      status: input.status,
      payment_reference: input.paymentReference,
      stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
      stripe_subscription_id: input.stripeSubscriptionId ?? input.invoice.stripe_subscription_id ?? null,
      failure_code: input.failureCode ?? null,
      failure_message: input.failureMessage ?? null,
      failure_message_normalized: input.failureMessageNormalized ?? null,
      metadata: input.metadata ?? null,
    })
    .onConflictDoNothing({ target: orders.payment_reference })
    .returning();

  if (!created) {
    const duplicate = await getOrderByPaymentReference(db, input.paymentReference);
    if (duplicate) {
      return duplicate;
    }

    throw new Error(`Order could not be created for payment reference ${input.paymentReference}`);
  }

  return created;
}

export async function updatePersistedOrderFailure(
  db: DbExecutor,
  input: {
    invoice: typeof invoices.$inferSelect;
    paymentReference?: string | null;
    stripePaymentIntentId?: string | null;
    stripeSubscriptionId?: string | null;
    failureCode?: string | null;
    failureMessage?: string | null;
  },
) {
  const normalized = normalizePaymentFailure(input.failureCode ?? null, input.failureMessage ?? null);
  const existing = await getOrderByPaymentReference(db, input.paymentReference ?? input.stripePaymentIntentId ?? null);
  if (existing) {
    const [updated] = await db
      .update(orders)
      .set({
        status: "failed",
        failure_code: normalized.code,
        failure_message: normalized.rawMessage,
        failure_message_normalized: normalized.normalizedMessage,
        stripe_payment_intent_id: input.stripePaymentIntentId ?? existing.stripe_payment_intent_id,
        stripe_subscription_id: input.stripeSubscriptionId ?? existing.stripe_subscription_id,
        updated_at: new Date(),
      })
      .where(eq(orders.id, existing.id))
      .returning();
    return updated;
  }

  return createPersistedOrderFromInvoice(db, {
    invoice: input.invoice,
    paymentReference: input.paymentReference ?? input.stripePaymentIntentId ?? `invoice_failure_${input.invoice.id}`,
    stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    stripeSubscriptionId: input.stripeSubscriptionId ?? null,
    orderType: input.invoice.product_type,
    status: "failed",
    failureCode: normalized.code,
    failureMessage: normalized.rawMessage,
    failureMessageNormalized: normalized.normalizedMessage,
    metadata: {
      source: "invoice_failure",
    },
  });
}

export async function markInvoicePaid(
  db: DbExecutor,
  invoice: typeof invoices.$inferSelect,
  input: {
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    stripeSubscriptionId?: string | null;
  },
) {
  const [updated] = await db
    .update(invoices)
    .set({
      status: "paid",
      consumed_at: new Date(),
      paid_at: new Date(),
      last_payment_attempt_at: new Date(),
      stripe_checkout_session_id: input.stripeCheckoutSessionId ?? invoice.stripe_checkout_session_id,
      stripe_payment_intent_id: input.stripePaymentIntentId ?? invoice.stripe_payment_intent_id,
      stripe_subscription_id: input.stripeSubscriptionId ?? invoice.stripe_subscription_id,
      updated_at: new Date(),
    })
    .where(eq(invoices.id, invoice.id))
    .returning();
  return updated;
}

export async function markInvoiceFailed(
  db: DbExecutor,
  invoice: typeof invoices.$inferSelect,
  input: {
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    stripeSubscriptionId?: string | null;
    failureCode?: string | null;
    failureMessage?: string | null;
  },
) {
  const normalized = normalizePaymentFailure(input.failureCode ?? null, input.failureMessage ?? null);
  const [updated] = await db
    .update(invoices)
    .set({
      status: invoice.status === "paid" ? invoice.status : "failed",
      stripe_checkout_session_id: input.stripeCheckoutSessionId ?? invoice.stripe_checkout_session_id,
      stripe_payment_intent_id: input.stripePaymentIntentId ?? invoice.stripe_payment_intent_id,
      stripe_subscription_id: input.stripeSubscriptionId ?? invoice.stripe_subscription_id,
      failure_code: normalized.code,
      failure_message: normalized.rawMessage,
      failure_message_normalized: normalized.normalizedMessage,
      last_payment_attempt_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(invoices.id, invoice.id))
    .returning();
  return updated;
}

export async function getLatestSubscriptionOrderForInvoice(db: DbExecutor, invoiceId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.invoice_id, invoiceId))
    .orderBy(desc(orders.created_at))
    .limit(1);
  return order ?? null;
}

export async function getInvoiceBySubscriptionId(db: DbExecutor, stripeSubscriptionId: string) {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.stripe_subscription_id, stripeSubscriptionId))
    .orderBy(desc(invoices.created_at))
    .limit(1);
  return invoice ?? null;
}

export async function touchInvoiceSubscriptionCheckout(
  db: DbExecutor,
  invoice: typeof invoices.$inferSelect,
  input: {
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    stripeSubscriptionId?: string | null;
    subscriptionStatus?: string | null;
  },
) {
  const metadata = invoice.metadata && typeof invoice.metadata === "object" && !Array.isArray(invoice.metadata)
    ? invoice.metadata as Record<string, unknown>
    : {};
  const [updated] = await db
    .update(invoices)
    .set({
      stripe_checkout_session_id: input.stripeCheckoutSessionId ?? invoice.stripe_checkout_session_id,
      stripe_payment_intent_id: input.stripePaymentIntentId ?? invoice.stripe_payment_intent_id,
      stripe_subscription_id: input.stripeSubscriptionId ?? invoice.stripe_subscription_id,
      last_payment_attempt_at: new Date(),
      metadata: {
        ...metadata,
        subscriptionStatus: input.subscriptionStatus ?? metadata.subscriptionStatus ?? null,
      },
      updated_at: new Date(),
    })
    .where(eq(invoices.id, invoice.id))
    .returning();
  return updated;
}

export async function syncInvoiceSubscriptionState(
  db: DbExecutor,
  invoice: typeof invoices.$inferSelect,
  subscriptionStatus: string,
  stripeSubscriptionId: string,
) {
  const metadata = invoice.metadata && typeof invoice.metadata === "object" && !Array.isArray(invoice.metadata)
    ? invoice.metadata as Record<string, unknown>
    : {};
  const [updated] = await db
    .update(invoices)
    .set({
      stripe_subscription_id: stripeSubscriptionId,
      metadata: {
        ...metadata,
        subscriptionStatus,
      },
      updated_at: new Date(),
    })
    .where(eq(invoices.id, invoice.id))
    .returning();
  return updated;
}
