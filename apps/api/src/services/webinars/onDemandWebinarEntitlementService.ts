import { and, eq, isNull } from "drizzle-orm";
import { webinarRecordingEntitlements, type Database } from "@wisdom/db";

export interface OnDemandWebinarEntitlementSummary {
  id: string;
  userId: string;
  webinarId: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripePriceId: string | null;
  amountCents: number | null;
  currency: string | null;
  grantSource: string;
  purchasedAt: Date | null;
  revokedAt: Date | null;
  orderId: string | null;
  paymentId: string | null;
}

function serializeEntitlement(row: {
  id: string;
  user_id: string;
  webinar_id: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_price_id: string | null;
  amount_cents: number | null;
  currency: string | null;
  grant_source: string;
  purchased_at: Date | null;
  revoked_at: Date | null;
  order_id: string | null;
  payment_id: string | null;
}): OnDemandWebinarEntitlementSummary {
  return {
    id: row.id,
    userId: row.user_id,
    webinarId: row.webinar_id,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    stripePriceId: row.stripe_price_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    grantSource: row.grant_source,
    purchasedAt: row.purchased_at,
    revokedAt: row.revoked_at,
    orderId: row.order_id,
    paymentId: row.payment_id,
  };
}

export async function getOnDemandWebinarEntitlement(
  db: Database,
  input: { userId: string; webinarId: string },
) {
  const [row] = await db
    .select()
    .from(webinarRecordingEntitlements)
    .where(and(
      eq(webinarRecordingEntitlements.user_id, input.userId),
      eq(webinarRecordingEntitlements.webinar_id, input.webinarId),
    ))
    .limit(1);
  return row ? serializeEntitlement(row) : null;
}

export async function hasActiveOnDemandWebinarEntitlement(
  db: Database,
  input: { userId: string; webinarId: string },
) {
  const entitlement = await getOnDemandWebinarEntitlement(db, input);
  return Boolean(entitlement?.purchasedAt && !entitlement.revokedAt);
}

export async function listActiveOnDemandWebinarEntitlements(db: Database, userId: string) {
  const rows = await db
    .select()
    .from(webinarRecordingEntitlements)
    .where(and(
      eq(webinarRecordingEntitlements.user_id, userId),
      isNull(webinarRecordingEntitlements.revoked_at),
    ));
  return rows.filter((row) => row.purchased_at).map(serializeEntitlement);
}

export function isActiveOnDemandEntitlement(
  entitlement: Pick<OnDemandWebinarEntitlementSummary, "purchasedAt" | "revokedAt"> | null,
) {
  return Boolean(entitlement?.purchasedAt && !entitlement.revokedAt);
}

export function canRequestOnDemandPlayback(input: { owned: boolean; role?: string | null }) {
  return input.owned === true || input.role === "admin";
}
