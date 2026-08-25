import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  date,
  integer,
  doublePrecision,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const timestamps = {
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date()),
};

type PromoTarget =
  | "qa_session"
  | "qa_session:30"
  | "qa_session:45"
  | "qa_session:60"
  | "focus"
  | "mentoring"
  | "mentoring:45"
  | "mentoring:90"
  | "regeneration"
  | "report:three_questions"
  | "report:compatibility"
  | "report:annual_12_month"
  | "report:intro"
  | "report:deep_dive"
  | "report:initiate"
  | "subscription:seeker"
  | "subscription:initiate"
  | "mentor_training:entry"
  | "mentor_training:seeker"
  | "mentor_training:initiate"
  | "mentoring_circle";

type PromoBillingScope = "one_time" | "recurring";

export const bookingSessionTypeEnum = pgEnum("booking_session_type", [
  "focus",
  "mentoring",
  "regeneration",
  "qa_session",
  "mentoring_circle",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending_payment",
  "paid",
  "scheduled",
  "completed",
  "cancelled",
]);

export const reportMemberStatusEnum = pgEnum("report_member_status", [
  "pending_payment",
  "paid",
  "fulfilled",
]);

export const mentorTrainingPackageEnum = pgEnum("mentor_training_package", [
  "entry",
  "seeker",
  "initiate",
]);

export const mentorTrainingStatusEnum = pgEnum("mentor_training_status", [
  "pending_payment",
  "paid",
  "in_progress",
  "completed",
  "cancelled",
]);

export const invoiceBillingModeEnum = pgEnum("invoice_billing_mode", [
  "one_time",
  "subscription",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "pending",
  "paid",
  "failed",
  "expired",
]);

export const invoiceProductTypeEnum = pgEnum("invoice_product_type", [
  "session",
  "report",
  "subscription",
  "webinar",
  "custom",
]);

export const persistedOrderTypeEnum = pgEnum("persisted_order_type", [
  "session",
  "report",
  "subscription",
  "subscription_initial",
  "subscription_renewal",
  "webinar",
  "mentor_training",
  "regeneration_offer",
  "shop",
  "custom",
]);

export const shopProductStatusEnum = pgEnum("shop_product_status", [
  "draft",
  "active",
  "archived",
]);

export const shopProductFileKindEnum = pgEnum("shop_product_file_kind", [
  "deck",
  "booklet",
  "manual",
  "other",
]);

export const persistedOrderStatusEnum = pgEnum("persisted_order_status", [
  "pending",
  "completed",
  "refunded",
  "failed",
]);

export const orderRefundReasonEnum = pgEnum("order_refund_reason", [
  "requested_by_customer",
  "fraudulent",
  "duplicate",
  "other",
]);

export const notificationRecipientTypeEnum = pgEnum("notification_recipient_type", [
  "user",
  "admin",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "sent",
  "failed",
  "skipped_duplicate",
]);

export const seoRecommendationTypeEnum = pgEnum("seo_recommendation_type", [
  "initial_generation",
  "title_update",
  "meta_description_update",
  "keyword_update",
  "og_image_update",
  "indexing_update",
  "no_change",
]);

export const seoRecommendationImpactEnum = pgEnum("seo_recommendation_impact", [
  "low",
  "medium",
  "high",
]);

export const seoRecommendationSourceEnum = pgEnum("seo_recommendation_source", [
  "initial_scan",
  "weekly_optimization",
]);

export const seoRecommendationStatusEnum = pgEnum("seo_recommendation_status", [
  "pending",
  "approved",
  "rejected",
  "edited",
  "applied",
  "superseded",
]);

export const seoIntentEnum = pgEnum("seo_intent", [
  "informational",
  "transactional",
  "navigational",
]);

export const seoAuditStatusEnum = pgEnum("seo_audit_status", [
  "pending",
  "running",
  "complete",
  "failed",
]);

export const seoAuditSeverityEnum = pgEnum("seo_audit_severity", [
  "low",
  "medium",
  "high",
]);

export const seoRecommendationFieldEnum = pgEnum("seo_recommendation_field", [
  "title",
  "meta_description",
  "keywords",
  "og_image",
  "indexing",
]);

export const seoRecommendationActionEnum = pgEnum("seo_recommendation_action", [
  "update",
  "no_change",
]);

export const seoChangeSourceEnum = pgEnum("seo_change_source", [
  "manual",
  "ai_approved",
  "ai_edited",
  "rollback",
]);

export const promoDiscountTypeEnum = pgEnum("promo_discount_type", [
  "percentage",
  "fixed_amount",
]);

export const promoSyncStatusEnum = pgEnum("promo_sync_status", [
  "synced",
  "needs_sync",
  "broken",
]);

export const promoBillingScopeEnum = pgEnum("promo_billing_scope", [
  "one_time",
  "recurring",
]);

export interface SeoKeywordBuckets {
  primary: string[];
  secondary: string[];
}

export interface SeoRecommendationSnapshot {
  title: string | null;
  metaDescription: string | null;
  keywords: SeoKeywordBuckets;
  ogImage: string | null;
  robotsIndex: boolean;
}

export type SeoRecommendationValue = string | boolean | SeoKeywordBuckets | null;

export interface SeoAuditSummaryJson {
  pagesScanned: number;
  totalIssues: number;
  issuesBySeverity: Record<"low" | "medium" | "high", number>;
  pagesAffected: SeoPageSummary[];
  healthScore: number;
  previousScore: number | null;
  delta: number | null;
}

export interface SeoPageSummary {
  pageKey: string;
  issueCount: number;
}

export interface SeoReportJson {
  overview: {
    auditId: string;
    pagesScanned: number;
    totalIssues: number;
    healthScore: number;
    previousScore: number | null;
    delta: number | null;
    createdAt: string;
  };
  issuesFound: Array<{
    pageKey: string;
    severity: "low" | "medium" | "high";
    issueType: string;
    description: string;
    detectedValue: SeoRecommendationValue;
    recommendedValue: SeoRecommendationValue;
  }>;
  recommendations: Array<{
    recommendationId: string;
    pageKey: string;
    field: "title" | "meta_description" | "keywords" | "og_image" | "indexing";
    currentValue: SeoRecommendationValue;
    suggestedValue: SeoRecommendationValue;
    editedValue: SeoRecommendationValue;
    reasoning: string | null;
    confidenceScore: number;
    expectedImpact: string | null;
    status: string;
  }>;
  actionsTaken: Array<{
    changeId: string;
    pageKey: string;
    field: "title" | "meta_description" | "keywords" | "og_image" | "indexing";
    source: "manual" | "ai_approved" | "ai_edited" | "rollback";
    oldValue: SeoRecommendationValue;
    newValue: SeoRecommendationValue;
    appliedAt: string;
    appliedBy: string | null;
  }>;
  strategicInsights: string[];
  nextSteps: string[];
}

export interface PromoValidationSnapshot {
  existsInStripe: boolean;
  couponValid: boolean;
  promotionCodeValid: boolean;
  discountMatch: boolean;
  discountTypeMatch?: boolean;
  currencyMatch?: boolean;
  durationMatch?: boolean;
  activeMatch: boolean;
  expiryMatch: boolean;
  usageMatch: boolean;
  issues: string[];
}

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerk_id: text("clerk_id").unique().notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  role: text("role").default("client").notNull(),
  ...timestamps,
});

