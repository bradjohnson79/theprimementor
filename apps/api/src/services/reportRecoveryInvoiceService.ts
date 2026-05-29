import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { payments, reports, users, type Database } from "@wisdom/db";
import {
  REPORT_PRODUCTS,
  isPremiumReportProduct,
  resolveReportProductKey,
  type ReportProductKey,
} from "@wisdom/utils";
import {
  MEMBERSHIP_CHECKOUT_APP,
  MEMBERSHIP_CHECKOUT_SCHEMA_VERSION,
  getMembershipCheckoutEnvironment,
} from "../config/membershipBilling.js";
import { getReportStripePriceId } from "../config/stripeReportPrices.js";
import { createHttpError } from "./booking/errors.js";
import { parseOrderId } from "./ordersService.js";
import { getReusablePaymentForEntity } from "./payments/paymentsService.js";
import { ensureStripeCustomerId } from "./payments/stripeCustomerService.js";
import {
  mergeStripeMetadata,
  resolveStripeProductNaming,
} from "./stripe/stripeProductNamingService.js";

let stripeSingleton: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY not set");
    }
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
}

function buildReportInvoiceMetadata(input: {
  userId: string;
  userEmail: string;
  clerkId: string;
  reportId: string;
  reportType: ReportProductKey;
}): Record<string, string> {
  const product = REPORT_PRODUCTS[input.reportType];
  const metadata: Record<string, string> = {
    userId: input.userId.trim(),
    userEmail: input.userEmail.trim(),
    clerkId: input.clerkId.trim(),
    type: "report",
    entityType: "report",
    entityId: input.reportId.trim(),
    reportId: input.reportId.trim(),
    reportType: input.reportType,
    environment: getMembershipCheckoutEnvironment(),
    app: MEMBERSHIP_CHECKOUT_APP,
    version: MEMBERSHIP_CHECKOUT_SCHEMA_VERSION,
    recoverySource: "admin_invoice",
  };

  if (isPremiumReportProduct(product)) {
    metadata.reportTier = product.tier;
  }

  return metadata;
}

export function resolveRecoveryInvoiceReportType(value: unknown): ReportProductKey {
  const reportType = resolveReportProductKey(value);
  if (!reportType) {
    throw createHttpError(400, "Invalid report type.");
  }
  return reportType;
}

function mergeRecoveryInvoicePaymentMetadata(
  existingMeta: Record<string, unknown>,
  input: {
    stripeInvoiceId: string;
    hostedInvoiceUrl: string | null;
    reportType: ReportProductKey;
    productName: string;
  },
) {
  const product = REPORT_PRODUCTS[input.reportType];
  return {
    ...existingMeta,
    stripeRecoveryInvoiceId: input.stripeInvoiceId,
    stripeRecoveryInvoiceSentAt: new Date().toISOString(),
    stripeRecoveryInvoiceHostedUrl: input.hostedInvoiceUrl,
    reportType: input.reportType,
    product_name: input.productName,
    tier: isPremiumReportProduct(product) ? product.tier : input.reportType,
  };
}

export interface SendReportRecoveryInvoiceResult {
  stripeInvoiceId: string;
  hostedInvoiceUrl: string | null;
  resent: boolean;
}

export async function sendAdminReportRecoveryInvoice(
  db: Database,
  orderId: string,
): Promise<SendReportRecoveryInvoiceResult> {
  const parsed = parseOrderId(orderId);
  if (parsed.type !== "report") {
    throw createHttpError(400, "Recovery invoices are only available for report orders.");
  }
  const reportId = parsed.sourceId;

  const [row] = await db
    .select({
      report: reports,
      userEmail: users.email,
      clerkId: users.clerk_id,
    })
    .from(reports)
    .innerJoin(users, eq(reports.user_id, users.id))
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!row) {
    throw createHttpError(404, "Report not found");
  }

  if (row.report.member_status !== "pending_payment") {
    throw createHttpError(400, "Report is not awaiting payment.");
  }

  const reportType = resolveRecoveryInvoiceReportType(row.report.interpretation_tier);

  const payment = await getReusablePaymentForEntity(db, {
    entityType: "report",
    entityId: reportId,
  });
  if (!payment) {
    throw createHttpError(400, "No pending payment record found for this report.");
  }
  if (payment.status === "paid") {
    throw createHttpError(400, "This order is already paid.");
  }

  const stripe = getStripe();
  const userEmail = row.userEmail?.trim();
  if (!userEmail) {
    throw createHttpError(400, "User email is required to send an invoice.");
  }
  const userId = row.report.user_id;
  if (!userId) {
    throw createHttpError(400, "Report is missing a user association.");
  }
  const clerkId = row.clerkId?.trim() ?? "";
  const naming = resolveStripeProductNaming({
    type: "report",
    reportType,
  });
  const metadata = mergeStripeMetadata(buildReportInvoiceMetadata({
    userId,
    userEmail,
    clerkId,
    reportId,
    reportType,
  }), naming.metadata, {
    customer_email: userEmail,
  });

  const customerId = await ensureStripeCustomerId(db, {
    stripe,
    userId,
    email: userEmail,
    metadata: { userId },
  });

  const existingMeta =
    payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
      ? { ...(payment.metadata as Record<string, unknown>) }
      : {};
  const existingInv =
    typeof existingMeta.stripeRecoveryInvoiceId === "string" ? existingMeta.stripeRecoveryInvoiceId : null;

  if (existingInv) {
    const inv = await stripe.invoices.retrieve(existingInv);
    if (inv.status === "open" || inv.status === "draft") {
      await stripe.invoices.sendInvoice(existingInv);
      return {
        stripeInvoiceId: existingInv,
        hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
        resent: true,
      };
    }
    if (inv.status === "paid") {
      throw createHttpError(400, "Recovery invoice was already paid.");
    }
  }

  const priceId = getReportStripePriceId(reportType);

  const draft = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: 7,
    description: naming.description,
    metadata,
    auto_advance: false,
  });

  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: draft.id,
    pricing: { price: priceId },
    quantity: 1,
    description: naming.productName,
    metadata,
  });

  const finalized = await stripe.invoices.finalizeInvoice(draft.id);
  await stripe.invoices.sendInvoice(finalized.id);

  const mergedPaymentMeta = mergeRecoveryInvoicePaymentMetadata(existingMeta, {
    stripeInvoiceId: finalized.id,
    hostedInvoiceUrl: finalized.hosted_invoice_url ?? null,
    reportType,
    productName: naming.productName,
  });

  await db
    .update(payments)
    .set({
      metadata: mergedPaymentMeta,
      updated_at: new Date(),
    })
    .where(eq(payments.id, payment.id));

  return {
    stripeInvoiceId: finalized.id,
    hostedInvoiceUrl: finalized.hosted_invoice_url ?? null,
    resent: false,
  };
}
