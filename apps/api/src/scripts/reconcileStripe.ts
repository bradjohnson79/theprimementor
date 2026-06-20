import "dotenv/config";
import Stripe from "stripe";
import { createDb, payments } from "@wisdom/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  reconcileSucceededSessionPaymentIntent,
  type StripePaymentReconciliationResult,
} from "../services/payments/stripeReconciliationService.js";

type SupportedType = "session" | "report" | "subscription";

interface CliOptions {
  dryRun: boolean;
  live: boolean;
  yesRepair: boolean;
  type: SupportedType | null;
  from: Date | null;
  order: string | null;
  stripeEvent: string | null;
}

interface Candidate {
  localPaymentId: string;
  entityType: string;
  entityId: string;
  bookingId: string | null;
  status: string;
  providerPaymentIntentId: string | null;
  checkoutSessionId: string | null;
  createdAt: Date;
}

function getArgValue(prefix: string) {
  const arg = process.argv.find((entry) => entry.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1).trim() : null;
}

function parseOptions(): CliOptions {
  const live = process.argv.includes("--live");
  const dryRun = process.argv.includes("--dry-run") || !live;
  const typeValue = getArgValue("--type");
  const fromValue = getArgValue("--from");
  const order = getArgValue("--order");
  const stripeEvent = getArgValue("--stripe-event");

  if (typeValue && typeValue !== "session" && typeValue !== "report" && typeValue !== "subscription") {
    throw new Error("--type must be one of session, report, or subscription.");
  }
  if (live && !process.argv.includes("--yes-repair")) {
    throw new Error("Live repair requires both --live and --yes-repair. Run --dry-run first.");
  }

  return {
    dryRun,
    live,
    yesRepair: process.argv.includes("--yes-repair"),
    type: typeValue as SupportedType | null,
    from: fromValue ? new Date(fromValue) : null,
    order,
    stripeEvent,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function createStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is required.");
  return new Stripe(key);
}

function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  return createDb(databaseUrl);
}

function buildWhere(options: CliOptions) {
  const clauses = [
    options.type ? eq(payments.entity_type, options.type) : null,
    options.from ? gte(payments.created_at, options.from) : null,
    options.order
      ? sql`(${payments.id}::text = ${options.order} or ${payments.entity_id} = ${options.order} or ${payments.booking_id}::text = ${options.order})`
      : null,
  ].filter((clause): clause is NonNullable<typeof clause> => Boolean(clause));
  return clauses.length ? and(...clauses) : undefined;
}

async function listCandidates(db: ReturnType<typeof createDatabase>, options: CliOptions): Promise<Candidate[]> {
  const rows = await db
    .select({
      id: payments.id,
      entityType: payments.entity_type,
      entityId: payments.entity_id,
      bookingId: payments.booking_id,
      status: payments.status,
      providerPaymentIntentId: payments.provider_payment_intent_id,
      metadata: payments.metadata,
      createdAt: payments.created_at,
    })
    .from(payments)
    .where(buildWhere(options))
    .orderBy(desc(payments.created_at));

  return rows
    .map((row) => {
      const metadata = asRecord(row.metadata);
      return {
        localPaymentId: row.id,
        entityType: row.entityType,
        entityId: row.entityId,
        bookingId: row.bookingId,
        status: row.status,
        providerPaymentIntentId: row.providerPaymentIntentId,
        checkoutSessionId: getString(metadata.stripeCheckoutSessionId) ?? getString(metadata.checkoutSessionId),
        createdAt: row.createdAt,
      };
    })
    .filter((row) => row.providerPaymentIntentId || row.checkoutSessionId);
}

async function inspectCandidate(
  stripe: Stripe,
  candidate: Candidate,
): Promise<{ candidate: Candidate; mismatch: string | null; confidence: "high" | "medium" | "low"; proposedAction: string | null; stripe: Record<string, unknown> }> {
  if (candidate.providerPaymentIntentId) {
    const intent = await stripe.paymentIntents.retrieve(candidate.providerPaymentIntentId);
    const paid = intent.status === "succeeded";
    return {
      candidate,
      mismatch: paid && candidate.status !== "paid" ? "stripe_paid_local_not_paid" : null,
      confidence: "high",
      proposedAction: paid && candidate.status !== "paid" ? "mark_local_payment_paid_from_payment_intent" : null,
      stripe: {
        paymentIntentId: intent.id,
        status: intent.status,
        amount: intent.amount,
        currency: intent.currency,
      },
    };
  }

  if (candidate.checkoutSessionId) {
    const session = await stripe.checkout.sessions.retrieve(candidate.checkoutSessionId, { expand: ["payment_intent"] });
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
    const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    const missingLocalPaymentIntent = paid && paymentIntentId && !candidate.providerPaymentIntentId;
    return {
      candidate,
      mismatch: paid && candidate.status !== "paid"
        ? "stripe_checkout_paid_local_not_paid"
        : missingLocalPaymentIntent
          ? "stripe_checkout_paid_local_missing_payment_intent"
          : null,
      confidence: paid && paymentIntentId ? "high" : "medium",
      proposedAction: paid && paymentIntentId
        ? candidate.status === "paid"
          ? "attach_stripe_payment_intent_to_local_payment"
          : "mark_local_payment_paid_from_checkout_payment_intent"
        : null,
      stripe: {
        checkoutSessionId: session.id,
        checkoutStatus: session.status,
        paymentStatus: session.payment_status,
        paymentIntentId,
        amountTotal: session.amount_total,
        currency: session.currency,
      },
    };
  }

  return { candidate, mismatch: "missing_stripe_reference", confidence: "low", proposedAction: null, stripe: {} };
}

async function inspectStripeEvent(stripe: Stripe, stripeEventId: string) {
  const event = await stripe.events.retrieve(stripeEventId);
  return {
    id: event.id,
    type: event.type,
    created: new Date(event.created * 1000).toISOString(),
    livemode: event.livemode,
    objectId: "id" in event.data.object ? event.data.object.id : null,
  };
}

async function main() {
  const options = parseOptions();
  const db = createDatabase();
  const stripe = createStripe();
  const event = options.stripeEvent ? await inspectStripeEvent(stripe, options.stripeEvent) : null;
  const candidates = await listCandidates(db, options);
  const inspected = [];

  for (const candidate of candidates) {
    const result = await inspectCandidate(stripe, candidate);
    inspected.push(result);

    if (options.live && options.yesRepair && result.proposedAction && candidate.entityType === "session") {
      const paymentIntentId = getString(result.stripe.paymentIntentId);
      if (paymentIntentId) {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        const repairResult: StripePaymentReconciliationResult = await reconcileSucceededSessionPaymentIntent(db, paymentIntent);
        result.stripe.repairResult = repairResult;
      }
    }
  }

  const mismatches = inspected.filter((entry) => entry.mismatch);
  console.log(JSON.stringify({
    mode: options.live ? "live" : "dry-run",
    filters: {
      type: options.type,
      from: options.from?.toISOString() ?? null,
      order: options.order,
      stripeEvent: options.stripeEvent,
    },
    event,
    scanned: inspected.length,
    mismatches: mismatches.length,
    results: mismatches,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