export const memberEntitlements = pgTable("member_entitlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  stripe_subscription_id: text("stripe_subscription_id"),
  tier: text("tier").default("seeker").notNull(),
  billing_interval: text("billing_interval").default("monthly").notNull(),
  current_period_start: timestamp("current_period_start", { withTimezone: true }),
  current_period_end: timestamp("current_period_end", { withTimezone: true }),
  last_synced_at: timestamp("last_synced_at", { withTimezone: true }).defaultNow().notNull(),
  ...timestamps,
}, (table) => ({
  userIdx: uniqueIndex("member_entitlements_user_uidx").on(table.user_id),
  subscriptionIdx: index("member_entitlements_subscription_idx").on(table.stripe_subscription_id),
}));

export const memberUsage = pgTable("member_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  period_start: timestamp("period_start", { withTimezone: true }).notNull(),
  period_end: timestamp("period_end", { withTimezone: true }).notNull(),
  prompts_used: integer("prompts_used").default(0).notNull(),
  ...timestamps,
}, (table) => ({
  userPeriodUnique: uniqueIndex("member_usage_user_period_uidx").on(
    table.user_id,
    table.period_start,
    table.period_end,
  ),
  userPeriodIdx: index("member_usage_user_period_idx").on(table.user_id, table.period_start, table.period_end),
}));

export const memberUsageEvents = pgTable("member_usage_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  request_id: text("request_id").notNull(),
  thread_id: uuid("thread_id"),
  message_id: uuid("message_id"),
  period_start: timestamp("period_start", { withTimezone: true }).notNull(),
  period_end: timestamp("period_end", { withTimezone: true }).notNull(),
  counted_at: timestamp("counted_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  requestUnique: uniqueIndex("member_usage_events_user_request_uidx").on(table.user_id, table.request_id),
  userCountedIdx: index("member_usage_events_user_counted_idx").on(table.user_id, table.counted_at),
}));

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  full_birth_name: text("full_birth_name").notNull(),
  birth_date: text("birth_date"),
  birth_time: text("birth_time"),
  birth_location: text("birth_location"),
  goals: text("goals"),
  challenges: text("challenges"),
  ...timestamps,
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  full_name: text("full_name").notNull(),
  tag: text("tag").notNull(),
  birth_date: date("birth_date").notNull(),
  birth_time: text("birth_time").notNull(),
  birth_place: text("birth_place").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  timezone: text("timezone").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userTagUnique: uniqueIndex("profiles_user_tag_uidx").on(table.user_id, table.tag),
  userIdx: index("profiles_user_idx").on(table.user_id),
  tagIdx: index("profiles_tag_idx").on(table.tag),
}));

export const bookingTypes = pgTable("booking_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  session_type: bookingSessionTypeEnum("session_type").default("mentoring").notNull(),
  duration_minutes: integer("duration_minutes").notNull(),
  price_cents: integer("price_cents").notNull(),
  currency: text("currency").notNull(),
  buffer_before_minutes: integer("buffer_before_minutes").notNull(),
  buffer_after_minutes: integer("buffer_after_minutes").notNull(),
  is_active: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  booking_type_id: text("booking_type_id")
    .references(() => bookingTypes.id)
    .notNull(),
  session_type: bookingSessionTypeEnum("session_type").default("mentoring").notNull(),
  event_key: text("event_key"),
  start_time_utc: timestamp("start_time_utc", { withTimezone: true }),
  end_time_utc: timestamp("end_time_utc", { withTimezone: true }),
  timezone: text("timezone").notNull(),
  status: bookingStatusEnum("status").default("pending_payment").notNull(),
  availability: jsonb("availability"),
  full_name: text("full_name"),
  email: text("email"),
  phone: text("phone"),
  birth_date: text("birth_date"),
  birth_time: text("birth_time").default("00:00").notNull(),
  birth_place: text("birth_place"),
  birth_place_name: text("birth_place_name"),
  birth_lat: doublePrecision("birth_lat"),
  birth_lng: doublePrecision("birth_lng"),
  birth_timezone: text("birth_timezone"),
  consent_given: boolean("consent_given").default(false).notNull(),
  intake: jsonb("intake"),
  intake_snapshot: jsonb("intake_snapshot"),
  join_url: text("join_url"),
  start_url: text("start_url"),
  notes: text("notes"),
  archived: boolean("archived").default(false).notNull(),
  archived_at: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => ({
  userStartIdx: index("bookings_user_start_idx").on(table.user_id, table.start_time_utc),
  statusStartIdx: index("bookings_status_start_idx").on(table.status, table.start_time_utc),
  userEventUnique: uniqueIndex("bookings_user_type_event_uidx")
    .on(table.user_id, table.booking_type_id, table.event_key)
    .where(sql`${table.event_key} is not null`),
  eventKeyIdx: index("bookings_event_key_idx").on(table.event_key, table.status),
}));

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  booking_id: uuid("booking_id").references(() => bookings.id),
  entity_type: text("entity_type").notNull(),
  entity_id: text("entity_id").notNull(),
  amount_cents: integer("amount_cents").notNull(),
  currency: text("currency").notNull(),
  status: text("status").default("pending").notNull(),
  provider: text("provider").default("stripe").notNull(),
  provider_payment_intent_id: text("provider_payment_intent_id"),
  provider_customer_id: text("provider_customer_id"),
  metadata: jsonb("metadata"),
  ...timestamps,
}, (table) => ({
  userCreatedIdx: index("payments_user_created_idx").on(table.user_id, table.created_at),
  statusCreatedIdx: index("payments_status_created_idx").on(table.status, table.created_at),
  bookingIdx: index("payments_booking_idx").on(table.booking_id),
  entityIdx: index("payments_entity_idx").on(table.entity_type, table.entity_id),
  providerPaymentIntentUnique: uniqueIndex("payments_provider_payment_intent_uidx")
    .on(table.provider_payment_intent_id)
    .where(sql`${table.provider_payment_intent_id} is not null`),
}));

export const stripeCustomers = pgTable("stripe_customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  stripe_customer_id: text("stripe_customer_id").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: uniqueIndex("stripe_customers_user_uidx").on(table.user_id),
  customerIdx: uniqueIndex("stripe_customers_customer_uidx").on(table.stripe_customer_id),
}));

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  stripe_subscription_id: text("stripe_subscription_id"),
  stripe_customer_id: text("stripe_customer_id"),
  tier: text("tier"),
  status: text("status").default("incomplete").notNull(),
  cancel_at_period_end: boolean("cancel_at_period_end").default(false).notNull(),
  current_period_end: timestamp("current_period_end", { withTimezone: true }),
  metadata: jsonb("metadata"),
  archived: boolean("archived").default(false).notNull(),
  archived_at: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => ({
  stripeSubscriptionIdx: uniqueIndex("subscriptions_stripe_subscription_uidx").on(table.stripe_subscription_id),
  userCreatedIdx: index("subscriptions_user_created_idx").on(table.user_id, table.created_at),
  statusPeriodIdx: index("subscriptions_status_period_idx").on(table.status, table.current_period_end),
}));

