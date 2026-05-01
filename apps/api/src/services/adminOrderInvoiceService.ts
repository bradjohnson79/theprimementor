import Stripe from "stripe";
import { orders as persistedOrdersTable, users, type Database } from "@wisdom/db";
import { logger } from "@wisdom/utils";
import { and, eq } from "drizzle-orm";
import { createHttpError } from "./booking/errors.js";
import { getAdminOrderById, parseOrderId } from "./ordersService.js";
import { ensureStripeCustomerId } from "./payments/stripeCustomerService.js";

let stripeSingleton: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY not set");
    }
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
}

function logDev(level: "info" | "warn" | "error", message: string, context: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  if (level === "error") {
    logger.error(message, context);
    return;
  }
  if (level === "warn") {
    logger.warn(message, context);
    return;
  }
  logger.info(message, context);
}

function isPersistedOrderTypeMatch(orderType: string, parsedType: ReturnType<typeof parseOrderId>["type"]) {
  if (parsedType === "subscription") {
    return orderType === "subscription" || orderType === "subscription_initial" || orderType === "subscription_renewal";
  }
  return orderType === parsedType;
}

export function assertOrderCanCreateInvoice(order: Pick<Awaited<ReturnType<typeof getAdminOrderById>>, "type" | "status" | "metadata">) {
  if (order.type !== "session") {
    throw createHttpError(400, "Manual invoice creation is currently only supported for session orders.");
  }

  if (["paid", "completed", "refunded", "cancelled"].includes(order.status)) {
    throw createHttpError(409, "Invoice cannot be created for an order that is already paid or closed.");
  }

  if (order.metadata.stripe_invoice_id) {
    throw createHttpError(409, "Invoice already exists for this order.");
  }
}

function normalizeStripeInvoiceStatus(status: Stripe.Invoice.Status | null | undefined) {
  return status ?? "open";
}

export interface CreateAdminOrderInvoiceResult {
  success: true;
  invoiceId: string;
  invoiceUrl: string | null;
  invoiceStatus: string;
  order: Awaited<ReturnType<typeof getAdminOrderById>>;
}

export async function createAdminOrderInvoice(
  db: Database,
  input: {
    orderId: string;
  },
): Promise<CreateAdminOrderInvoiceResult> {
  const parsed = parseOrderId(input.orderId);
  const order = await getAdminOrderById(db, input.orderId);
  assertOrderCanCreateInvoice(order);

  const [row] = await db
    .select({
      id: persistedOrdersTable.id,
      userId: persistedOrdersTable.user_id,
      type: persistedOrdersTable.type,
      label: persistedOrdersTable.label,
      amount: persistedOrdersTable.amount,
      currency: persistedOrdersTable.currency,
      stripeInvoiceId: persistedOrdersTable.stripe_invoice_id,
      email: users.email,
    })
    .from(persistedOrdersTable)
    .innerJoin(users, eq(persistedOrdersTable.user_id, users.id))
    .where(and(
      eq(persistedOrdersTable.id, parsed.sourceId),
      eq(persistedOrdersTable.archived, false),
    ))
    .limit(1);

  if (!row || !isPersistedOrderTypeMatch(row.type, parsed.type)) {
    throw createHttpError(404, "Order not found");
  }

  if (row.stripeInvoiceId) {
    throw createHttpError(409, "Invoice already exists for this order.");
  }

  const email = row.email?.trim();
  if (!email) {
    throw createHttpError(400, "A customer email is required before an invoice can be created.");
  }

  if (!Number.isInteger(row.amount) || row.amount <= 0) {
    throw createHttpError(400, "Order amount must be greater than zero to create an invoice.");
  }

  const stripe = getStripe();
  const currency = row.currency.trim().toLowerCase();
  const description = row.label.trim() || "Session";

  logDev("info", "admin_order_invoice_create_attempt", {
    orderId: input.orderId,
    persistedOrderId: row.id,
    userId: row.userId,
    currency,
    amountCents: row.amount,
  });

  try {
    const customerId = await ensureStripeCustomerId(db, {
      stripe,
      userId: row.userId,
      email,
      name: order.client_name,
      metadata: {
        userId: row.userId,
        email,
      },
    });

    const metadata = {
      adminOrderId: input.orderId,
      persistedOrderId: row.id,
      type: order.type,
      email,
    };

    const draftInvoice = await stripe.invoices.create({
      customer: customerId,
      auto_advance: true,
      collection_method: "send_invoice",
      days_until_due: 7,
      description,
      metadata,
    });

    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: draftInvoice.id,
      amount: row.amount,
      currency,
      description,
      metadata,
    });

    const finalizedInvoice = draftInvoice.status === "draft"
      ? await stripe.invoices.finalizeInvoice(draftInvoice.id)
      : draftInvoice;
    const sentInvoice = finalizedInvoice.status === "open"
      ? await stripe.invoices.sendInvoice(finalizedInvoice.id)
      : finalizedInvoice;

    const stripeInvoiceId = sentInvoice.id;
    const stripeInvoiceUrl = sentInvoice.hosted_invoice_url ?? finalizedInvoice.hosted_invoice_url ?? null;
    const stripeInvoiceStatus = normalizeStripeInvoiceStatus(sentInvoice.status);

    await db
      .update(persistedOrdersTable)
      .set({
        stripe_invoice_id: stripeInvoiceId,
        stripe_invoice_url: stripeInvoiceUrl,
        stripe_invoice_status: stripeInvoiceStatus,
        updated_at: new Date(),
      })
      .where(eq(persistedOrdersTable.id, row.id));

    logDev("info", "admin_order_invoice_create_success", {
      orderId: input.orderId,
      persistedOrderId: row.id,
      stripeInvoiceId,
      stripeInvoiceStatus,
      stripeInvoiceUrl,
    });

    const updatedOrder = await getAdminOrderById(db, input.orderId);
    return {
      success: true,
      invoiceId: stripeInvoiceId,
      invoiceUrl: stripeInvoiceUrl,
      invoiceStatus: stripeInvoiceStatus,
      order: updatedOrder,
    };
  } catch (error) {
    logDev("error", "admin_order_invoice_create_failed", {
      orderId: input.orderId,
      persistedOrderId: row.id,
      error: error instanceof Error ? error.message : error,
    });

    if (error instanceof Error && "statusCode" in error) {
      throw error;
    }

    throw createHttpError(502, "Unable to create invoice. Please try again.");
  }
}
