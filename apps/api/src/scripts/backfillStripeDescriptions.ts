import "dotenv/config";
import Stripe from "stripe";
import {
  bookingTypes,
  bookings,
  createDb,
  invoices,
  mentorTrainingOrders,
  orders,
  payments,
  regenerationSubscriptions,
  reports,
  subscriptions,
} from "@wisdom/db";
import { eq } from "drizzle-orm";
import {
  isHumanReadableStripeDescription,
  mergeStripeMetadata,
  resolveStripeProductNaming,
  type StripeProductNamingResult,
} from "../services/stripe/stripeProductNamingService.js";

type Confidence = "db_order" | "db_payment" | "stripe_metadata" | "subscription_id" | "amount_fallback";

interface BackfillCandidate {
  source: string;
  sourceId: string;
  paymentIntentId?: string | null;
  invoiceId?: string | null;
  subscriptionId?: string | null;
  naming: StripeProductNamingResult;
  confidence: Confidence;
}

interface Summary {
  updated: number;
  skipped: number;
  failed: number;
  confidenceWarnings: number;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function createStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is required for Stripe backfill.");
  }
  return new Stripe(key);
}

function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Stripe backfill.");
  }
  return createDb(databaseUrl);
}

function shouldSkipStripeObject(metadata: Stripe.Metadata | null | undefined, description: string | null | undefined, expectedName: string) {
  return metadata?.product_name === expectedName || isHumanReadableStripeDescription(description);
}

async function resolvePaymentCandidate(
  db: ReturnType<typeof createDatabase>,
  row: typeof payments.$inferSelect,
): Promise<BackfillCandidate | null> {
  const metadata = asRecord(row.metadata);
  if (row.entity_type === "session") {
    const [booking] = await db
      .select({
        sessionType: bookings.session_type,
        durationMinutes: bookingTypes.duration_minutes,
        bookingTypeName: bookingTypes.name,
      })
      .from(bookings)
      .innerJoin(bookingTypes, eq(bookings.booking_type_id, bookingTypes.id))
      .where(eq(bookings.id, row.booking_id ?? row.entity_id))
      .limit(1);
    const naming = resolveStripeProductNaming({
      type: "session",
      sessionType: booking?.sessionType ?? getString(metadata.sessionType) ?? getString(metadata.session_type),
      durationMinutes: booking?.durationMinutes ?? Number(metadata.sessionDurationMinutes ?? metadata.duration),
      fallbackName: booking?.bookingTypeName ?? getString(metadata.stripeProductName),
    });
    return {
      source: "payments",
      sourceId: row.id,
      paymentIntentId: row.provider_payment_intent_id,
      naming,
      confidence: booking ? "db_payment" : "stripe_metadata",
    };
  }

  if (row.entity_type === "mentoring_circle") {
    return {
      source: "payments",
      sourceId: row.id,
      paymentIntentId: row.provider_payment_intent_id,
      naming: resolveStripeProductNaming({
        type: "event",
        eventType: "mentoring_circle",
        eventName: getString(metadata.eventName),
      }),
      confidence: "db_payment",
    };
  }

  if (row.entity_type === "report") {
    const [report] = await db
      .select({ reportType: reports.interpretation_tier })
      .from(reports)
      .where(eq(reports.id, row.entity_id))
      .limit(1);
    const reportType = report?.reportType ?? getString(metadata.reportType) ?? getString(metadata.tier);
    if (!reportType) return null;
    return {
      source: "payments",
      sourceId: row.id,
      paymentIntentId: row.provider_payment_intent_id,
      naming: resolveStripeProductNaming({ type: "report", reportType }),
      confidence: report ? "db_payment" : "stripe_metadata",
    };
  }

  if (row.entity_type === "subscription") {
    const [subscription] = await db
      .select({
        tier: subscriptions.tier,
        stripeSubscriptionId: subscriptions.stripe_subscription_id,
        metadata: subscriptions.metadata,
      })
      .from(subscriptions)
      .where(eq(subscriptions.id, row.entity_id))
      .limit(1);
    const subscriptionMetadata = asRecord(subscription?.metadata);
    return {
      source: "payments",
      sourceId: row.id,
      paymentIntentId: row.provider_payment_intent_id,
      subscriptionId: subscription?.stripeSubscriptionId ?? null,
      naming: resolveStripeProductNaming({
        type: "subscription",
        subscriptionType: "membership",
        tier: subscription?.tier ?? getString(metadata.tier),
        billingInterval: getString(subscriptionMetadata.billingInterval) ?? getString(metadata.billingInterval),
      }),
      confidence: subscription ? "db_payment" : "stripe_metadata",
    };
  }

  if (row.entity_type === "regeneration_subscription") {
    const [subscription] = await db
      .select({ stripeSubscriptionId: regenerationSubscriptions.stripe_subscription_id })
      .from(regenerationSubscriptions)
      .where(eq(regenerationSubscriptions.id, row.entity_id))
      .limit(1);
    return {
      source: "payments",
      sourceId: row.id,
      paymentIntentId: row.provider_payment_intent_id,
      subscriptionId: subscription?.stripeSubscriptionId ?? null,
      naming: resolveStripeProductNaming({ type: "subscription", subscriptionType: "regeneration" }),
      confidence: subscription ? "db_payment" : "stripe_metadata",
    };
  }

  if (row.entity_type === "mentor_training") {
    const [trainingOrder] = await db
      .select({ packageType: mentorTrainingOrders.package_type })
      .from(mentorTrainingOrders)
      .where(eq(mentorTrainingOrders.id, row.entity_id))
      .limit(1);
    return {
      source: "payments",
      sourceId: row.id,
      paymentIntentId: row.provider_payment_intent_id,
      naming: resolveStripeProductNaming({
        type: "mentor_training",
        packageType: trainingOrder?.packageType ?? getString(metadata.packageType),
      }),
      confidence: trainingOrder ? "db_payment" : "stripe_metadata",
    };
  }

  return null;
}