export const regenerationSubscriptions = pgTable("regeneration_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  stripe_customer_id: text("stripe_customer_id"),
  stripe_subscription_id: text("stripe_subscription_id"),
  stripe_price_id: text("stripe_price_id"),
  stripe_checkout_session_id: text("stripe_checkout_session_id"),
  status: text("status").default("inactive").notNull(),
  access_state: text("access_state").default("inactive").notNull(),
  current_period_start: timestamp("current_period_start", { withTimezone: true }),
  current_period_end: timestamp("current_period_end", { withTimezone: true }),
  cancel_at_period_end: boolean("cancel_at_period_end").default(false).notNull(),
  canceled_at: timestamp("canceled_at", { withTimezone: true }),
  ended_at: timestamp("ended_at", { withTimezone: true }),
  priority_support: boolean("priority_support").default(false).notNull(),
  is_admin_override: boolean("is_admin_override").default(false).notNull(),
  override_expires_at: timestamp("override_expires_at", { withTimezone: true }),
  last_payment_failed_at: timestamp("last_payment_failed_at", { withTimezone: true }),
  last_checkout_started_at: timestamp("last_checkout_started_at", { withTimezone: true }),
  last_reconciled_at: timestamp("last_reconciled_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  ...timestamps,
}, (table) => ({
  userIdx: uniqueIndex("regeneration_subscriptions_user_uidx").on(table.user_id),
  stripeSubscriptionIdx: uniqueIndex("regeneration_subscriptions_stripe_subscription_uidx").on(table.stripe_subscription_id),
  statusPeriodIdx: index("regeneration_subscriptions_status_period_idx").on(table.status, table.current_period_end),
  prioritySupportIdx: index("regeneration_subscriptions_priority_support_idx").on(table.priority_support, table.updated_at),
  stripeCustomerIdx: index("regeneration_subscriptions_customer_idx").on(table.stripe_customer_id),
}));

export const regenerationCheckIns = pgTable("regeneration_check_ins", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscription_id: uuid("subscription_id")
    .references(() => regenerationSubscriptions.id, { onDelete: "cascade" })
    .notNull(),
  user_id: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  week_start: date("week_start").notNull(),
  week_number: integer("week_number").notNull(),
  experiences: text("experiences"),
  changes_noticed: text("changes_noticed"),
  challenges: text("challenges"),
  admin_notes: text("admin_notes"),
  submitted_at: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  ...timestamps,
}, (table) => ({
  userWeekUnique: uniqueIndex("regeneration_check_ins_user_week_uidx").on(table.user_id, table.week_start),
  subscriptionCreatedIdx: index("regeneration_check_ins_subscription_created_idx").on(table.subscription_id, table.created_at),
  userSubmittedIdx: index("regeneration_check_ins_user_submitted_idx").on(table.user_id, table.submitted_at),
}));

export const subscriptionAdminAuditEntries = pgTable("subscription_admin_audit_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscription_kind: text("subscription_kind").notNull(),
  membership_subscription_id: uuid("membership_subscription_id").references(() => subscriptions.id, { onDelete: "cascade" }),
  regeneration_subscription_id: uuid("regeneration_subscription_id").references(() => regenerationSubscriptions.id, { onDelete: "cascade" }),
  stripe_subscription_id: text("stripe_subscription_id"),
  admin_user_id: uuid("admin_user_id").references(() => users.id, { onDelete: "set null" }),
  actor_type: text("actor_type").default("admin").notNull(),
  actor_label: text("actor_label"),
  action_type: text("action_type").notNull(),
  previous_status: text("previous_status"),
  new_status: text("new_status"),
  reason: text("reason"),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  membershipCreatedIdx: index("subscription_audit_membership_created_idx").on(table.membership_subscription_id, table.created_at),
  regenerationCreatedIdx: index("subscription_audit_regeneration_created_idx").on(table.regeneration_subscription_id, table.created_at),
  stripeCreatedIdx: index("subscription_audit_stripe_created_idx").on(table.stripe_subscription_id, table.created_at),
  actionCreatedIdx: index("subscription_audit_action_created_idx").on(table.action_type, table.created_at),
  actorCreatedIdx: index("subscription_audit_actor_created_idx").on(table.actor_type, table.created_at),
}));

export const subscriptionAdminNotes = pgTable("subscription_admin_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscription_kind: text("subscription_kind").notNull(),
  membership_subscription_id: uuid("membership_subscription_id").references(() => subscriptions.id, { onDelete: "cascade" }),
  regeneration_subscription_id: uuid("regeneration_subscription_id").references(() => regenerationSubscriptions.id, { onDelete: "cascade" }),
  stripe_subscription_id: text("stripe_subscription_id"),
  admin_user_id: uuid("admin_user_id").references(() => users.id, { onDelete: "set null" }),
  note: text("note").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  membershipCreatedIdx: index("subscription_notes_membership_created_idx").on(table.membership_subscription_id, table.created_at),
  regenerationCreatedIdx: index("subscription_notes_regeneration_created_idx").on(table.regeneration_subscription_id, table.created_at),
  stripeCreatedIdx: index("subscription_notes_stripe_created_idx").on(table.stripe_subscription_id, table.created_at),
  adminCreatedIdx: index("subscription_notes_admin_created_idx").on(table.admin_user_id, table.created_at),
}));

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").default("stripe").notNull(),
  stripe_event_id: text("stripe_event_id").notNull(),
  stripe_event_type: text("stripe_event_type").notNull(),
  payload: jsonb("payload"),
  processed_at: timestamp("processed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => ({
  stripeEventIdx: uniqueIndex("webhook_events_stripe_event_uidx").on(table.stripe_event_id),
  providerCreatedIdx: index("webhook_events_provider_created_idx").on(table.provider, table.created_at),
  processedIdx: index("webhook_events_processed_idx").on(table.processed_at),
}));

export const notificationEvents = pgTable("notification_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  event_type: text("event_type").notNull(),
  entity_id: text("entity_id").notNull(),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  recipient_type: notificationRecipientTypeEnum("recipient_type").notNull(),
  recipient: text("recipient").notNull(),
  provider: text("provider").notNull(),
  provider_message_id: text("provider_message_id"),
  template_version: text("template_version").notNull(),
  status: notificationStatusEnum("status").default("pending").notNull(),
  payload: jsonb("payload").notNull(),
  failure_reason: text("failure_reason"),
  sent_at: timestamp("sent_at", { withTimezone: true }),
  last_attempted_at: timestamp("last_attempted_at", { withTimezone: true }).defaultNow().notNull(),
  ...timestamps,
}, (table) => ({
  uniqueDeliveryKey: uniqueIndex("notification_events_event_entity_recipient_uidx").on(
    table.event_type,
    table.entity_id,
    table.recipient_type,
  ),
  statusAttemptedIdx: index("notification_events_status_attempted_idx").on(table.status, table.last_attempted_at),
  recipientTypeSentIdx: index("notification_events_recipient_type_sent_idx").on(table.recipient_type, table.sent_at),
}));

export const notificationSettings = pgTable("notification_settings", {
  id: text("id").primaryKey(),
  enabled_events: jsonb("enabled_events").notNull(),
  admin_recipients: jsonb("admin_recipients"),
  ...timestamps,
}, (table) => ({
  createdIdx: index("notification_settings_created_idx").on(table.created_at),
}));

