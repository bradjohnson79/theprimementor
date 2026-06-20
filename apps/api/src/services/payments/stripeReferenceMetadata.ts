export const STRIPE_REFERENCE_SCHEMA_VERSION = "stripe-reference-v1";

export type StripeReferenceEntityType =
  | "webinar"
  | "session"
  | "report"
  | "subscription"
  | "mentor_training"
  | "mentoring_circle"
  | "regeneration_subscription";

export interface StripeReferenceMetadataInput {
  entityType: StripeReferenceEntityType;
  entityId: string;
  userId?: string | null;
  userEmail?: string | null;
  clerkId?: string | null;
  bookingId?: string | null;
  reportId?: string | null;
  membershipId?: string | null;
  regenerationSubscriptionId?: string | null;
  invoiceId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  environment?: string | null;
  platform?: string | null;
}

export interface ParsedStripeReferenceMetadata {
  schemaVersion: string | null;
  entityType: StripeReferenceEntityType | null;
  entityId: string | null;
  userId: string | null;
  userEmail: string | null;
  clerkId: string | null;
  bookingId: string | null;
  reportId: string | null;
  membershipId: string | null;
  regenerationSubscriptionId: string | null;
  invoiceId: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  environment: string | null;
  platform: string | null;
  raw: Record<string, string>;
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getFirst(metadata: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = clean(metadata[key]);
    if (value) return value;
  }
  return null;
}

function isEntityType(value: string | null): value is StripeReferenceEntityType {
  return value === "session"
    || value === "report"
    || value === "subscription"
    || value === "mentor_training"
    || value === "mentoring_circle"
    || value === "regeneration_subscription";
}

export function buildStripeReferenceMetadata(input: StripeReferenceMetadataInput): Record<string, string> {
  const metadata: Record<string, string> = {
    schemaVersion: STRIPE_REFERENCE_SCHEMA_VERSION,
    entityType: input.entityType,
    entityId: input.entityId,
  };

  const optional: Record<string, string | null | undefined> = {
    userId: input.userId,
    userEmail: input.userEmail,
    clerkId: input.clerkId,
    bookingId: input.bookingId,
    reportId: input.reportId,
    membershipId: input.membershipId,
    regenerationSubscriptionId: input.regenerationSubscriptionId,
    invoiceId: input.invoiceId,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId,
    stripePaymentIntentId: input.stripePaymentIntentId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    stripeCustomerId: input.stripeCustomerId,
    environment: input.environment,
    platform: input.platform,
  };

  for (const [key, value] of Object.entries(optional)) {
    const normalized = clean(value);
    if (normalized) metadata[key] = normalized;
  }

  return metadata;
}

export function parseStripeReferenceMetadata(metadata: unknown): ParsedStripeReferenceMetadata {
  const raw = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, String(value)]))
    : {};
  const entityType = getFirst(raw, ["entityType", "type", "product_type"]);
  const bookingId = getFirst(raw, ["bookingId", "booking_id"]);
  const reportId = getFirst(raw, ["reportId", "report_id"]);
  const membershipId = getFirst(raw, ["membershipId", "membership_id"]);
  const regenerationSubscriptionId = getFirst(raw, ["regenerationSubscriptionId", "regeneration_subscription_id"]);
  const invoiceId = getFirst(raw, ["invoiceId", "invoice_id"]);

  return {
    schemaVersion: getFirst(raw, ["schemaVersion", "version"]),
    entityType: isEntityType(entityType) ? entityType : null,
    entityId: getFirst(raw, ["entityId", "entity_id"]) ?? bookingId ?? reportId ?? membershipId ?? regenerationSubscriptionId ?? invoiceId,
    userId: getFirst(raw, ["userId", "user_id"]),
    userEmail: getFirst(raw, ["userEmail", "customer_email", "email"]),
    clerkId: getFirst(raw, ["clerkId", "clerk_id"]),
    bookingId,
    reportId,
    membershipId,
    regenerationSubscriptionId,
    invoiceId,
    stripeCheckoutSessionId: getFirst(raw, ["stripeCheckoutSessionId", "stripe_checkout_session_id", "checkoutSessionId"]),
    stripePaymentIntentId: getFirst(raw, ["stripePaymentIntentId", "stripe_payment_intent_id", "paymentIntentId"]),
    stripeSubscriptionId: getFirst(raw, ["stripeSubscriptionId", "stripe_subscription_id", "subscriptionId"]),
    stripeCustomerId: getFirst(raw, ["stripeCustomerId", "stripe_customer_id", "customerId"]),
    environment: getFirst(raw, ["environment"]),
    platform: getFirst(raw, ["platform", "app"]),
    raw,
  };
}