function resolveOrderCandidate(row: typeof orders.$inferSelect): BackfillCandidate | null {
  const metadata = asRecord(row.metadata);
  const productName = getString(metadata.product_name) ?? row.label;
  if (!productName) return null;
  const naming = resolveStripeProductNaming({
    type: "custom",
    productName,
    description: productName,
    metadata: {
      order_id: row.id,
      order_type: row.type,
    },
  });
  return {
    source: "orders",
    sourceId: row.id,
    paymentIntentId: row.stripe_payment_intent_id,
    invoiceId: row.stripe_invoice_id,
    subscriptionId: row.stripe_subscription_id,
    naming,
    confidence: "db_order",
  };
}

function resolveInvoiceCandidate(row: typeof invoices.$inferSelect): BackfillCandidate {
  const naming = resolveStripeProductNaming({
    type: "manual_invoice",
    productType: row.product_type,
    customLabel: row.label,
  });
  return {
    source: "invoices",
    sourceId: row.id,
    paymentIntentId: row.stripe_payment_intent_id,
    subscriptionId: row.stripe_subscription_id,
    naming,
    confidence: "db_order",
  };
}

async function collectCandidates(db: ReturnType<typeof createDatabase>) {
  const paymentRows = await db.select().from(payments);
  const orderRows = await db.select().from(orders);
  const invoiceRows = await db.select().from(invoices);
  const candidates: BackfillCandidate[] = [];

  for (const row of paymentRows) {
    const candidate = await resolvePaymentCandidate(db, row);
    if (candidate) candidates.push(candidate);
  }
  for (const row of orderRows) {
    const candidate = resolveOrderCandidate(row);
    if (candidate) candidates.push(candidate);
  }
  for (const row of invoiceRows) {
    candidates.push(resolveInvoiceCandidate(row));
  }

  return candidates.filter((candidate) => candidate.paymentIntentId || candidate.invoiceId || candidate.subscriptionId);
}

async function updatePaymentIntent(stripe: Stripe, candidate: BackfillCandidate, dryRun: boolean) {
  if (!candidate.paymentIntentId) return "skipped" as const;
  const intent = await stripe.paymentIntents.retrieve(candidate.paymentIntentId);
  if (shouldSkipStripeObject(intent.metadata, intent.description, candidate.naming.productName)) {
    return "skipped" as const;
  }
  const metadata = mergeStripeMetadata(intent.metadata, candidate.naming.metadata, {
    backfill_source: candidate.source,
    backfill_source_id: candidate.sourceId,
    backfill_confidence: candidate.confidence,
  });
  console.log(`${dryRun ? "Would update" : "Updating"} PaymentIntent ${intent.id}`);
  console.log(`Old: ${intent.description ?? "(none)"}`);
  console.log(`New: ${candidate.naming.productName}`);
  if (!dryRun) {
    await stripe.paymentIntents.update(intent.id, {
      description: candidate.naming.description,
      metadata,
    });
    const charges = await stripe.charges.list({ payment_intent: intent.id, limit: 10 });
    for (const charge of charges.data) {
      await stripe.charges.update(charge.id, {
        description: candidate.naming.description,
        metadata: mergeStripeMetadata(charge.metadata, metadata),
      });
    }
  }
  return "updated" as const;
}