export const seoSettings = pgTable("seo_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  page_key: text("page_key").notNull(),
  title: text("title"),
  meta_description: text("meta_description"),
  keywords: jsonb("keywords").$type<SeoKeywordBuckets>().default({ primary: [], secondary: [] }).notNull(),
  og_image: text("og_image"),
  robots_index: boolean("robots_index").default(true).notNull(),
  ...timestamps,
}, (table) => ({
  pageKeyUnique: uniqueIndex("seo_settings_page_key_uidx").on(table.page_key),
  createdIdx: index("seo_settings_created_idx").on(table.created_at),
}));

export const seoAudits = pgTable("seo_audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  initiated_by: uuid("initiated_by").references(() => users.id, { onDelete: "set null" }),
  scope: text("scope").notNull(),
  mode: text("mode").default("full").notNull(),
  status: seoAuditStatusEnum("status").default("pending").notNull(),
  summary_json: jsonb("summary_json").$type<SeoAuditSummaryJson>(),
  completed_at: timestamp("completed_at", { withTimezone: true }),
  failure_reason: text("failure_reason"),
  ...timestamps,
}, (table) => ({
  statusCreatedIdx: index("seo_audits_status_created_idx").on(table.status, table.created_at),
  initiatedByCreatedIdx: index("seo_audits_initiated_by_created_idx").on(table.initiated_by, table.created_at),
}));

export const seoAuditItems = pgTable("seo_audit_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  audit_id: uuid("audit_id")
    .references(() => seoAudits.id, { onDelete: "cascade" })
    .notNull(),
  page_key: text("page_key").notNull(),
  issue_type: text("issue_type").notNull(),
  severity: seoAuditSeverityEnum("severity").notNull(),
  description: text("description").notNull(),
  detected_value: jsonb("detected_value").$type<SeoRecommendationValue>(),
  recommended_value: jsonb("recommended_value").$type<SeoRecommendationValue>(),
  ...timestamps,
}, (table) => ({
  auditSeverityIdx: index("seo_audit_items_audit_severity_idx").on(table.audit_id, table.severity, table.created_at),
  pageIssueIdx: index("seo_audit_items_page_issue_idx").on(table.page_key, table.issue_type, table.created_at),
}));

export const seoRecommendations = pgTable("seo_recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  audit_id: uuid("audit_id").references(() => seoAudits.id, { onDelete: "set null" }),
  page_key: text("page_key").notNull(),
  type: seoRecommendationTypeEnum("type").notNull(),
  reason: text("reason"),
  expected_outcome: text("expected_outcome"),
  current_snapshot: jsonb("current_snapshot").$type<SeoRecommendationSnapshot>().notNull(),
  suggested_snapshot: jsonb("suggested_snapshot").$type<SeoRecommendationSnapshot>().notNull(),
  field: seoRecommendationFieldEnum("field"),
  current_value: jsonb("current_value").$type<SeoRecommendationValue>(),
  suggested_value: jsonb("suggested_value").$type<SeoRecommendationValue>(),
  edited_value: jsonb("edited_value").$type<SeoRecommendationValue>(),
  reasoning: text("reasoning"),
  expected_impact: text("expected_impact"),
  action: seoRecommendationActionEnum("action").default("update").notNull(),
  impact: seoRecommendationImpactEnum("impact"),
  admin_impact_override: seoRecommendationImpactEnum("admin_impact_override"),
  intent: seoIntentEnum("intent"),
  confidence: doublePrecision("confidence").default(0).notNull(),
  confidence_score: doublePrecision("confidence_score").default(0).notNull(),
  source: seoRecommendationSourceEnum("source").notNull(),
  status: seoRecommendationStatusEnum("status").default("pending").notNull(),
  dedupe_hash: text("dedupe_hash"),
  model_name: text("model_name"),
  version: integer("version").default(1).notNull(),
  reviewed_at: timestamp("reviewed_at", { withTimezone: true }),
  reviewed_by: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  resolved_at: timestamp("resolved_at", { withTimezone: true }),
  last_recommendation_at: timestamp("last_recommendation_at", { withTimezone: true }).defaultNow().notNull(),
  ...timestamps,
}, (table) => ({
  auditPageStatusIdx: index("seo_recommendations_audit_page_status_idx").on(table.audit_id, table.page_key, table.status, table.created_at),
  pageStatusCreatedIdx: index("seo_recommendations_page_status_created_idx").on(table.page_key, table.status, table.created_at),
  statusCreatedIdx: index("seo_recommendations_status_created_idx").on(table.status, table.created_at),
  dedupeHashIdx: index("seo_recommendations_dedupe_hash_idx").on(table.dedupe_hash, table.created_at),
  reviewedByIdx: index("seo_recommendations_reviewed_by_idx").on(table.reviewed_by, table.reviewed_at),
}));

export const seoRecommendationApplyHistory = pgTable("seo_recommendation_apply_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  recommendation_id: uuid("recommendation_id")
    .references(() => seoRecommendations.id, { onDelete: "cascade" })
    .notNull(),
  page_key: text("page_key").notNull(),
  previous_value: jsonb("previous_value").$type<SeoRecommendationSnapshot>().notNull(),
  new_value: jsonb("new_value").$type<SeoRecommendationSnapshot>().notNull(),
  applied_at: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),
  applied_by: uuid("applied_by").references(() => users.id, { onDelete: "set null" }),
}, (table) => ({
  recommendationIdx: index("seo_recommendation_apply_history_recommendation_idx").on(table.recommendation_id),
  pageAppliedIdx: index("seo_recommendation_apply_history_page_applied_idx").on(table.page_key, table.applied_at),
  appliedByIdx: index("seo_recommendation_apply_history_applied_by_idx").on(table.applied_by, table.applied_at),
}));

export const seoChangesLog = pgTable("seo_changes_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  recommendation_id: uuid("recommendation_id").references(() => seoRecommendations.id, { onDelete: "set null" }),
  page_key: text("page_key").notNull(),
  field: seoRecommendationFieldEnum("field").notNull(),
  old_value: jsonb("old_value").$type<SeoRecommendationValue>(),
  new_value: jsonb("new_value").$type<SeoRecommendationValue>(),
  source: seoChangeSourceEnum("source").notNull(),
  applied_by: uuid("applied_by").references(() => users.id, { onDelete: "set null" }),
  applied_at: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pageAppliedIdx: index("seo_changes_log_page_applied_idx").on(table.page_key, table.applied_at),
  recommendationIdx: index("seo_changes_log_recommendation_idx").on(table.recommendation_id, table.applied_at),
  appliedByIdx: index("seo_changes_log_applied_by_idx").on(table.applied_by, table.applied_at),
}));

