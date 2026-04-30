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

export const bookingSessionTypeEnum = pgEnum("booking_session_type", [
  "focus",
  "mentoring",
  "regeneration",
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
  "custom",
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

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerk_id: text("clerk_id").unique().notNull(),
  email: text("email").notNull(),
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