async function updateInvoice(stripe: Stripe, candidate: BackfillCandidate, dryRun: boolean) {
  if (!candidate.invoiceId) return "skipped" as const;
  const invoice = await stripe.invoices.retrieve(candidate.invoiceId);
  if (shouldSkipStripeObject(invoice.metadata, invoice.description, candidate.naming.productName)) {
    return "skipped" as const;
  }
  console.log(`${dryRun ? "Would update" : "Updating"} Invoice ${invoice.id}`);
  console.log(`Old: ${invoice.description ?? "(none)"}`);
  console.log(`New: ${candidate.naming.productName}`);
  if (!dryRun) {
    await stripe.invoices.update(invoice.id, {
      description: candidate.naming.description,
      metadata: mergeStripeMetadata(invoice.metadata, candidate.naming.metadata, {
        backfill_source: candidate.source,
        backfill_source_id: candidate.sourceId,
        backfill_confidence: candidate.confidence,
      }),
    });
  }
  return "updated" as const;
}

async function updateSubscription(stripe: Stripe, candidate: BackfillCandidate, dryRun: boolean) {
  if (!candidate.subscriptionId) return "skipped" as const;
  const subscription = await stripe.subscriptions.retrieve(candidate.subscriptionId);
  if (subscription.metadata?.product_name === candidate.naming.productName) {
    return "skipped" as const;
  }
  console.log(`${dryRun ? "Would update" : "Updating"} Subscription ${subscription.id}`);
  console.log(`New: ${candidate.naming.productName}`);
  if (!dryRun) {
    await stripe.subscriptions.update(subscription.id, {
      metadata: mergeStripeMetadata(subscription.metadata, candidate.naming.metadata, {
        backfill_source: candidate.source,
        backfill_source_id: candidate.sourceId,
        backfill_confidence: candidate.confidence,
      }),
    });
  }
  return "updated" as const;
}

async function run() {
  const dryRun = hasFlag("--dry-run");
  const db = createDatabase();
  const stripe = createStripeClient();
  const candidates = await collectCandidates(db);
  const summary: Summary = {
    updated: 0,
    skipped: 0,
    failed: 0,
    confidenceWarnings: 0,
  };
  const processedPaymentIntents = new Set<string>();
  const processedInvoices = new Set<string>();
  const processedSubscriptions = new Set<string>();

  console.log(`Stripe description backfill starting (${dryRun ? "dry run" : "execute"})`);
  console.log(`Candidates: ${candidates.length}`);

  for (const candidate of candidates) {
    const duplicatePaymentIntent = candidate.paymentIntentId && processedPaymentIntents.has(candidate.paymentIntentId);
    const duplicateInvoice = candidate.invoiceId && processedInvoices.has(candidate.invoiceId);
    const duplicateSubscription = candidate.subscriptionId && processedSubscriptions.has(candidate.subscriptionId);
    if (
      (candidate.paymentIntentId || candidate.invoiceId || candidate.subscriptionId)
      && (!candidate.paymentIntentId || duplicatePaymentIntent)
      && (!candidate.invoiceId || duplicateInvoice)
      && (!candidate.subscriptionId || duplicateSubscription)
    ) {
      summary.skipped += 1;
      continue;
    }

    if (candidate.confidence === "amount_fallback" || candidate.confidence === "stripe_metadata") {
      summary.confidenceWarnings += 1;
      console.warn(`Confidence warning: ${candidate.source}:${candidate.sourceId} resolved via ${candidate.confidence}`);
    }

    try {
      const outcomes = [
        duplicatePaymentIntent ? "skipped" : await updatePaymentIntent(stripe, candidate, dryRun),
        duplicateInvoice ? "skipped" : await updateInvoice(stripe, candidate, dryRun),
        duplicateSubscription ? "skipped" : await updateSubscription(stripe, candidate, dryRun),
      ];
      if (candidate.paymentIntentId) processedPaymentIntents.add(candidate.paymentIntentId);
      if (candidate.invoiceId) processedInvoices.add(candidate.invoiceId);
      if (candidate.subscriptionId) processedSubscriptions.add(candidate.subscriptionId);
      if (outcomes.includes("updated")) {
        summary.updated += 1;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      summary.failed += 1;
      console.error(`Failed ${candidate.source}:${candidate.sourceId}`, error instanceof Error ? error.message : error);
    }
  }

  console.log("Summary:");
  console.log(`Updated: ${summary.updated}`);
  console.log(`Skipped: ${summary.skipped}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Confidence Warnings: ${summary.confidenceWarnings}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