export const seoReports = pgTable("seo_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  audit_id: uuid("audit_id")
    .references(() => seoAudits.id, { onDelete: "cascade" })
    .notNull(),
  report_json: jsonb("report_json").$type<SeoReportJson>().notNull(),
  pdf_url: text("pdf_url"),
  ...timestamps,
}, (table) => ({
  auditCreatedIdx: index("seo_reports_audit_created_idx").on(table.audit_id, table.created_at),
}));

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  client_id: uuid("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  stripe_payment_link: text("stripe_payment_link"),
  stripe_payment_link_id: text("stripe_payment_link_id"),
  stripe_product_id: text("stripe_product_id"),
  stripe_price_id: text("stripe_price_id"),
  stripe_checkout_session_id: text("stripe_checkout_session_id"),
  stripe_payment_intent_id: text("stripe_payment_intent_id"),
  stripe_subscription_id: text("stripe_subscription_id"),
  product_type: invoiceProductTypeEnum("product_type").notNull(),
  label: text("label").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").default("CAD").notNull(),
  billing_mode: invoiceBillingModeEnum("billing_mode").notNull(),
  status: invoiceStatusEnum("status").default("pending").notNull(),
  consumed_at: timestamp("consumed_at", { withTimezone: true }),
  expires_at: timestamp("expires_at", { withTimezone: true }),
  failure_code: text("failure_code"),
  failure_message: text("failure_message"),
  failure_message_normalized: text("failure_message_normalized"),
  last_payment_attempt_at: timestamp("last_payment_attempt_at", { withTimezone: true }),
  paid_at: timestamp("paid_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  ...timestamps,
}, (table) => ({
  userCreatedIdx: index("invoices_user_created_idx").on(table.user_id, table.created_at),
  clientCreatedIdx: index("invoices_client_created_idx").on(table.client_id, table.created_at),
  statusCreatedIdx: index("invoices_status_created_idx").on(table.status, table.created_at),
  paymentLinkIdx: uniqueIndex("invoices_payment_link_uidx").on(table.stripe_payment_link_id),
  checkoutSessionIdx: index("invoices_checkout_session_idx").on(table.stripe_checkout_session_id),
  paymentIntentIdx: index("invoices_payment_intent_idx").on(table.stripe_payment_intent_id),
  subscriptionIdx: index("invoices_subscription_idx").on(table.stripe_subscription_id),
}));

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  client_id: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  invoice_id: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  subscription_id: text("subscription_id"),
  type: persistedOrderTypeEnum("type").notNull(),
  label: text("label").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").default("CAD").notNull(),
  status: persistedOrderStatusEnum("status").default("pending").notNull(),
  payment_reference: text("payment_reference"),
  stripe_payment_intent_id: text("stripe_payment_intent_id"),
  stripe_subscription_id: text("stripe_subscription_id"),
  stripe_invoice_id: text("stripe_invoice_id"),
  stripe_invoice_url: text("stripe_invoice_url"),
  stripe_invoice_status: text("stripe_invoice_status"),
  refunded_at: timestamp("refunded_at", { withTimezone: true }),
  refund_reason: orderRefundReasonEnum("refund_reason"),
  refund_note: text("refund_note"),
  failure_code: text("failure_code"),
  failure_message: text("failure_message"),
  failure_message_normalized: text("failure_message_normalized"),
  recording_link: text("recording_link"),
  recording_added_at: timestamp("recording_added_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  archived: boolean("archived").default(false).notNull(),
  archived_at: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => ({
  userCreatedIdx: index("orders_user_created_idx").on(table.user_id, table.created_at),
  clientCreatedIdx: index("orders_client_created_idx").on(table.client_id, table.created_at),
  invoiceCreatedIdx: index("orders_invoice_created_idx").on(table.invoice_id, table.created_at),
  subscriptionCreatedIdx: index("orders_subscription_created_idx").on(table.subscription_id, table.created_at),
  paymentReferenceIdx: uniqueIndex("orders_payment_reference_uidx").on(table.payment_reference),
}));

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  client_id: uuid("client_id").references(() => clients.id),
  user_id: uuid("user_id").references(() => users.id),
  /** Base report container for a single blueprint; latest tier run also syncs here for backwards compatibility. */
  status: text("status").default("draft").notNull(),
  member_status: reportMemberStatusEnum("member_status").default("pending_payment").notNull(),
  purchase_intake: jsonb("purchase_intake"),
  birth_place_name: text("birth_place_name"),
  birth_lat: doublePrecision("birth_lat"),
  birth_lng: doublePrecision("birth_lng"),
  birth_timezone: text("birth_timezone"),
  blueprint_data: jsonb("blueprint_data"),
  /** Structured sections: `{ sections: InterpretationReport }` or legacy flat shape */
  generated_report: jsonb("generated_report"),
  /** Canonical markdown for exports and stable rendering */
  full_markdown: text("full_markdown"),
  interpretation_tier: text("interpretation_tier").default("intro").notNull(),
  display_title: text("display_title"),
  systems_used: jsonb("systems_used"),
  meta: jsonb("meta"),
  admin_notes: text("admin_notes"),
  archived: boolean("archived").default(false).notNull(),
  archived_at: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => ({
  userCreatedIdx: index("reports_user_created_idx").on(table.user_id, table.created_at),
  memberStatusCreatedIdx: index("reports_member_status_created_idx").on(table.member_status, table.created_at),
}));

export const mentorTrainingOrders = pgTable("mentor_training_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  package_type: mentorTrainingPackageEnum("package_type").notNull(),
  status: mentorTrainingStatusEnum("status").default("pending_payment").notNull(),
  timezone: text("timezone"),
  location_input: text("location_input"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  eligibility_verified_at: timestamp("eligibility_verified_at", { withTimezone: true }).defaultNow().notNull(),
  archived: boolean("archived").default(false).notNull(),
  archived_at: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => ({
  userCreatedIdx: index("mentor_training_orders_user_created_idx").on(table.user_id, table.created_at),
  statusCreatedIdx: index("mentor_training_orders_status_created_idx").on(table.status, table.created_at),
  userPackagePendingUnique: uniqueIndex("mentor_training_orders_user_package_pending_uidx")
    .on(table.user_id, table.package_type)
    .where(sql`${table.status} = 'pending_payment'`),
}));

export const courseEntitlements = pgTable("course_entitlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  course_slug: text("course_slug").notNull(),
  stripe_checkout_session_id: text("stripe_checkout_session_id"),
  stripe_payment_intent_id: text("stripe_payment_intent_id"),
  order_id: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  purchased_at: timestamp("purchased_at", { withTimezone: true }),
  revoked_at: timestamp("revoked_at", { withTimezone: true }),
  ...timestamps,
}, (table) => ({
  userCourseUnique: uniqueIndex("course_entitlements_user_course_uidx").on(table.user_id, table.course_slug),
  userActiveIdx: index("course_entitlements_user_active_idx").on(table.user_id, table.revoked_at),
  coursePurchasedIdx: index("course_entitlements_course_purchased_idx").on(table.course_slug, table.purchased_at),
  checkoutSessionIdx: index("course_entitlements_checkout_session_idx").on(table.stripe_checkout_session_id),
  paymentIntentIdx: index("course_entitlements_payment_intent_idx").on(table.stripe_payment_intent_id),
}));

export const courseLessonProgress = pgTable("course_lesson_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  course_slug: text("course_slug").notNull(),
  lesson_id: text("lesson_id").notNull(),
  completed_at: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
  ...timestamps,
}, (table) => ({
  userCourseLessonUnique: uniqueIndex("course_lesson_progress_user_course_lesson_uidx").on(table.user_id, table.course_slug, table.lesson_id),
  userCourseCompletedIdx: index("course_lesson_progress_user_course_completed_idx").on(table.user_id, table.course_slug, table.completed_at),
}));

export const promoCodes = pgTable("promo_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull(),
  discount_type: promoDiscountTypeEnum("discount_type").default("percentage").notNull(),
  discount_value: integer("discount_value").notNull(),
  discount_currency: text("discount_currency"),
  discount_duration_months: integer("discount_duration_months"),
  active: boolean("active").default(true).notNull(),
  expires_at: timestamp("expires_at", { withTimezone: true }),
  usage_limit: integer("usage_limit"),
  times_used: integer("times_used").default(0).notNull(),
  applies_to: jsonb("applies_to").$type<PromoTarget[] | null>(),
  applies_to_billing: promoBillingScopeEnum("applies_to_billing").$type<PromoBillingScope | null>(),
  min_amount_cents: integer("min_amount_cents"),
  first_time_only: boolean("first_time_only").default(false).notNull(),
  once_per_customer: boolean("once_per_customer").default(false).notNull(),
  campaign: text("campaign"),
  stripe_coupon_id: text("stripe_coupon_id").notNull(),
  stripe_promotion_code_id: text("stripe_promotion_code_id").notNull(),
  sync_status: promoSyncStatusEnum("sync_status").default("needs_sync").notNull(),
  last_validated_at: timestamp("last_validated_at", { withTimezone: true }),
  last_validation_ok: boolean("last_validation_ok"),
  last_validation_snapshot: jsonb("last_validation_snapshot").$type<PromoValidationSnapshot | null>(),
  validation_failure_code: text("validation_failure_code"),
  validation_failure_message: text("validation_failure_message"),
  metadata: jsonb("metadata"),
  archived_at: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => ({
  codeUnique: uniqueIndex("promo_codes_code_uidx").on(table.code),
  stripeCouponUnique: uniqueIndex("promo_codes_stripe_coupon_uidx").on(table.stripe_coupon_id),
  stripePromotionUnique: uniqueIndex("promo_codes_stripe_promotion_uidx").on(table.stripe_promotion_code_id),
  activeCreatedIdx: index("promo_codes_active_created_idx").on(table.active, table.created_at),
  syncStatusUpdatedIdx: index("promo_codes_sync_status_updated_idx").on(table.sync_status, table.updated_at),
}));

export const promoCodeUsages = pgTable("promo_code_usages", {
  id: uuid("id").primaryKey().defaultRandom(),
  promo_code_id: uuid("promo_code_id")
    .references(() => promoCodes.id, { onDelete: "cascade" })
    .notNull(),
  payment_id: uuid("payment_id")
    .references(() => payments.id, { onDelete: "cascade" })
    .notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  promoPaymentUnique: uniqueIndex("promo_code_usages_promo_payment_uidx").on(table.promo_code_id, table.payment_id),
  promoCreatedIdx: index("promo_code_usages_promo_created_idx").on(table.promo_code_id, table.created_at),
}));

export const promoCodeChangesLog = pgTable("promo_code_changes_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  promo_code_id: uuid("promo_code_id")
    .references(() => promoCodes.id, { onDelete: "cascade" })
    .notNull(),
  field_changed: text("field_changed").notNull(),
  old_value: jsonb("old_value"),
  new_value: jsonb("new_value"),
  changed_by: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
  changed_at: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  promoChangedIdx: index("promo_code_changes_log_promo_changed_idx").on(table.promo_code_id, table.changed_at),
  changedByIdx: index("promo_code_changes_log_changed_by_idx").on(table.changed_by, table.changed_at),
}));

export const mentoringCircleRegistrations = pgTable("mentoring_circle_registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  event_key: text("event_key").notNull(),
  event_title: text("event_title").notNull(),
  event_start_at: timestamp("event_start_at", { withTimezone: true }).notNull(),
  timezone: text("timezone").notNull(),
  status: text("status").default("registered").notNull(),
  join_url: text("join_url").notNull(),
  archived: boolean("archived").default(false).notNull(),
  archived_at: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => ({
  userEventUnique: uniqueIndex("mentoring_circle_registrations_user_event_uidx").on(table.user_id, table.event_key),
  eventStartIdx: index("mentoring_circle_registrations_event_start_idx").on(table.event_start_at, table.status),
}));

export const conversationThreads = pgTable("conversation_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: text("user_id").notNull(),
  title: text("title").notNull(),
  is_archived: boolean("is_archived").default(false).notNull(),
  summary: text("summary"),
  search_text: text("search_text"),
  meta: jsonb("meta"),
  ...timestamps,
}, (table) => ({
  userUpdatedIdx: index("conversation_threads_user_updated_idx").on(table.user_id, table.updated_at),
  searchTextIdx: index("conversation_threads_search_text_idx").on(table.search_text),
}));

export const conversationMessages = pgTable("conversation_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  thread_id: uuid("thread_id")
    .references(() => conversationThreads.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  meta: jsonb("meta"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  threadCreatedIdx: index("conversation_messages_thread_created_idx").on(table.thread_id, table.created_at),
}));

export const insights = pgTable("insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  thread_id: uuid("thread_id")
    .references(() => conversationThreads.id, { onDelete: "cascade" })
    .notNull(),
  // Text user IDs keep admin-temp Divin8 threads compatible until member auth is wired in.
  user_id: text("user_id").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  confidence: text("confidence").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  threadCreatedIdx: index("insights_thread_created_idx").on(table.thread_id, table.created_at),
  userCreatedIdx: index("insights_user_created_idx").on(table.user_id, table.created_at),
  categoryCreatedIdx: index("insights_category_created_idx").on(table.category, table.created_at),
}));

export const conversationTimelineEvents = pgTable("conversation_timeline_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  thread_id: uuid("thread_id")
    .references(() => conversationThreads.id, { onDelete: "cascade" })
    .notNull(),
  user_id: text("user_id").notNull(),
  summary: text("summary").notNull(),
  systems_used: jsonb("systems_used"),
  tags: jsonb("tags"),
  type: text("type").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  threadCreatedIdx: index("conversation_timeline_events_thread_created_idx").on(table.thread_id, table.created_at),
  userCreatedIdx: index("conversation_timeline_events_user_created_idx").on(table.user_id, table.created_at),
  typeCreatedIdx: index("conversation_timeline_events_type_created_idx").on(table.type, table.created_at),
}));

export const conversationMemories = pgTable("conversation_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversation_id: uuid("conversation_id")
    .references(() => conversationThreads.id, { onDelete: "cascade" })
    .notNull(),
  user_id: text("user_id").notNull(),
  type: text("type").notNull(),
  content: text("content").notNull(),
  relevance_score: doublePrecision("relevance_score").default(0.5).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => ({
  conversationCreatedIdx: index("conversation_memories_conversation_created_idx").on(table.conversation_id, table.created_at),
  userCreatedIdx: index("conversation_memories_user_created_idx").on(table.user_id, table.created_at),
  userTypeCreatedIdx: index("conversation_memories_user_type_created_idx").on(table.user_id, table.type, table.created_at),
  conversationTypeContentUnique: uniqueIndex("conversation_memories_conversation_type_content_uidx")
    .on(table.conversation_id, table.type, table.content),
}));

export const divin8KnowledgeSources = pgTable("divin8_knowledge_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  authority_level: text("authority_level").notNull(),
  status: text("status").default("uploading").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  current_version_id: uuid("current_version_id"),
  current_version_label: text("current_version_label"),
  original_filename: text("original_filename").notNull(),
  mime_type: text("mime_type").notNull(),
  file_size: integer("file_size").default(0).notNull(),
  source_path: text("source_path"),
  content_hash: text("content_hash"),
  last_processed_at: timestamp("last_processed_at", { withTimezone: true }),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_by: text("created_by"),
  updated_by: text("updated_by"),
  ...timestamps,
}, (table) => ({
  statusUpdatedIdx: index("divin8_knowledge_sources_status_updated_idx").on(table.status, table.updated_at),
  categoryAuthorityIdx: index("divin8_knowledge_sources_category_authority_idx").on(table.category, table.authority_level),
  enabledUpdatedIdx: index("divin8_knowledge_sources_enabled_updated_idx").on(table.enabled, table.updated_at),
}));

export const divin8KnowledgeSourceVersions = pgTable("divin8_knowledge_source_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  source_id: uuid("source_id")
    .references(() => divin8KnowledgeSources.id, { onDelete: "cascade" })
    .notNull(),
  version_number: integer("version_number").notNull(),
  version_label: text("version_label").notNull(),
  status: text("status").default("uploading").notNull(),
  source_path: text("source_path"),
  original_filename: text("original_filename").notNull(),
  mime_type: text("mime_type").notNull(),
  file_size: integer("file_size").default(0).notNull(),
  content_hash: text("content_hash"),
  extracted_text_hash: text("extracted_text_hash"),
  failure_reason: text("failure_reason"),
  processed_at: timestamp("processed_at", { withTimezone: true }),
  created_by: text("created_by"),
  ...timestamps,
}, (table) => ({
  sourceVersionUnique: uniqueIndex("divin8_knowledge_source_versions_source_version_uidx")
    .on(table.source_id, table.version_number),
  sourceStatusIdx: index("divin8_knowledge_source_versions_source_status_idx").on(table.source_id, table.status),
  processedIdx: index("divin8_knowledge_source_versions_processed_idx").on(table.processed_at),
}));

export const divin8KnowledgeExtractedTexts = pgTable("divin8_knowledge_extracted_texts", {
  id: uuid("id").primaryKey().defaultRandom(),
  source_id: uuid("source_id")
    .references(() => divin8KnowledgeSources.id, { onDelete: "cascade" })
    .notNull(),
  version_id: uuid("version_id")
    .references(() => divin8KnowledgeSourceVersions.id, { onDelete: "cascade" })
    .notNull(),
  extracted_text: text("extracted_text").notNull(),
  text_hash: text("text_hash").notNull(),
  ...timestamps,
}, (table) => ({
  versionUnique: uniqueIndex("divin8_knowledge_extracted_texts_version_uidx").on(table.version_id),
  sourceIdx: index("divin8_knowledge_extracted_texts_source_idx").on(table.source_id),
}));

export const divin8KnowledgeChunks = pgTable("divin8_knowledge_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  source_id: uuid("source_id")
    .references(() => divin8KnowledgeSources.id, { onDelete: "cascade" })
    .notNull(),
  version_id: uuid("version_id")
    .references(() => divin8KnowledgeSourceVersions.id, { onDelete: "cascade" })
    .notNull(),
  category: text("category").notNull(),
  authority_level: text("authority_level").notNull(),
  chunk_index: integer("chunk_index").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  keywords: jsonb("keywords"),
  concepts: jsonb("concepts"),
  metadata: jsonb("metadata"),
  enabled: boolean("enabled").default(true).notNull(),
  ...timestamps,
}, (table) => ({
  sourceVersionIdx: index("divin8_knowledge_chunks_source_version_idx").on(table.source_id, table.version_id),
  categoryAuthorityIdx: index("divin8_knowledge_chunks_category_authority_idx").on(table.category, table.authority_level),
  enabledUpdatedIdx: index("divin8_knowledge_chunks_enabled_updated_idx").on(table.enabled, table.updated_at),
}));

export const divin8CanonicalConcepts = pgTable("divin8_canonical_concepts", {
  id: uuid("id").primaryKey().defaultRandom(),
  source_id: uuid("source_id").references(() => divin8KnowledgeSources.id, { onDelete: "set null" }),
  version_id: uuid("version_id").references(() => divin8KnowledgeSourceVersions.id, { onDelete: "set null" }),
  chunk_id: uuid("chunk_id").references(() => divin8KnowledgeChunks.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  concept_key: text("concept_key").notNull(),
  display_name: text("display_name").notNull(),
  canonical_meanings: jsonb("canonical_meanings"),
  forbidden_interpretations: jsonb("forbidden_interpretations"),
  preferred_terms: jsonb("preferred_terms"),
  replacement_rules: jsonb("replacement_rules"),
  authority_level: text("authority_level").notNull(),
  priority: integer("priority").default(0).notNull(),
  source_kind: text("source_kind").default("extracted").notNull(),
  active: boolean("active").default(true).notNull(),
  created_by: text("created_by"),
  updated_by: text("updated_by"),
  ...timestamps,
}, (table) => ({
  categoryConceptIdx: index("divin8_canonical_concepts_category_concept_idx").on(table.category, table.concept_key),
  activePriorityIdx: index("divin8_canonical_concepts_active_priority_idx").on(table.active, table.priority),
  sourceIdx: index("divin8_canonical_concepts_source_idx").on(table.source_id),
}));

export const divin8KnowledgeOverrides = pgTable("divin8_knowledge_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  source_id: uuid("source_id").references(() => divin8KnowledgeSources.id, { onDelete: "set null" }),
  version_id: uuid("version_id").references(() => divin8KnowledgeSourceVersions.id, { onDelete: "set null" }),
  concept_id: uuid("concept_id").references(() => divin8CanonicalConcepts.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  rule_key: text("rule_key").notNull(),
  always_use: text("always_use"),
  never_use: jsonb("never_use"),
  replacements: jsonb("replacements"),
  authority_level: text("authority_level").default("hard_override").notNull(),
  priority: integer("priority").default(100).notNull(),
  active: boolean("active").default(true).notNull(),
  source_kind: text("source_kind").default("manual").notNull(),
  created_by: text("created_by"),
  updated_by: text("updated_by"),
  ...timestamps,
}, (table) => ({
  categoryRuleIdx: index("divin8_knowledge_overrides_category_rule_idx").on(table.category, table.rule_key),
  activePriorityIdx: index("divin8_knowledge_overrides_active_priority_idx").on(table.active, table.priority),
  conceptIdx: index("divin8_knowledge_overrides_concept_idx").on(table.concept_id),
}));

export const divin8KnowledgeAuditLogs = pgTable("divin8_knowledge_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  admin_user_id: text("admin_user_id").notNull(),
  action_type: text("action_type").notNull(),
  source_id: uuid("source_id").references(() => divin8KnowledgeSources.id, { onDelete: "set null" }),
  version_id: uuid("version_id").references(() => divin8KnowledgeSourceVersions.id, { onDelete: "set null" }),
  concept_id: uuid("concept_id").references(() => divin8CanonicalConcepts.id, { onDelete: "set null" }),
  override_id: uuid("override_id").references(() => divin8KnowledgeOverrides.id, { onDelete: "set null" }),
  before: jsonb("before"),
  after: jsonb("after"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  adminCreatedIdx: index("divin8_knowledge_audit_logs_admin_created_idx").on(table.admin_user_id, table.created_at),
  actionCreatedIdx: index("divin8_knowledge_audit_logs_action_created_idx").on(table.action_type, table.created_at),
  sourceCreatedIdx: index("divin8_knowledge_audit_logs_source_created_idx").on(table.source_id, table.created_at),
}));

export const reportTierOutputs = pgTable(
  "report_tier_outputs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    report_id: uuid("report_id")
      .references(() => reports.id, { onDelete: "cascade" })
      .notNull(),
    tier: text("tier").notNull(),
    status: text("status").default("draft").notNull(),
    systems_config: jsonb("systems_config").notNull(),
    model_name: text("model_name").notNull(),
    reasoning_effort: text("reasoning_effort").notNull(),
    prompt_version: text("prompt_version").default("v1").notNull(),
    generated_report: jsonb("generated_report"),
    full_markdown: text("full_markdown"),
    display_title: text("display_title"),
    error_message: text("error_message"),
    ...timestamps,
  },
  (table) => ({
    reportTierUnique: uniqueIndex("report_tier_outputs_report_tier_uidx").on(table.report_id, table.tier),
  }),
);

export const recordings = pgTable("recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  booking_id: uuid("booking_id")
    .references(() => bookings.id)
    .notNull(),
  file_url: text("file_url"),
  ...timestamps,
});

export const shopProducts = pgTable("shop_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  status: shopProductStatusEnum("status").default("draft").notNull(),
  is_active: boolean("is_active").default(false).notNull(),
  featured: boolean("featured").default(false).notNull(),
  sort_order: integer("sort_order").default(0).notNull(),
  price_cents: integer("price_cents").notNull(),
  currency: text("currency").default("CAD").notNull(),
  stripe_product_id: text("stripe_product_id"),
  stripe_price_id: text("stripe_price_id"),
  format_label: text("format_label").default("Digital Edition").notNull(),
  subtitle: text("subtitle"),
  quick_summary: text("quick_summary"),
  full_description: text("full_description"),
  included_items: text("included_items"),
  video_url: text("video_url"),
  video_heading: text("video_heading"),
  video_intro: text("video_intro"),
  wellness_notice: text("wellness_notice"),
  collection: text("collection"),
  fulfillment_type: text("fulfillment_type"),
  fulfillment_download_url: text("fulfillment_download_url"),
  fulfillment_download_label: text("fulfillment_download_label"),
  fulfillment_email_enabled: boolean("fulfillment_email_enabled").default(true).notNull(),
  fulfillment_instructions: text("fulfillment_instructions"),
  ...timestamps,
}, (table) => ({
  slugUnique: uniqueIndex("shop_products_slug_uidx").on(table.slug),
  activeSortIdx: index("shop_products_active_sort_idx").on(table.is_active, table.sort_order, table.created_at),
  statusSortIdx: index("shop_products_status_sort_idx").on(table.status, table.sort_order),
  collectionIdx: index("shop_products_collection_idx").on(table.collection),
}));

export const shopProductImages = pgTable("shop_product_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  product_id: uuid("product_id")
    .references(() => shopProducts.id, { onDelete: "cascade" })
    .notNull(),
  storage_key: text("storage_key").notNull(),
  alt_text: text("alt_text"),
  sort_order: integer("sort_order").default(0).notNull(),
  is_primary: boolean("is_primary").default(false).notNull(),
  mime_type: text("mime_type"),
  size_bytes: integer("size_bytes"),
  ...timestamps,
}, (table) => ({
  productSortIdx: index("shop_product_images_product_sort_idx").on(table.product_id, table.sort_order),
}));

export const shopProductFiles = pgTable("shop_product_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  product_id: uuid("product_id")
    .references(() => shopProducts.id, { onDelete: "cascade" })
    .notNull(),
  storage_key: text("storage_key").notNull(),
  display_name: text("display_name").notNull(),
  mime_type: text("mime_type"),
  size_bytes: integer("size_bytes"),
  kind: shopProductFileKindEnum("kind").default("other").notNull(),
  is_available: boolean("is_available").default(true).notNull(),
  ...timestamps,
}, (table) => ({
  productKindIdx: index("shop_product_files_product_kind_idx").on(table.product_id, table.kind),
}));

export const shopEntitlements = pgTable("shop_entitlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  product_id: uuid("product_id")
    .references(() => shopProducts.id, { onDelete: "cascade" })
    .notNull(),
  stripe_checkout_session_id: text("stripe_checkout_session_id"),
  stripe_payment_intent_id: text("stripe_payment_intent_id"),
  order_id: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  purchased_at: timestamp("purchased_at", { withTimezone: true }),
  revoked_at: timestamp("revoked_at", { withTimezone: true }),
  ...timestamps,
}, (table) => ({
  userProductUnique: uniqueIndex("shop_entitlements_user_product_uidx").on(table.user_id, table.product_id),
  userActiveIdx: index("shop_entitlements_user_active_idx").on(table.user_id, table.revoked_at),
  productPurchasedIdx: index("shop_entitlements_product_purchased_idx").on(table.product_id, table.purchased_at),
  checkoutSessionIdx: index("shop_entitlements_checkout_session_idx").on(table.stripe_checkout_session_id),
  paymentIntentIdx: index("shop_entitlements_payment_intent_idx").on(table.stripe_payment_intent_id),
}));

export const shopTestimonials = pgTable("shop_testimonials", {
  id: uuid("id").primaryKey().defaultRandom(),
  customer_name: text("customer_name").notNull(),
  location: text("location"),
  title: text("title"),
  testimonial_text: text("testimonial_text").notNull(),
  source_label: text("source_label"),
  context_label: text("context_label"),
  is_active: boolean("is_active").default(true).notNull(),
  sort_order: integer("sort_order").default(0).notNull(),
  ...timestamps,
}, (table) => ({
  activeSortIdx: index("shop_testimonials_active_sort_idx").on(table.is_active, table.sort_order, table.created_at),
}));

export const shopProductTestimonials = pgTable("shop_product_testimonials", {
  id: uuid("id").primaryKey().defaultRandom(),
  testimonial_id: uuid("testimonial_id")
    .references(() => shopTestimonials.id, { onDelete: "cascade" })
    .notNull(),
  product_id: uuid("product_id")
    .references(() => shopProducts.id, { onDelete: "cascade" }),
  product_slug: text("product_slug").notNull(),
  ...timestamps,
}, (table) => ({
  testimonialSlugUnique: uniqueIndex("shop_product_testimonials_testimonial_slug_uidx").on(table.testimonial_id, table.product_slug),
  productIdx: index("shop_product_testimonials_product_idx").on(table.product_id),
  slugIdx: index("shop_product_testimonials_slug_idx").on(table.product_slug),
}));

export const shopSettings = pgTable("shop_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  ...timestamps,
});
