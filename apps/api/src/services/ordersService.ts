import {
  bookings,
  bookingTypes,
  clients,
  invoices,
  memberEntitlements,
  mentorTrainingOrders,
  mentoringCircleRegistrations,
  orders as persistedOrdersTable,
  payments,
  regenerationSubscriptions,
  reports,
  subscriptionAdminAuditEntries,
  subscriptionAdminNotes,
  subscriptions,
  users,
  type Database,
} from "@wisdom/db";
import { desc, eq, inArray, or, sql } from "drizzle-orm";
import { getReportTierDefinition, INTERPRETATION_SECTION_KEYS, isReportTierId, SECTION_MARKDOWN_LABELS } from "@wisdom/utils";
import { logger } from "@wisdom/utils";
import { createHttpError } from "./booking/errors.js";
import { getSectionsFromStoredReport } from "./reportFormat.js";
import type { SubscriptionActorType } from "./adminSubscriptionLifecycleService.js";
import {
  REGENERATION_MANIFESTATION_ENHANCEMENT_AMOUNT_CENTS,
  REGENERATION_MANIFESTATION_ENHANCEMENT_DURATION_DAYS,
  REGENERATION_MANIFESTATION_ENHANCEMENT_NAME,
} from "../config/regenerationBilling.js";
import { resolveStripeProductNaming } from "./stripe/stripeProductNamingService.js";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const PAYMENT_MATCH_WINDOW_MS = 6 * 60 * 60 * 1000;
const DUPLICATE_PENDING_ATTEMPT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const REGENERATION_ORDER_BOOKING_FALLBACK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type AdminOrderType = "session" | "report" | "subscription" | "webinar" | "mentor_training" | "regeneration_offer" | "custom";
export type AdminOrderStatus =
  | "unpaid"
  | "pending_payment"
  | "paid"
  | "in_progress"
  | "processing"
  | "completed"
  | "cancelled"
  | "refunded"
  | "failed";
export type OrderExecutionState = "idle" | "generating" | "awaiting_input" | "completed" | "failed";
type AdminOrderAvailabilityDay = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
type AdminOrderAvailability = Record<AdminOrderAvailabilityDay, string[]>;
type AdminOrderHealthFocusArea = {
  name: string;
  severity: number;
};
type AdminOrderManifestationEnhancement = {
  version: number;
  selected: boolean;
  status: "active" | "not_selected";
  name: string;
  duration_days: number;
  price_cents: number;
  currency: string;
  intentions: string | null;
};

export interface AdminOrderOutput {
  summary: string;
  sections: Array<{
    key: string;
    title: string;
    content: string;
  }>;
  systems_used: string[];
  generated_at: string;
  version: number;
  order_id: string | null;
  user_id: string | null;
}

export interface AdminOrderExecution {
  state: OrderExecutionState;
  report_id: string | null;
  last_generation_error: string | null;
  last_attempt_timestamp: string | null;
  generation_started_at: string | null;
  generation_completed_at: string | null;
  duration_ms: number | null;
  version: number | null;
  output: AdminOrderOutput | null;
}

export type AdminSubscriptionLifecycleStatus =
  | "active"
  | "cancel_pending"
  | "canceled"
  | "past_due"
  | "incomplete"
  | "paused"
  | "trialing"
  | "expired"
  | "grace_period"
  | "payment_failed";

export type AdminSubscriptionActionSeverity = "primary" | "secondary" | "danger";

export interface AdminSubscriptionActionRequirement {
  reason_required: boolean;
  confirmation_required: boolean;
  severity: AdminSubscriptionActionSeverity;
  disabled?: boolean;
  disabled_reason?: string | null;
}

export interface AdminSubscriptionTimelineEntry {
  id: string;
  timestamp: string;
  action: string;
  actor_type: SubscriptionActorType;
  actor_label: string | null;
  admin_user_id: string | null;
  previous_status: string | null;
  new_status: string | null;
  reason: string | null;
  source: "audit" | "note";
}

export interface AdminSubscriptionNote {
  id: string;
  note: string;
  admin_user_id: string | null;
  created_at: string;
}

export interface AdminSubscriptionDetails {
  kind: "membership" | "regeneration" | "managed_invoice" | "unknown";
  local_id: string | null;
  stripe_subscription_id: string | null;
  lifecycle_status: AdminSubscriptionLifecycleStatus;
  cancel_at_period_end: boolean;
  pause_collection: Record<string, unknown> | null;
  current_period_end: string | null;
  access_state: string | null;
  priority_support: boolean | null;
  available_actions: string[];
  action_requirements: Record<string, AdminSubscriptionActionRequirement>;
  activity: AdminSubscriptionTimelineEntry[];
  admin_notes: AdminSubscriptionNote[];
}

export interface AdminOrder {
  id: string;
  source_id: string;
  user_id: string;
  archived: boolean;
  client_name: string;
  email: string;
  type: AdminOrderType;
  status: AdminOrderStatus;
  amount: number;
  currency: string;
  product_name: string;
  stripe_payment_id: string | null;
  payment_status: string | null;
  payment_id: string | null;
  payment_provider: string | null;
  created_at: string;
  membership_tier: string | null;
  available_actions: string[];
  execution: AdminOrderExecution;
  recording_link: string | null;
  recording_added_at: string | null;
  refunded_at: string | null;
  refund_reason: string | null;
  refund_note: string | null;
  subscription?: AdminSubscriptionDetails | null;
  metadata: {
    source_status: string | null;
    source_created_at: string;
    product_name?: string | null;
    birth_date: string | null;
    birth_time: string | null;
    birth_location: string | null;
    intake: {
      birth_date: string | null;
      birth_time: string | null;
      location: string | null;
      phone: string | null;
      gender: "male" | "female" | null;
      timezone: string | null;
      consent_given: boolean | null;
      submitted_questions: string[];
      topics: string[];
      goals: string[];
      health_focus_areas: AdminOrderHealthFocusArea[];
      manifestation_intention: string | null;
      manifestation_enhancement_selected: boolean | null;
      manifestation_goals: string | null;
      manifestation_enhancement: AdminOrderManifestationEnhancement | null;
      other: string | null;
      notes: string | null;
    };
    availability: AdminOrderAvailability | null;
    report_type: string | null;
    report_type_id: string | null;
    raw_intake?: unknown;
    training_package: string | null;
    training_package_id: string | null;
    selected_systems: string[];
    delivery_status: string | null;
    session_type: string | null;
    session_type_id?: string | null;
    session_duration_minutes?: number | null;
    scheduled_at: string | null;
    meeting_link: string | null;
    plan_name: string | null;
    billing_cycle: string | null;
    renewal_date: string | null;
    event_name: string | null;
    event_date: string | null;
    access_link: string | null;
    stripe_subscription_id: string | null;
    billing_mode: string | null;
    invoice_id: string | null;
    invoice_status: string | null;
    invoice_link: string | null;
    invoice_expires_at: string | null;
    invoice_paid_at: string | null;
    invoice_consumed_at: string | null;
    stripe_invoice_id: string | null;
    stripe_invoice_url: string | null;
    stripe_invoice_status: string | null;
    order_variant: string | null;
    invoice_label: string | null;
    subscription_state: string | null;
    failure_code: string | null;
    failure_message: string | null;
    failure_message_normalized: string | null;
    last_payment_attempt_at: string | null;
    payment_match_strategy: string | null;
    payment_source?: string | null;
    payment_sync_status?: string | null;
    stripe_checkout_session_id?: string | null;
    manual_paid?: boolean | null;
    /** From payment.metadata when admin sent a Stripe recovery invoice (report checkout fallback). */
    recovery_invoice_id: string | null;
    recovery_invoice_sent_at: string | null;
    recovery_invoice_hosted_url: string | null;
    invoice_origin?: string | null;
    price_snapshot_cents?: number | null;
    price_snapshot_currency?: string | null;
    invoice_timeline?: unknown[];
  };
}

export interface AdminOrdersListResult {
  orders: AdminOrder[];
  data: AdminOrder[];
  pagination: {
    page: number;
    pageSize: number;
    limit: number;
    offset: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export type AdminOrdersGroupedByUser = Map<string, AdminOrder[]>;

interface AdminOrdersQuery {
  limit?: number;
  offset?: number;
  showArchived?: boolean;
  search?: string;
  type?: AdminOrderType | "all";
  category?: string;
  trainingPackage?: "all" | "entry" | "seeker" | "initiate";
  trainingStatus?: "all" | AdminOrderStatus;
}

interface UserRow {
  id: string;
  email: string;
}

interface ClientRow {
  id: string;
  userId: string;
  fullBirthName: string;
  createdAt: Date;
}

interface EntitlementRow {
  userId: string;
  tier: string;
  billingInterval: string;
  currentPeriodEnd: Date | null;
}

interface BookingSourceRow {
  id: string;
  userId: string;
  archived: boolean;
  sessionType: string;
  eventKey: string | null;
  startTimeUtc: Date | null;
  status: string;
  timezone: string;
  availability: unknown;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  birthTime: string | null;
  birthPlace: string | null;
  birthPlaceName: string | null;
  consentGiven: boolean;
  intake: unknown;
  intakeSnapshot: unknown;
  joinUrl: string | null;
  startUrl: string | null;
  notes: string | null;
  createdAt: Date;
  bookingTypeName: string;
  bookingDurationMinutes: number;
  bookingPriceCents: number;
  bookingCurrency: string;
}

interface ReportSourceRow {
  id: string;
  userId: string | null;
  clientId: string | null;
  archived: boolean;
  status: string;
  memberStatus: string;
  interpretationTier: string;
  displayTitle: string | null;
  systemsUsed: unknown;
  purchaseIntake: unknown;
  birthPlaceName: string | null;
  birthTimezone: string | null;
  generatedReport: unknown;
  fullMarkdown: string | null;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date | null;
}

interface SubscriptionSourceRow {
  id: string;
  userId: string;
  archived: boolean;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  tier: string | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  metadata: unknown;
  createdAt: Date;
}

interface RegenerationSubscriptionProjectionRow {
  id: string;
  metadata: unknown;
}

interface WebinarSourceRow {
  id: string;
  userId: string;
  archived: boolean;
  eventKey: string;
  eventTitle: string;
  eventStartAt: Date;
  timezone: string;
  status: string;
  joinUrl: string;
  createdAt: Date;
}

interface MentorTrainingSourceRow {
  id: string;
  userId: string;
  archived: boolean;
  packageType: string;
  status: string;
  timezone: string | null;
  locationInput: string | null;
  lat: number | null;
  lng: number | null;
  eligibilityVerifiedAt: Date;
  createdAt: Date;
  updatedAt: Date | null;
}

interface PaymentRow {
  id: string;
  userId: string;
  bookingId: string | null;
  amountCents: number;
  currency: string;
  status: string;
  provider: string;
  providerPaymentIntentId: string | null;
  providerCustomerId: string | null;
  metadata: unknown;
  createdAt: Date;
}

interface InvoiceRow {
  id: string;
  userId: string;
  clientId: string;
  stripePaymentLink: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeSubscriptionId: string | null;
  productType: string;
  label: string;
  amount: number;
  currency: string;
  billingMode: string;
  status: string;
  consumedAt: Date | null;
  expiresAt: Date | null;
  paidAt: Date | null;
  failureCode: string | null;
  failureMessage: string | null;
  failureMessageNormalized: string | null;
  lastPaymentAttemptAt: Date | null;
  metadata: unknown;
  createdAt: Date;
}

interface PersistedOrderRow {
  id: string;
  userId: string;
  archived: boolean;
  clientId: string | null;
  invoiceId: string | null;
  subscriptionId: string | null;
  type: string;
  label: string;
  amount: number;
  currency: string;
  status: string;
  paymentReference: string | null;
  stripePaymentIntentId: string | null;
  stripeSubscriptionId: string | null;
  stripeInvoiceId: string | null;
  stripeInvoiceUrl: string | null;
  stripeInvoiceStatus: string | null;
  refundedAt: Date | null;
  refundReason: string | null;
  refundNote: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  failureMessageNormalized: string | null;
  recordingLink: string | null;
  recordingAddedAt: Date | null;
  metadata: unknown;
  createdAt: Date;
}

interface PaymentCandidate {
  id: string;
  userId: string;
  bookingId: string | null;
  amountCents: number;
  currency: string;
  status: string;
  provider: string;
  providerPaymentIntentId: string | null;
  providerCustomerId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

interface OrderCandidate {
  id: string;
  type: AdminOrderType;
  sourceId: string;
  userId: string;
  archived: boolean;
  clientName: string;
  email: string;
  sourceStatus: string | null;
  sourceCreatedAt: Date;
  membershipTier: string | null;
  availableActions: string[];
  execution: AdminOrderExecution;
  recordingLink: string | null;
  recordingAddedAt: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  refundNote: string | null;
  metadata: AdminOrder["metadata"];
  directBookingId: string | null;
  sourcePaymentIntentIds: string[];
  metadataMatchKeys: string[];
}

interface ParsedOrderId {
  type: AdminOrderType;
  sourceId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => getString(item)).filter((item): item is string => Boolean(item));
}

function getGender(value: unknown): "male" | "female" | null {
  const normalized = getString(value)?.toLowerCase();
  return normalized === "male" || normalized === "female" ? normalized : null;
}

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function createEmptyIntakeMetadata(): AdminOrder["metadata"]["intake"] {
  return {
    birth_date: null,
    birth_time: null,
    location: null,
    phone: null,
    gender: null,
    timezone: null,
    consent_given: null,
    submitted_questions: [],
    topics: [],
    goals: [],
    health_focus_areas: [],
    manifestation_intention: null,
    manifestation_enhancement_selected: null,
    manifestation_goals: null,
    manifestation_enhancement: null,
    other: null,
    notes: null,
  };
}

function parseBookingAvailability(value: unknown): AdminOrderAvailability | null {
  if (!isRecord(value)) return null;
  return {
    monday: getStringArray(value.monday),
    tuesday: getStringArray(value.tuesday),
    wednesday: getStringArray(value.wednesday),
    thursday: getStringArray(value.thursday),
    friday: getStringArray(value.friday),
  };
}

function parseBookingHealthFocusAreas(value: unknown): AdminOrderHealthFocusArea[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const name = getString(entry.name);
      const severity = getNumber(entry.severity);
      if (!name || severity === null) return null;
      return { name, severity };
    })
    .filter((entry): entry is AdminOrderHealthFocusArea => Boolean(entry));
}

function isExecutionState(value: unknown): value is OrderExecutionState {
  return value === "idle"
    || value === "generating"
    || value === "awaiting_input"
    || value === "completed"
    || value === "failed";
}

function getOrderId(type: AdminOrderType, sourceId: string) {
  return `${type}_${sourceId}`;
}

function findPersistedOrderForSource(
  rows: PersistedOrderRow[],
  type: AdminOrderType,
  sourceId: string,
) {
  return rows.find((entry) => persistedOrderMatchesSource(entry, type, sourceId)) ?? null;
}

function applyPersistedOrderState(candidate: OrderCandidate, persistedOrder: PersistedOrderRow | null): OrderCandidate {
  if (!persistedOrder) {
    return candidate;
  }

  const metadata = parseObject(persistedOrder.metadata);

  return {
    ...candidate,
    recordingLink: persistedOrder.recordingLink ?? candidate.recordingLink,
    recordingAddedAt: persistedOrder.recordingAddedAt?.toISOString() ?? candidate.recordingAddedAt,
    refundedAt: persistedOrder.refundedAt?.toISOString() ?? candidate.refundedAt,
    refundReason: persistedOrder.refundReason ?? candidate.refundReason,
    refundNote: persistedOrder.refundNote ?? candidate.refundNote,
    metadata: {
      ...candidate.metadata,
      stripe_invoice_id: persistedOrder.stripeInvoiceId ?? candidate.metadata.stripe_invoice_id,
      stripe_invoice_url: persistedOrder.stripeInvoiceUrl ?? candidate.metadata.stripe_invoice_url,
      stripe_invoice_status: persistedOrder.stripeInvoiceStatus ?? candidate.metadata.stripe_invoice_status,
      invoice_origin: getString(metadata.invoice_origin) ?? candidate.metadata.invoice_origin ?? null,
      price_snapshot_cents: getNumber(metadata.price_snapshot_cents) ?? candidate.metadata.price_snapshot_cents ?? null,
      price_snapshot_currency: getString(metadata.price_snapshot_currency) ?? candidate.metadata.price_snapshot_currency ?? null,
      invoice_timeline: Array.isArray(metadata.invoice_timeline) ? metadata.invoice_timeline : candidate.metadata.invoice_timeline,
    },
  };
}

export function parseOrderId(orderId: string): ParsedOrderId {
  const knownTypes: AdminOrderType[] = ["regeneration_offer", "mentor_training", "subscription", "session", "report", "webinar", "custom"];
  const matchedType = knownTypes.find((type) => orderId.startsWith(`${type}_`)) ?? null;
  const sourceId = matchedType ? orderId.slice(matchedType.length + 1).trim() : "";
  if (!sourceId) {
    throw createHttpError(404, "Order not found");
  }

  if (!matchedType) {
    throw createHttpError(404, "Order not found");
  }

  return {
    type: matchedType,
    sourceId,
  };
}

function clampLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(value ?? DEFAULT_LIMIT)));
}

function clampOffset(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value ?? 0));
}

function normalizeFilterText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function includesSearch(value: string | null | undefined, query: string) {
  return normalizeSearchText(value).includes(query);
}

function orderMatchesSearch(order: AdminOrder, query: string) {
  if (!query) return true;
  const metadata = order.metadata;
  const rawIntake = parseObject(metadata.raw_intake);
  const searchTargets = [
    order.id,
    order.source_id,
    order.client_name,
    order.email,
    order.product_name,
    order.stripe_payment_id,
    order.payment_id,
    order.execution.report_id,
    metadata.stripe_subscription_id,
    metadata.stripe_checkout_session_id,
    metadata.stripe_invoice_id,
    metadata.recovery_invoice_id,
    metadata.invoice_id,
    metadata.invoice_link,
    metadata.report_type_id,
    metadata.session_type_id,
    metadata.session_type,
    metadata.plan_name,
    metadata.invoice_label,
    getString(rawIntake.reportId),
    getString(rawIntake.report_id),
    getString(rawIntake.sessionId),
    getString(rawIntake.session_id),
  ];

  return searchTargets.some((target) => includesSearch(target, query));
}

function fallbackLabelMatches(value: string | null | undefined, expected: string) {
  return normalizeFilterText(value).includes(expected);
}

function orderMatchesSessionCategory(order: AdminOrder, category: string) {
  if (order.type !== "session") return false;
  if (!category || category === "all") return true;

  const sessionTypeId = normalizeFilterText(order.metadata.session_type_id);
  const sessionType = normalizeFilterText(order.metadata.session_type);

  if (category === "qa_session") {
    return sessionTypeId === "qa_session"
      || sessionTypeId === "q_a_session"
      || sessionType.includes("qa_session")
      || sessionType.includes("q_a_session")
      || fallbackLabelMatches(order.product_name, "qa_session")
      || fallbackLabelMatches(order.product_name, "q_a_session");
  }

  if (category === "mentoring_session") {
    return sessionTypeId === "mentoring"
      || sessionTypeId === "mentoring_session"
      || sessionType === "mentoring"
      || sessionType.includes("mentoring_session")
      || fallbackLabelMatches(order.product_name, "mentoring_session");
  }

  return true;
}

function orderMatchesReportCategory(order: AdminOrder, category: string) {
  if (order.type !== "report") return false;
  if (!category || category === "all" || category === "divin8_reports") return true;

  const rawIntake = parseObject(order.metadata.raw_intake);
  const normalizedValues = [
    normalizeFilterText(order.metadata.report_type_id),
    normalizeFilterText(order.metadata.report_type),
    normalizeFilterText(getString(rawIntake.report_type)),
    normalizeFilterText(getString(rawIntake.reportCategory)),
    normalizeFilterText(getString(rawIntake.report_category)),
  ];
  return normalizedValues.includes(category) || fallbackLabelMatches(order.product_name, category);
}

function orderMatchesSubscriptionCategory(order: AdminOrder, category: string) {
  if (order.type !== "subscription") return false;
  if (!category || category === "all") return true;

  const subscriptionKind = order.subscription?.kind ?? null;
  const membershipTier = normalizeFilterText(order.membership_tier);
  const orderVariant = normalizeFilterText(order.metadata.order_variant);
  const planName = normalizeFilterText(order.metadata.plan_name);

  if (category === "regeneration_monthly_package") {
    return subscriptionKind === "regeneration"
      || orderVariant === "regeneration_monthly_package"
      || planName === "regeneration_monthly_package"
      || fallbackLabelMatches(order.product_name, "regeneration_monthly_package");
  }

  if (category === "premium_subscription") {
    return subscriptionKind === "membership"
      || membershipTier === "seeker"
      || membershipTier === "initiate"
      || fallbackLabelMatches(order.metadata.plan_name, "premium_subscription")
      || fallbackLabelMatches(order.product_name, "premium_subscription");
  }

  return true;
}

function orderMatchesCategory(order: AdminOrder, category: string) {
  const normalized = normalizeFilterText(category);
  if (!normalized || normalized === "all") return true;
  if (normalized === "qa_session" || normalized === "mentoring_session") {
    return orderMatchesSessionCategory(order, normalized);
  }
  if (normalized === "divin8_reports") {
    return orderMatchesReportCategory(order, normalized);
  }
  if (normalized === "regeneration_monthly_package" || normalized === "premium_subscription") {
    return orderMatchesSubscriptionCategory(order, normalized);
  }
  if (order.type === "session") return orderMatchesSessionCategory(order, normalized);
  if (order.type === "report") return orderMatchesReportCategory(order, normalized);
  if (order.type === "subscription") return orderMatchesSubscriptionCategory(order, normalized);
  return true;
}

function orderMatchesQuery(order: AdminOrder, query: AdminOrdersQuery) {
  const type = query.type && query.type !== "all" ? query.type : null;
  if (type && order.type !== type) return false;

  if (!orderMatchesCategory(order, query.category ?? "")) return false;

  if (type === "mentor_training" || order.type === "mentor_training") {
    if (query.trainingPackage && query.trainingPackage !== "all" && order.metadata.training_package_id !== query.trainingPackage) {
      return false;
    }
    if (query.trainingStatus && query.trainingStatus !== "all" && order.status !== query.trainingStatus) {
      return false;
    }
  }

  return orderMatchesSearch(order, normalizeSearchText(query.search));
}

function titleCase(value: string | null) {
  if (!value) return null;
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSessionTypeLabel(value: string | null, fallbackName?: string | null) {
  if (fallbackName?.trim()) {
    return fallbackName.trim();
  }
  if (value === "qa_session") {
    return "Q&A Session";
  }
  return titleCase(value);
}

function isQaSessionLabel(value: string | null | undefined) {
  if (!value) return false;
  const normalized = value.toLowerCase().replace(/[^a-z]+/g, "_");
  return normalized.includes("qa_session") || normalized.includes("q_a_session");
}

function resolveLocation(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = getString(value);
    if (normalized) return normalized;
  }
  return null;
}

function getEmptyRecoveryInvoiceMetadata() {
  return {
    recovery_invoice_id: null as string | null,
    recovery_invoice_sent_at: null as string | null,
    recovery_invoice_hosted_url: null as string | null,
  };
}

function extractRecoveryInvoiceMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) {
    return getEmptyRecoveryInvoiceMetadata();
  }
  return {
    recovery_invoice_id: getString(metadata.stripeRecoveryInvoiceId) ?? null,
    recovery_invoice_sent_at: getString(metadata.stripeRecoveryInvoiceSentAt) ?? null,
    recovery_invoice_hosted_url: getString(metadata.stripeRecoveryInvoiceHostedUrl) ?? null,
  };
}

function getEmptyInvoiceMetadata() {
  return {
    billing_mode: null,
    invoice_id: null,
    invoice_status: null,
    invoice_link: null,
    invoice_expires_at: null,
    invoice_paid_at: null,
    invoice_consumed_at: null,
    stripe_invoice_id: null,
    stripe_invoice_url: null,
    stripe_invoice_status: null,
    order_variant: null,
    invoice_label: null,
    subscription_state: null,
    failure_code: null,
    failure_message: null,
    failure_message_normalized: null,
    last_payment_attempt_at: null,
  };
}

function resolveClientName(input: {
  userId: string;
  explicitName?: string | null;
  purchaseName?: string | null;
  clientById?: ClientRow | null;
  clientByUser?: ClientRow | null;
  email?: string | null;
}) {
  return input.explicitName
    ?? input.purchaseName
    ?? input.clientById?.fullBirthName
    ?? input.clientByUser?.fullBirthName
    ?? input.email?.split("@")[0]
    ?? input.userId;
}

function buildQuestions(parts: Array<string | null>, collections: Array<string[]> = []) {
  const questions = [
    ...parts.filter((value): value is string => Boolean(value && value.trim())),
    ...collections.flatMap((values) => values),
  ];
  return Array.from(new Set(questions));
}

function normalizePaymentStatus(status: string | null): Exclude<AdminOrderStatus, "unpaid" | "cancelled"> | "cancelled" | null {
  const normalized = status?.trim().toLowerCase() ?? "";
  switch (normalized) {
    case "succeeded":
    case "paid":
      return "paid";
    case "requires_payment_method":
    case "requires_payment":
    case "pending":
    case "incomplete":
      return "pending_payment";
    case "processing":
      return "processing";
    case "refunded":
      return "refunded";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "":
      return null;
    default:
      logger.warn("orders_unknown_payment_status", { status });
      return "processing";
  }
}

function normalizeSourceStatus(type: AdminOrderType, sourceStatus: string | null, supplementalStatus?: string | null): Exclude<AdminOrderStatus, "unpaid" | "refunded"> {
  const normalized = sourceStatus?.trim().toLowerCase() ?? "";
  const supplemental = supplementalStatus?.trim().toLowerCase() ?? "";

  if (type === "session") {
    switch (normalized) {
      case "paid":
        return "paid";
      case "scheduled":
      case "completed":
        return "completed";
      case "cancelled":
      case "canceled":
        return "cancelled";
      case "pending":
      case "pending_payment":
      case "pending_availability":
      default:
        return "pending_payment";
    }
  }

  if (type === "report") {
    if (supplemental === "fulfilled" || normalized === "generated" || normalized === "complete" || normalized === "completed") {
      return "completed";
    }
    if (supplemental === "paid") {
      return "paid";
    }
    if (supplemental === "pending_payment" || normalized === "draft") {
      return "pending_payment";
    }
    if (normalized === "cancelled" || normalized === "canceled") {
      return "cancelled";
    }
    return "processing";
  }

  if (type === "subscription") {
    switch (normalized) {
      case "active":
      case "trialing":
        return "paid";
      case "past_due":
        return "processing";
      case "canceled":
      case "cancelled":
        return "cancelled";
      case "incomplete":
      case "pending_payment":
        return "pending_payment";
      default:
        return "processing";
    }
  }

  if (type === "mentor_training") {
    switch (normalized) {
      case "paid":
        return "paid";
      case "in_progress":
        return "in_progress";
      case "completed":
        return "completed";
      case "cancelled":
      case "canceled":
        return "cancelled";
      case "pending_payment":
      default:
        return "pending_payment";
    }
  }

  switch (normalized) {
    case "registered":
    case "confirmed":
    case "completed":
      return "completed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "pending":
      return "pending_payment";
    default:
      return "processing";
  }
}

function finalizeOrderStatus(sourceStatus: Exclude<AdminOrderStatus, "unpaid" | "refunded">, paymentStatus: ReturnType<typeof normalizePaymentStatus>, hasPayment: boolean): AdminOrderStatus {
  if (!hasPayment) {
    if (sourceStatus === "paid" || sourceStatus === "completed" || sourceStatus === "in_progress") {
      return sourceStatus;
    }
    return "unpaid";
  }
  if (paymentStatus === "refunded") {
    return "refunded";
  }
  if (sourceStatus === "cancelled") {
    return "cancelled";
  }
  if (sourceStatus === "completed") {
    return "completed";
  }
  if (sourceStatus === "paid") {
    return "paid";
  }
  if (sourceStatus === "in_progress") {
    return "in_progress";
  }
  if (sourceStatus === "processing") {
    return "processing";
  }
  if (paymentStatus === "paid") {
    return "paid";
  }
  if (paymentStatus === "pending_payment") {
    return "pending_payment";
  }
  if (paymentStatus === "processing") {
    return "processing";
  }
  return sourceStatus;
}

function extractPaymentMetadataKeys(metadata: Record<string, unknown> | null) {
  if (!metadata) return [];
  const keys = [
    getString(metadata.bookingId),
    getString(metadata.booking_id),
    getString(metadata.reportId),
    getString(metadata.report_id),
    getString(metadata.subscriptionId),
    getString(metadata.subscription_id),
    getString(metadata.stripeSubscriptionId),
    getString(metadata.stripe_subscription_id),
    getString(metadata.trainingOrderId),
    getString(metadata.training_order_id),
    getString(metadata.eventKey),
    getString(metadata.event_key),
  ].filter((value): value is string => Boolean(value));
  return Array.from(new Set(keys));
}

function getPaymentMetadataType(metadata: Record<string, unknown> | null) {
  return getString(metadata?.order_type) ?? getString(metadata?.orderType) ?? getString(metadata?.type);
}

function getSourcePaymentIntentIds(...values: unknown[]) {
  const ids = values
    .map((value) => {
      if (!isRecord(value)) return null;
      return getString(value.paymentIntentId)
        ?? getString(value.payment_intent_id)
        ?? getString(value.stripePaymentIntentId)
        ?? getString(value.stripe_payment_intent_id);
    })
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(ids));
}

function normalizeSystemsUsed(value: unknown) {
  return getStringArray(value);
}

function buildStoredOutput(
  row: ReportSourceRow | null,
  fallbackOrderId: string,
  fallbackUserId: string,
): AdminOrderOutput | null {
  if (!row) return null;

  const meta = isRecord(row.meta) ? row.meta : null;
  const storedOutput = meta?.generated_output;
  if (isRecord(storedOutput)) {
    const summary = getString(storedOutput.summary) ?? "";
    const generatedAt = getString(storedOutput.generated_at)
      ?? getString(meta?.generated_at)
      ?? getString(meta?.generation_completed_at)
      ?? row.updatedAt?.toISOString()
      ?? row.createdAt.toISOString();
    const version = getNumber(storedOutput.version) ?? getNumber(meta?.output_version) ?? 1;
    const sections = Array.isArray(storedOutput.sections)
      ? storedOutput.sections
        .filter((item): item is { key?: unknown; title?: unknown; content?: unknown } => isRecord(item))
        .map((item) => ({
          key: getString(item.key) ?? "overview",
          title: getString(item.title) ?? "Section",
          content: getString(item.content) ?? "",
        }))
      : [];
    return {
      summary,
      sections,
      systems_used: getStringArray(storedOutput.systems_used).length > 0
        ? getStringArray(storedOutput.systems_used)
        : normalizeSystemsUsed(row.systemsUsed),
      generated_at: generatedAt,
      version,
      order_id: getString(storedOutput.order_id) ?? getString(meta?.orderId) ?? fallbackOrderId,
      user_id: getString(storedOutput.user_id) ?? row.userId ?? fallbackUserId,
    };
  }

  const storedSections = getSectionsFromStoredReport(row.generatedReport);
  if (!storedSections) {
    return null;
  }

  return {
    summary: storedSections.overview ?? "",
    sections: INTERPRETATION_SECTION_KEYS
      .map((key) => ({
        key,
        title: SECTION_MARKDOWN_LABELS[key],
        content: storedSections[key] ?? "",
      }))
      .filter((section) => section.content.trim().length > 0),
    systems_used: normalizeSystemsUsed(row.systemsUsed),
    generated_at: getString(meta?.generated_at)
      ?? getString(meta?.generation_completed_at)
      ?? row.updatedAt?.toISOString()
      ?? row.createdAt.toISOString(),
    version: getNumber(meta?.output_version) ?? 1,
    order_id: getString(meta?.orderId) ?? fallbackOrderId,
    user_id: row.userId ?? fallbackUserId,
  };
}

function buildOrderExecution(
  row: ReportSourceRow | null,
  fallbackOrderId: string,
  fallbackUserId: string,
): AdminOrderExecution {
  if (!row) {
    return {
      state: "idle",
      report_id: null,
      last_generation_error: null,
      last_attempt_timestamp: null,
      generation_started_at: null,
      generation_completed_at: null,
      duration_ms: null,
      version: null,
      output: null,
    };
  }

  const meta = isRecord(row.meta) ? row.meta : null;
  const output = buildStoredOutput(row, fallbackOrderId, fallbackUserId);
  const inferredState = isExecutionState(meta?.execution_state)
    ? meta.execution_state
    : row.status === "generating"
      ? "generating"
      : row.status === "awaiting_input"
        ? "awaiting_input"
        : row.status === "failed"
          ? "failed"
          : output
            ? "completed"
            : "idle";

  return {
    state: inferredState,
    report_id: row.id,
    last_generation_error: getString(meta?.last_generation_error),
    last_attempt_timestamp: getString(meta?.last_generation_attempt_at),
    generation_started_at: getString(meta?.generation_started_at),
    generation_completed_at: getString(meta?.generation_completed_at),
    duration_ms: getNumber(meta?.duration_ms),
    version: getNumber(meta?.output_version) ?? output?.version ?? null,
    output,
  };
}

function isSessionExecutionReport(row: ReportSourceRow) {
  const meta = isRecord(row.meta) ? row.meta : null;
  return getString(meta?.orderSourceType) === "session";
}

function buildSessionExecutionMap(rows: ReportSourceRow[]) {
  const byOrderId = new Map<string, ReportSourceRow>();
  for (const row of rows) {
    if (!isSessionExecutionReport(row)) continue;
    const meta = isRecord(row.meta) ? row.meta : null;
    const orderId = getString(meta?.orderId);
    if (!orderId) continue;
    const existing = byOrderId.get(orderId);
    const rowTimestamp = row.updatedAt?.getTime() ?? row.createdAt.getTime();
    const existingTimestamp = existing?.updatedAt?.getTime() ?? existing?.createdAt.getTime() ?? 0;
    if (!existing || rowTimestamp > existingTimestamp) {
      byOrderId.set(orderId, row);
    }
  }
  return byOrderId;
}

function serializePaymentRecord(row: PaymentRow): PaymentCandidate {
  return {
    id: row.id,
    userId: row.userId,
    bookingId: row.bookingId,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status,
    provider: row.provider,
    providerPaymentIntentId: row.providerPaymentIntentId,
    providerCustomerId: row.providerCustomerId,
    metadata: isRecord(row.metadata) ? row.metadata : null,
    createdAt: row.createdAt,
  };
}

function buildOrdersLogContext(candidate: OrderCandidate) {
  return {
    orderType: candidate.type,
    sourceId: candidate.sourceId,
    userId: candidate.userId,
  };
}

function matchPaymentForOrder(
  candidate: OrderCandidate,
  paymentsByUser: Map<string, PaymentCandidate[]>,
  claimedPaymentIds: Set<string>,
): { payment: PaymentCandidate | null; strategy: string | null } {
  const userPayments = (paymentsByUser.get(candidate.userId) ?? []).filter((payment) => !claimedPaymentIds.has(payment.id));
  if (userPayments.length === 0) {
    return { payment: null, strategy: null };
  }

  if (candidate.directBookingId) {
    const directMatch = userPayments.find((payment) => payment.bookingId === candidate.directBookingId);
    if (directMatch) {
      claimedPaymentIds.add(directMatch.id);
      return { payment: directMatch, strategy: "direct_foreign_key" };
    }
  }

  if (candidate.sourcePaymentIntentIds.length > 0) {
    const intentMatch = userPayments.find((payment) =>
      payment.providerPaymentIntentId && candidate.sourcePaymentIntentIds.includes(payment.providerPaymentIntentId));
    if (intentMatch) {
      claimedPaymentIds.add(intentMatch.id);
      return { payment: intentMatch, strategy: "source_payment_intent_id" };
    }
  }

  const metadataMatch = userPayments.find((payment) => {
    const paymentType = getPaymentMetadataType(payment.metadata);
    if (paymentType && paymentType !== candidate.type && !(candidate.type === "session" && paymentType === "booking")) {
      return false;
    }
    const paymentKeys = extractPaymentMetadataKeys(payment.metadata);
    return candidate.metadataMatchKeys.some((key) => paymentKeys.includes(key));
  });
  if (metadataMatch) {
    claimedPaymentIds.add(metadataMatch.id);
    return { payment: metadataMatch, strategy: "stripe_metadata" };
  }

  const fallbackMatch = userPayments.find((payment) =>
    Math.abs(payment.createdAt.getTime() - candidate.sourceCreatedAt.getTime()) <= PAYMENT_MATCH_WINDOW_MS);
  if (fallbackMatch) {
    claimedPaymentIds.add(fallbackMatch.id);
    return { payment: fallbackMatch, strategy: "latest_user_window" };
  }

  return { payment: null, strategy: null };
}

function resolveAdminOrderProductName(candidate: OrderCandidate, payment: PaymentCandidate | null) {
  const paymentMetadata = parseObject(payment?.metadata);
  const paymentProductName = getString(paymentMetadata.product_name) ?? getString(paymentMetadata.stripeProductName);
  if (paymentProductName) return paymentProductName;
  const candidateProductName = getString(candidate.metadata.product_name);
  if (candidateProductName) return candidateProductName;

  if (candidate.type === "session") {
    return resolveStripeProductNaming({
      type: candidate.metadata.event_name ? "event" : "session",
      eventType: candidate.metadata.event_name ? "mentoring_circle" : undefined,
      eventName: candidate.metadata.event_name,
      sessionType: getString(candidate.metadata.session_type_id) ?? getString(candidate.metadata.session_type),
      durationMinutes: getNumber(candidate.metadata.session_duration_minutes),
      fallbackName: candidate.metadata.session_type,
    } as Parameters<typeof resolveStripeProductNaming>[0]).productName;
  }

  if (candidate.type === "report") {
    return resolveStripeProductNaming({
      type: "report",
      reportType: candidate.metadata.report_type_id,
    }).productName;
  }

  if (candidate.type === "subscription") {
    return resolveStripeProductNaming({
      type: "subscription",
      subscriptionType: candidate.metadata.plan_name === "Regeneration Monthly Package" ? "regeneration" : "membership",
      tier: candidate.membershipTier,
      billingInterval: candidate.metadata.billing_cycle,
    }).productName;
  }

  if (candidate.type === "webinar") {
    return resolveStripeProductNaming({
      type: "event",
      eventType: "webinar",
      eventName: candidate.metadata.event_name,
    }).productName;
  }

  if (candidate.type === "mentor_training") {
    return resolveStripeProductNaming({
      type: "mentor_training",
      packageType: candidate.metadata.training_package_id,
    }).productName;
  }

  return getString(candidate.metadata.invoice_label) ?? "Unknown Product";
}

function buildAdminOrder(candidate: OrderCandidate, payment: PaymentCandidate | null, paymentMatchStrategy: string | null): AdminOrder {
  const paymentStatus = normalizePaymentStatus(payment?.status ?? null);
  const sourceStatus = normalizeSourceStatus(
    candidate.type,
    candidate.metadata.source_status,
    candidate.type === "report" ? candidate.metadata.delivery_status : null,
  );
  const createdAt = payment?.createdAt ?? candidate.sourceCreatedAt;
  const productName = resolveAdminOrderProductName(candidate, payment);
  const paymentMetadata = payment?.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
    ? payment.metadata as Record<string, unknown>
    : null;
  const paymentSource = paymentMetadata?.manuallyMarkedPaid === true
    ? "manual_paid"
    : payment?.providerPaymentIntentId
      ? "stripe_confirmed"
      : payment?.status === "refunded"
        ? "refunded"
        : payment
          ? "pending_reconciliation"
          : "missing_payment";
  const paymentSyncStatus = payment?.status === "paid" && !payment.providerPaymentIntentId && paymentSource !== "manual_paid"
    ? "mismatch"
    : paymentSource === "pending_reconciliation" && sourceStatus === "paid"
      ? "mismatch"
      : paymentSource;

  return {
    id: candidate.id,
    source_id: candidate.sourceId,
    user_id: candidate.userId,
    archived: candidate.archived,
    client_name: candidate.clientName,
    email: candidate.email,
    type: candidate.type,
    status: finalizeOrderStatus(sourceStatus, paymentStatus, Boolean(payment)),
    amount: payment ? payment.amountCents / 100 : 0,
    currency: payment?.currency ?? "",
    product_name: productName,
    stripe_payment_id: payment?.providerPaymentIntentId ?? null,
    payment_status: payment?.status ?? null,
    payment_id: payment?.id ?? null,
    payment_provider: payment?.provider ?? null,
    created_at: createdAt.toISOString(),
    membership_tier: candidate.membershipTier,
    available_actions: candidate.availableActions,
    execution: candidate.execution,
    recording_link: candidate.recordingLink,
    recording_added_at: candidate.recordingAddedAt,
    refunded_at: candidate.refundedAt,
    refund_reason: candidate.refundReason,
    refund_note: candidate.refundNote,
    subscription: null,
    metadata: {
      ...candidate.metadata,
      product_name: productName,
      payment_match_strategy: paymentMatchStrategy,
      payment_source: paymentSource,
      payment_sync_status: paymentSyncStatus,
      stripe_checkout_session_id: getString(paymentMetadata?.stripeCheckoutSessionId),
      manual_paid: paymentSource === "manual_paid",
      ...extractRecoveryInvoiceMetadata(payment?.metadata ?? null),
    },
  };
}

function normalizeDuplicateKeyPart(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildDuplicateAttemptKey(order: AdminOrder) {
  return [
    order.user_id,
    normalizeDuplicateKeyPart(order.email),
    normalizeDuplicateKeyPart(order.product_name),
    order.amount.toFixed(2),
    normalizeDuplicateKeyPart(order.currency),
  ].join("|");
}

function isCanonicalPurchasedOrder(order: AdminOrder) {
  return order.status === "completed"
    || order.status === "paid"
    || order.status === "in_progress"
    || order.status === "processing";
}

function filterSupersededPendingAttempts(orders: AdminOrder[]) {
  const purchasedByKey = new Map<string, AdminOrder[]>();
  for (const order of orders) {
    if (!isCanonicalPurchasedOrder(order)) {
      continue;
    }
    const key = buildDuplicateAttemptKey(order);
    const existing = purchasedByKey.get(key) ?? [];
    existing.push(order);
    purchasedByKey.set(key, existing);
  }

  const afterPaidSiblingFilter = orders.filter((order) => {
    if (order.status !== "pending_payment") {
      return true;
    }
    const purchasedOrders = purchasedByKey.get(buildDuplicateAttemptKey(order));
    if (!purchasedOrders?.length) {
      return true;
    }

    const pendingCreatedAt = new Date(order.created_at).getTime();
    return !purchasedOrders.some((purchased) => (
      Math.abs(new Date(purchased.created_at).getTime() - pendingCreatedAt) <= DUPLICATE_PENDING_ATTEMPT_WINDOW_MS
    ));
  });

  const newestPendingByKey = new Map<string, AdminOrder>();
  for (const order of afterPaidSiblingFilter) {
    if (order.status !== "pending_payment") {
      continue;
    }
    const key = buildDuplicateAttemptKey(order);
    const existing = newestPendingByKey.get(key);
    if (!existing || new Date(order.created_at).getTime() > new Date(existing.created_at).getTime()) {
      newestPendingByKey.set(key, order);
    }
  }

  return afterPaidSiblingFilter.filter((order) => {
    if (order.status !== "pending_payment") {
      return true;
    }
    const newest = newestPendingByKey.get(buildDuplicateAttemptKey(order));
    return newest?.id === order.id;
  });
}

function normalizeSubscriptionLifecycleStatus(input: {
  kind: AdminSubscriptionDetails["kind"];
  status: string | null;
  cancelAtPeriodEnd: boolean;
  accessState?: string | null;
  pauseCollection?: Record<string, unknown> | null;
  currentPeriodEnd?: Date | null;
}): AdminSubscriptionLifecycleStatus {
  const status = input.status ?? "incomplete";
  if (input.pauseCollection || status === "paused") return "paused";
  if (input.kind === "regeneration" && input.accessState === "grace_period") return "grace_period";
  if (input.cancelAtPeriodEnd && (status === "active" || status === "trialing" || status === "canceled_pending_expiry")) {
    return "cancel_pending";
  }
  if (status === "trialing") return "trialing";
  if (status === "past_due") return "past_due";
  if (status === "unpaid") return "payment_failed";
  if (status === "canceled" || status === "cancelled") {
    if (input.currentPeriodEnd && input.currentPeriodEnd.getTime() < Date.now()) return "expired";
    return "canceled";
  }
  if (status === "canceled_pending_expiry") return "cancel_pending";
  if (status === "active") return "active";
  if (status === "incomplete" || status === "incomplete_expired" || status === "pending_payment") return "incomplete";
  return "incomplete";
}

function subscriptionActionRequirements(kind: AdminSubscriptionDetails["kind"], lifecycle: AdminSubscriptionLifecycleStatus) {
  const requirements: Record<string, AdminSubscriptionActionRequirement> = {
    view_subscription: { reason_required: false, confirmation_required: false, severity: "secondary" },
    pause_subscription: { reason_required: true, confirmation_required: true, severity: "secondary" },
    resume_subscription: { reason_required: false, confirmation_required: true, severity: "primary" },
    cancel_period_end: { reason_required: false, confirmation_required: true, severity: "secondary" },
    cancel_immediately: { reason_required: true, confirmation_required: true, severity: "danger" },
    reactivate_subscription: { reason_required: false, confirmation_required: true, severity: "primary" },
    extend_renewal: { reason_required: true, confirmation_required: true, severity: "secondary" },
    grant_courtesy_month: { reason_required: true, confirmation_required: true, severity: "secondary" },
    retry_payment: { reason_required: false, confirmation_required: true, severity: "primary" },
    send_manual_invoice: { reason_required: false, confirmation_required: true, severity: "secondary" },
    extend_regeneration_access: { reason_required: true, confirmation_required: true, severity: "secondary" },
    toggle_regeneration_priority_support: { reason_required: true, confirmation_required: true, severity: "secondary" },
    set_regeneration_grace_period: { reason_required: true, confirmation_required: true, severity: "secondary" },
    emergency_reactivate_regeneration: { reason_required: true, confirmation_required: true, severity: "danger" },
  };

  if (kind !== "regeneration") {
    for (const action of ["extend_regeneration_access", "toggle_regeneration_priority_support", "set_regeneration_grace_period", "emergency_reactivate_regeneration"]) {
      requirements[action] = {
        ...requirements[action],
        disabled: true,
        disabled_reason: "Regeneration-only action.",
      };
    }
  }

  if (lifecycle === "canceled" || lifecycle === "expired") {
    for (const [action, requirement] of Object.entries(requirements)) {
      if (action !== "view_subscription") {
        requirements[action] = {
          ...requirement,
          disabled: true,
          disabled_reason: "Subscription is fully canceled.",
        };
      }
    }
  }

  return requirements;
}

function subscriptionActions(kind: AdminSubscriptionDetails["kind"], lifecycle: AdminSubscriptionLifecycleStatus) {
  const actions = ["view_subscription"];
  if (lifecycle === "active" || lifecycle === "trialing") {
    actions.push("pause_subscription", "cancel_period_end", "cancel_immediately", "extend_renewal", "grant_courtesy_month");
  } else if (lifecycle === "cancel_pending") {
    actions.push("reactivate_subscription", "pause_subscription", "cancel_immediately");
  } else if (lifecycle === "paused") {
    actions.push("resume_subscription", "cancel_period_end", "cancel_immediately");
  } else if (lifecycle === "past_due" || lifecycle === "payment_failed") {
    actions.push("retry_payment", "send_manual_invoice", "cancel_period_end", "cancel_immediately");
  }

  if (kind === "regeneration" && lifecycle !== "expired" && lifecycle !== "canceled") {
    actions.push(
      "extend_regeneration_access",
      "toggle_regeneration_priority_support",
      "set_regeneration_grace_period",
      "emergency_reactivate_regeneration",
    );
  }

  return actions;
}

function parsePauseCollection(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  return value;
}

async function loadSubscriptionActivity(
  db: Database,
  identity: { kind: "membership" | "regeneration"; id: string; stripeSubscriptionId: string | null },
) {
  const primary = identity.kind === "membership"
    ? eq(subscriptionAdminAuditEntries.membership_subscription_id, identity.id)
    : eq(subscriptionAdminAuditEntries.regeneration_subscription_id, identity.id);
  const rows = await db
    .select()
    .from(subscriptionAdminAuditEntries)
    .where(identity.stripeSubscriptionId ? or(primary, eq(subscriptionAdminAuditEntries.stripe_subscription_id, identity.stripeSubscriptionId)) : primary)
    .orderBy(desc(subscriptionAdminAuditEntries.created_at));

  return rows.map((row): AdminSubscriptionTimelineEntry => ({
    id: row.id,
    timestamp: row.created_at.toISOString(),
    action: row.action_type,
    actor_type: row.actor_type as SubscriptionActorType,
    actor_label: row.actor_label,
    admin_user_id: row.admin_user_id,
    previous_status: row.previous_status,
    new_status: row.new_status,
    reason: row.reason,
    source: "audit",
  }));
}

async function loadSubscriptionNotes(
  db: Database,
  identity: { kind: "membership" | "regeneration"; id: string; stripeSubscriptionId: string | null },
) {
  const primary = identity.kind === "membership"
    ? eq(subscriptionAdminNotes.membership_subscription_id, identity.id)
    : eq(subscriptionAdminNotes.regeneration_subscription_id, identity.id);
  const rows = await db
    .select()
    .from(subscriptionAdminNotes)
    .where(identity.stripeSubscriptionId ? or(primary, eq(subscriptionAdminNotes.stripe_subscription_id, identity.stripeSubscriptionId)) : primary)
    .orderBy(desc(subscriptionAdminNotes.created_at));

  return rows.map((row): AdminSubscriptionNote => ({
    id: row.id,
    note: row.note,
    admin_user_id: row.admin_user_id,
    created_at: row.created_at.toISOString(),
  }));
}

async function resolveSubscriptionDetailsForOrder(db: Database, order: AdminOrder): Promise<AdminSubscriptionDetails | null> {
  if (order.type !== "subscription") return null;

  const stripeSubscriptionId = order.metadata.stripe_subscription_id;
  const [membership] = await db
    .select()
    .from(subscriptions)
    .where(
      stripeSubscriptionId
        ? or(eq(subscriptions.id, order.source_id), eq(subscriptions.stripe_subscription_id, stripeSubscriptionId))
        : eq(subscriptions.id, order.source_id),
    )
    .limit(1);

  if (membership) {
    const metadata = parseObject(membership.metadata);
    const pauseCollection = parsePauseCollection(metadata.pauseCollection);
    const lifecycle = normalizeSubscriptionLifecycleStatus({
      kind: "membership",
      status: membership.status,
      cancelAtPeriodEnd: membership.cancel_at_period_end,
      pauseCollection,
      currentPeriodEnd: membership.current_period_end,
    });
    const identity = {
      kind: "membership" as const,
      id: membership.id,
      stripeSubscriptionId: membership.stripe_subscription_id,
    };
    return {
      kind: "membership",
      local_id: membership.id,
      stripe_subscription_id: membership.stripe_subscription_id,
      lifecycle_status: lifecycle,
      cancel_at_period_end: membership.cancel_at_period_end,
      pause_collection: pauseCollection,
      current_period_end: toIso(membership.current_period_end),
      access_state: lifecycle === "paused" ? "inactive" : null,
      priority_support: null,
      available_actions: subscriptionActions("membership", lifecycle),
      action_requirements: subscriptionActionRequirements("membership", lifecycle),
      activity: await loadSubscriptionActivity(db, identity),
      admin_notes: await loadSubscriptionNotes(db, identity),
    };
  }

  const [regeneration] = await db
    .select()
    .from(regenerationSubscriptions)
    .where(
      stripeSubscriptionId
        ? eq(regenerationSubscriptions.stripe_subscription_id, stripeSubscriptionId)
        : eq(regenerationSubscriptions.id, order.source_id),
    )
    .limit(1);

  if (regeneration) {
    const metadata = parseObject(regeneration.metadata);
    const pauseCollection = parsePauseCollection(metadata.pauseCollection);
    const lifecycle = normalizeSubscriptionLifecycleStatus({
      kind: "regeneration",
      status: regeneration.status,
      cancelAtPeriodEnd: regeneration.cancel_at_period_end,
      accessState: regeneration.access_state,
      pauseCollection,
      currentPeriodEnd: regeneration.current_period_end,
    });
    const identity = {
      kind: "regeneration" as const,
      id: regeneration.id,
      stripeSubscriptionId: regeneration.stripe_subscription_id,
    };
    return {
      kind: "regeneration",
      local_id: regeneration.id,
      stripe_subscription_id: regeneration.stripe_subscription_id,
      lifecycle_status: lifecycle,
      cancel_at_period_end: regeneration.cancel_at_period_end,
      pause_collection: pauseCollection,
      current_period_end: toIso(regeneration.current_period_end),
      access_state: regeneration.access_state,
      priority_support: regeneration.priority_support,
      available_actions: subscriptionActions("regeneration", lifecycle),
      action_requirements: subscriptionActionRequirements("regeneration", lifecycle),
      activity: await loadSubscriptionActivity(db, identity),
      admin_notes: await loadSubscriptionNotes(db, identity),
    };
  }

  if (stripeSubscriptionId) {
    return {
      kind: "managed_invoice",
      local_id: null,
      stripe_subscription_id: stripeSubscriptionId,
      lifecycle_status: normalizeSubscriptionLifecycleStatus({
        kind: "managed_invoice",
        status: order.metadata.subscription_state,
        cancelAtPeriodEnd: false,
      }),
      cancel_at_period_end: false,
      pause_collection: null,
      current_period_end: order.metadata.renewal_date,
      access_state: null,
      priority_support: null,
      available_actions: ["view_subscription"],
      action_requirements: {
        view_subscription: { reason_required: false, confirmation_required: false, severity: "secondary" },
      },
      activity: [],
      admin_notes: [],
    };
  }

  return {
    kind: "unknown",
    local_id: null,
    stripe_subscription_id: null,
    lifecycle_status: "incomplete",
    cancel_at_period_end: false,
    pause_collection: null,
    current_period_end: order.metadata.renewal_date,
    access_state: null,
    priority_support: null,
    available_actions: [],
    action_requirements: {},
    activity: [],
    admin_notes: [],
  };
}

async function attachSubscriptionDetails(db: Database, orders: AdminOrder[]) {
  return Promise.all(orders.map(async (order) => ({
    ...order,
    subscription: await resolveSubscriptionDetailsForOrder(db, order),
  })));
}

function parseReportPurchaseIntake(value: unknown) {
  if (!isRecord(value)) return null;
  const birthplace = isRecord(value.birthplace) ? value.birthplace : null;
  const personA = isRecord(value.personA) ? value.personA : null;
  return {
    fullName: getString(value.fullName) ?? getString(personA?.fullName),
    email: getString(value.email),
    phone: getString(value.phone),
    birthDate: getString(value.birthDate) ?? getString(personA?.birthDate),
    birthTime: getString(value.birthTime) ?? getString(personA?.birthTime),
    birthLocation: getString(birthplace?.name) ?? getString(personA?.birthPlaceName),
    birthTimezone: getString(birthplace?.timezone) ?? getString(value.birthTimezone) ?? getString(personA?.birthTimezone),
    consentGiven: getBoolean(value.consentGiven),
    primaryFocus: getString(value.primaryFocus),
    questions: getStringArray(value.questions).length > 0
      ? getStringArray(value.questions)
      : [getString(value.question1), getString(value.question2), getString(value.question3)].filter((entry): entry is string => Boolean(entry)),
    notes: getString(value.notes),
  };
}

function parseBookingManifestationEnhancement(value: unknown): AdminOrderManifestationEnhancement | null {
  if (!isRecord(value)) return null;
  const selected = getBoolean(value.selected) === true;
  const intentions = selected ? getString(value.intentions) : null;
  return {
    version: getNumber(value.version) ?? 1,
    selected,
    status: selected ? "active" : "not_selected",
    name: REGENERATION_MANIFESTATION_ENHANCEMENT_NAME,
    duration_days: REGENERATION_MANIFESTATION_ENHANCEMENT_DURATION_DAYS,
    price_cents: getNumber(value.priceCents) ?? REGENERATION_MANIFESTATION_ENHANCEMENT_AMOUNT_CENTS,
    currency: getString(value.currency) ?? "CAD",
    intentions,
  };
}

function parseBookingIntake(value: unknown) {
  if (!isRecord(value)) return null;
  const normalizedTopics = getString(value.topics)
    ?.split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    ?? getStringArray(value.topics);
  const gender = getGender(value.gender);
  return {
    type: getString(value.type),
    gender,
    topics: normalizedTopics,
    goals: getStringArray(value.goals),
    healthFocusAreas: parseBookingHealthFocusAreas(value.healthFocusAreas),
    manifestationIntention: getString(value.manifestationIntention),
    manifestationEnhancement: parseBookingManifestationEnhancement(value.manifestationEnhancement),
    other: getString(value.other),
    notes: getString(value.notes),
  };
}

function parseBookingIntakeSnapshot(value: unknown) {
  if (!isRecord(value)) return null;
  const intake = parseBookingIntake(value.intake);
  return {
    birthDate: getString(value.birthDate),
    birthTime: getString(value.birthTime),
    location: getString(value.birthPlaceName) ?? getString(value.birthPlace),
    phone: getString(value.phone),
    gender: getGender(value.gender) ?? intake?.gender ?? null,
    timezone: getString(value.timezone),
    consentGiven: getBoolean(value.consentGiven),
    submittedQuestions: getStringArray(value.submittedQuestions).length > 0
      ? getStringArray(value.submittedQuestions)
      : getStringArray(value.submitted_questions),
    availability: parseBookingAvailability(value.availability),
    intake,
    notes: getString(value.notes),
  };
}

function parseSubscriptionMetadata(value: unknown) {
  if (!isRecord(value)) return null;
  return {
    billingInterval: getString(value.billingInterval),
    currentPeriodStart: getString(value.currentPeriodStart),
    stripeCheckoutSessionId: getString(value.stripeCheckoutSessionId),
    paymentIntentId: getString(value.paymentIntentId),
  };
}

function chooseLatestClientByUser(rows: ClientRow[]) {
  const byUserId = new Map<string, ClientRow>();
  const byId = new Map<string, ClientRow>();
  for (const row of rows) {
    byId.set(row.id, row);
    const existing = byUserId.get(row.userId);
    if (!existing || row.createdAt > existing.createdAt) {
      byUserId.set(row.userId, row);
    }
  }
  return { byUserId, byId };
}

function getAvailableActions(type: AdminOrderType, sessionLabel?: string | null) {
  switch (type) {
    case "report":
      return ["generate_output"];
    case "session":
      return isQaSessionLabel(sessionLabel) ? ["schedule_session"] : ["generate_output", "schedule_session"];
    case "subscription":
      return ["view_subscription", "create_invoice"];
    case "webinar":
      return ["open_access_link"];
    case "mentor_training":
      return ["mark_in_progress", "mark_completed"];
    case "regeneration_offer":
      return ["create_invoice"];
    case "custom":
      return [];
  }
}

async function fetchSourceData(db: Database, options: { showArchived?: boolean } = {}) {
  const showArchived = options.showArchived === true;
  const [
    userRows,
    clientRows,
    entitlementRows,
    invoiceRows,
    persistedOrderRows,
    bookingRows,
    regenerationSubscriptionRows,
    reportRows,
    subscriptionRows,
    mentorTrainingRows,
    webinarRows,
    paymentRows,
  ] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
      })
      .from(users),
    db
      .select({
        id: clients.id,
        userId: clients.user_id,
        fullBirthName: clients.full_birth_name,
        createdAt: clients.created_at,
      })
      .from(clients),
    db
      .select({
        userId: memberEntitlements.user_id,
        tier: memberEntitlements.tier,
        billingInterval: memberEntitlements.billing_interval,
        currentPeriodEnd: memberEntitlements.current_period_end,
      })
      .from(memberEntitlements),
    db
      .select({
        id: invoices.id,
        userId: invoices.user_id,
        clientId: invoices.client_id,
        stripePaymentLink: invoices.stripe_payment_link,
        stripeCheckoutSessionId: invoices.stripe_checkout_session_id,
        stripePaymentIntentId: invoices.stripe_payment_intent_id,
        stripeSubscriptionId: invoices.stripe_subscription_id,
        productType: invoices.product_type,
        label: invoices.label,
        amount: invoices.amount,
        currency: invoices.currency,
        billingMode: invoices.billing_mode,
        status: invoices.status,
        consumedAt: invoices.consumed_at,
        expiresAt: invoices.expires_at,
        paidAt: invoices.paid_at,
        failureCode: invoices.failure_code,
        failureMessage: invoices.failure_message,
        failureMessageNormalized: invoices.failure_message_normalized,
        lastPaymentAttemptAt: invoices.last_payment_attempt_at,
        metadata: invoices.metadata,
        createdAt: invoices.created_at,
      })
      .from(invoices),
    db
      .select({
        id: persistedOrdersTable.id,
        userId: persistedOrdersTable.user_id,
        archived: persistedOrdersTable.archived,
        clientId: persistedOrdersTable.client_id,
        invoiceId: persistedOrdersTable.invoice_id,
        subscriptionId: persistedOrdersTable.subscription_id,
        type: persistedOrdersTable.type,
        label: persistedOrdersTable.label,
        amount: persistedOrdersTable.amount,
        currency: persistedOrdersTable.currency,
        status: persistedOrdersTable.status,
        paymentReference: persistedOrdersTable.payment_reference,
        stripePaymentIntentId: persistedOrdersTable.stripe_payment_intent_id,
        stripeSubscriptionId: persistedOrdersTable.stripe_subscription_id,
        stripeInvoiceId: persistedOrdersTable.stripe_invoice_id,
        stripeInvoiceUrl: persistedOrdersTable.stripe_invoice_url,
        stripeInvoiceStatus: persistedOrdersTable.stripe_invoice_status,
        refundedAt: persistedOrdersTable.refunded_at,
        refundReason: persistedOrdersTable.refund_reason,
        refundNote: persistedOrdersTable.refund_note,
        failureCode: persistedOrdersTable.failure_code,
        failureMessage: persistedOrdersTable.failure_message,
        failureMessageNormalized: persistedOrdersTable.failure_message_normalized,
        recordingLink: persistedOrdersTable.recording_link,
        recordingAddedAt: persistedOrdersTable.recording_added_at,
        metadata: persistedOrdersTable.metadata,
        createdAt: persistedOrdersTable.created_at,
      })
      .from(persistedOrdersTable)
      .where(showArchived ? sql`true` : eq(persistedOrdersTable.archived, false)),
    db
      .select({
        id: bookings.id,
        userId: bookings.user_id,
        archived: bookings.archived,
        sessionType: bookings.session_type,
        eventKey: bookings.event_key,
        startTimeUtc: bookings.start_time_utc,
        status: bookings.status,
        timezone: bookings.timezone,
        availability: bookings.availability,
        fullName: bookings.full_name,
        email: bookings.email,
        phone: bookings.phone,
        birthDate: bookings.birth_date,
        birthTime: bookings.birth_time,
        birthPlace: bookings.birth_place,
        birthPlaceName: bookings.birth_place_name,
        consentGiven: bookings.consent_given,
        intake: bookings.intake,
        intakeSnapshot: bookings.intake_snapshot,
        joinUrl: bookings.join_url,
        startUrl: bookings.start_url,
        notes: bookings.notes,
        createdAt: bookings.created_at,
        bookingTypeName: bookingTypes.name,
        bookingDurationMinutes: bookingTypes.duration_minutes,
        bookingPriceCents: bookingTypes.price_cents,
        bookingCurrency: bookingTypes.currency,
      })
      .from(bookings)
      .innerJoin(bookingTypes, eq(bookings.booking_type_id, bookingTypes.id))
      .where(showArchived ? sql`true` : eq(bookings.archived, false)),
    db
      .select({
        id: regenerationSubscriptions.id,
        metadata: regenerationSubscriptions.metadata,
      })
      .from(regenerationSubscriptions),
    db
      .select({
        id: reports.id,
        userId: reports.user_id,
        clientId: reports.client_id,
        archived: reports.archived,
        status: reports.status,
        memberStatus: reports.member_status,
        interpretationTier: reports.interpretation_tier,
        displayTitle: reports.display_title,
        systemsUsed: reports.systems_used,
        purchaseIntake: reports.purchase_intake,
        birthPlaceName: reports.birth_place_name,
        birthTimezone: reports.birth_timezone,
        generatedReport: reports.generated_report,
        fullMarkdown: reports.full_markdown,
        meta: reports.meta,
        createdAt: reports.created_at,
        updatedAt: reports.updated_at,
      })
      .from(reports)
      .where(showArchived ? sql`true` : eq(reports.archived, false)),
    db
      .select({
        id: subscriptions.id,
        userId: subscriptions.user_id,
        archived: subscriptions.archived,
        stripeSubscriptionId: subscriptions.stripe_subscription_id,
        stripeCustomerId: subscriptions.stripe_customer_id,
        tier: subscriptions.tier,
        status: subscriptions.status,
        cancelAtPeriodEnd: subscriptions.cancel_at_period_end,
        currentPeriodEnd: subscriptions.current_period_end,
        metadata: subscriptions.metadata,
        createdAt: subscriptions.created_at,
      })
      .from(subscriptions)
      .where(showArchived ? sql`true` : eq(subscriptions.archived, false)),
    db
      .select({
        id: mentorTrainingOrders.id,
        userId: mentorTrainingOrders.user_id,
        archived: mentorTrainingOrders.archived,
        packageType: mentorTrainingOrders.package_type,
        status: mentorTrainingOrders.status,
        timezone: mentorTrainingOrders.timezone,
        locationInput: mentorTrainingOrders.location_input,
        lat: mentorTrainingOrders.lat,
        lng: mentorTrainingOrders.lng,
        eligibilityVerifiedAt: mentorTrainingOrders.eligibility_verified_at,
        createdAt: mentorTrainingOrders.created_at,
        updatedAt: mentorTrainingOrders.updated_at,
      })
      .from(mentorTrainingOrders)
      .where(showArchived ? sql`true` : eq(mentorTrainingOrders.archived, false)),
    db
      .select({
        id: mentoringCircleRegistrations.id,
        userId: mentoringCircleRegistrations.user_id,
        archived: mentoringCircleRegistrations.archived,
        eventKey: mentoringCircleRegistrations.event_key,
        eventTitle: mentoringCircleRegistrations.event_title,
        eventStartAt: mentoringCircleRegistrations.event_start_at,
        timezone: mentoringCircleRegistrations.timezone,
        status: mentoringCircleRegistrations.status,
        joinUrl: mentoringCircleRegistrations.join_url,
        createdAt: mentoringCircleRegistrations.created_at,
      })
      .from(mentoringCircleRegistrations)
      .where(showArchived ? sql`true` : eq(mentoringCircleRegistrations.archived, false)),
    db
      .select({
        id: payments.id,
        userId: payments.user_id,
        bookingId: payments.booking_id,
        amountCents: payments.amount_cents,
        currency: payments.currency,
        status: payments.status,
        provider: payments.provider,
        providerPaymentIntentId: payments.provider_payment_intent_id,
        providerCustomerId: payments.provider_customer_id,
        metadata: payments.metadata,
        createdAt: payments.created_at,
      })
      .from(payments)
      .orderBy(desc(payments.created_at)),
  ]);

  return {
    userRows: userRows as UserRow[],
    clientRows: clientRows as ClientRow[],
    entitlementRows: entitlementRows as EntitlementRow[],
    invoiceRows: invoiceRows as InvoiceRow[],
    persistedOrderRows: persistedOrderRows as PersistedOrderRow[],
    bookingRows: bookingRows as BookingSourceRow[],
    regenerationSubscriptionRows: regenerationSubscriptionRows as RegenerationSubscriptionProjectionRow[],
    reportRows: reportRows as ReportSourceRow[],
    subscriptionRows: subscriptionRows as SubscriptionSourceRow[],
    mentorTrainingRows: mentorTrainingRows as MentorTrainingSourceRow[],
    webinarRows: webinarRows as WebinarSourceRow[],
    paymentRows: paymentRows as PaymentRow[],
  };
}

function buildPaymentMap(rows: PaymentRow[]) {
  const paymentsByUser = new Map<string, PaymentCandidate[]>();
  for (const row of rows) {
    const candidate = serializePaymentRecord(row);
    const list = paymentsByUser.get(candidate.userId) ?? [];
    list.push(candidate);
    paymentsByUser.set(candidate.userId, list);
  }
  return paymentsByUser;
}

function createSessionCandidate(
  row: BookingSourceRow,
  usersById: Map<string, UserRow>,
  clientsByUserId: Map<string, ClientRow>,
  entitlementsByUserId: Map<string, EntitlementRow>,
  executionReportsByOrderId: Map<string, ReportSourceRow>,
): OrderCandidate | null {
  const user = usersById.get(row.userId);
  if (!user) {
    logger.warn("orders_missing_user_for_booking", { sourceId: row.id, userId: row.userId });
    return null;
  }

  const client = clientsByUserId.get(row.userId);
  const intake = parseBookingIntake(row.intake);
  const intakeSnapshot = parseBookingIntakeSnapshot(row.intakeSnapshot);
  const topics = intakeSnapshot?.intake?.topics ?? intake?.topics ?? [];
  const goals = intakeSnapshot?.intake?.goals ?? intake?.goals ?? [];
  const healthFocusAreas = intakeSnapshot?.intake?.healthFocusAreas ?? intake?.healthFocusAreas ?? [];
  const manifestationIntention = intakeSnapshot?.intake?.manifestationIntention ?? intake?.manifestationIntention ?? null;
  const manifestationEnhancement = intakeSnapshot?.intake?.manifestationEnhancement
    ?? intake?.manifestationEnhancement
    ?? null;
  const gender = intakeSnapshot?.gender ?? intakeSnapshot?.intake?.gender ?? intake?.gender ?? null;
  const other = intakeSnapshot?.intake?.other ?? intake?.other ?? null;
  const availability = intakeSnapshot?.availability ?? parseBookingAvailability(row.availability);
  const birthLocation = resolveLocation(
    intakeSnapshot?.location ?? row.birthPlaceName,
    row.birthPlace,
  );
  const inferredSubmittedQuestions = buildQuestions(
    [other],
    [
      topics,
      goals,
      manifestationIntention ? [manifestationIntention] : healthFocusAreas.map((area) => `${area.name} (severity ${area.severity}/10)`),
    ],
  );
  const submittedQuestions = intakeSnapshot?.submittedQuestions && intakeSnapshot.submittedQuestions.length > 0
    ? intakeSnapshot.submittedQuestions
    : inferredSubmittedQuestions;
  const orderId = getOrderId("session", row.id);
  const executionReport = executionReportsByOrderId.get(orderId) ?? null;

  return {
    id: orderId,
    type: "session",
    sourceId: row.id,
    userId: row.userId,
    archived: row.archived,
    clientName: resolveClientName({
      userId: row.userId,
      explicitName: row.fullName,
      clientByUser: client,
      email: row.email ?? user.email,
    }),
    email: row.email ?? user.email,
    sourceStatus: row.status,
    sourceCreatedAt: row.createdAt,
    membershipTier: entitlementsByUserId.get(row.userId)?.tier ?? null,
    availableActions: getAvailableActions("session", row.bookingTypeName),
    execution: buildOrderExecution(executionReport, orderId, row.userId),
    recordingLink: null,
    recordingAddedAt: null,
    refundedAt: null,
    refundReason: null,
    refundNote: null,
    metadata: {
      source_status: row.status,
      source_created_at: row.createdAt.toISOString(),
      birth_date: row.birthDate,
      birth_time: row.birthTime,
      birth_location: birthLocation,
      intake: {
        birth_date: row.birthDate ?? intakeSnapshot?.birthDate ?? null,
        birth_time: row.birthTime ?? intakeSnapshot?.birthTime ?? null,
        location: birthLocation,
        phone: intakeSnapshot?.phone ?? row.phone ?? null,
        gender,
        timezone: intakeSnapshot?.timezone ?? row.timezone ?? null,
        consent_given: intakeSnapshot?.consentGiven ?? row.consentGiven ?? null,
        submitted_questions: submittedQuestions,
        topics,
        goals,
        health_focus_areas: healthFocusAreas,
        manifestation_intention: manifestationIntention,
        manifestation_enhancement_selected: manifestationEnhancement?.selected ?? null,
        manifestation_goals: manifestationEnhancement?.intentions ?? null,
        manifestation_enhancement: manifestationEnhancement,
        other,
        notes: intakeSnapshot?.notes ?? intake?.notes ?? row.notes,
      },
      availability,
      report_type: null,
      report_type_id: null,
      training_package: null,
      training_package_id: null,
      selected_systems: [],
      delivery_status: null,
      session_type: formatSessionTypeLabel(row.sessionType, row.bookingTypeName),
      session_type_id: row.sessionType,
      session_duration_minutes: row.bookingDurationMinutes,
      scheduled_at: toIso(row.startTimeUtc),
      meeting_link: row.joinUrl ?? row.startUrl,
      plan_name: null,
      billing_cycle: null,
      renewal_date: null,
      event_name: row.sessionType === "mentoring_circle" ? row.bookingTypeName : null,
      event_date: row.sessionType === "mentoring_circle" ? toIso(row.startTimeUtc) : null,
      access_link: row.sessionType === "mentoring_circle" ? (row.joinUrl ?? row.startUrl) : null,
      stripe_subscription_id: null,
      ...getEmptyInvoiceMetadata(),
      ...getEmptyRecoveryInvoiceMetadata(),
      payment_match_strategy: null,
    },
    directBookingId: row.id,
    sourcePaymentIntentIds: [],
    metadataMatchKeys: [row.id],
  };
}

function createReportCandidate(
  row: ReportSourceRow,
  usersById: Map<string, UserRow>,
  clientsByUserId: Map<string, ClientRow>,
  clientsById: Map<string, ClientRow>,
  entitlementsByUserId: Map<string, EntitlementRow>,
): OrderCandidate | null {
  if (isSessionExecutionReport(row)) {
    return null;
  }

  if (!row.userId) {
    logger.warn("orders_missing_user_for_report", { sourceId: row.id });
    return null;
  }

  const user = usersById.get(row.userId);
  if (!user) {
    logger.warn("orders_missing_user_for_report", { sourceId: row.id, userId: row.userId });
    return null;
  }

  const client = row.clientId ? clientsById.get(row.clientId) ?? null : null;
  const fallbackClient = clientsByUserId.get(row.userId) ?? null;
  const intake = parseReportPurchaseIntake(row.purchaseIntake);
  const meta = isRecord(row.meta) ? row.meta : null;
  const selectedSystems = normalizeSystemsUsed(row.systemsUsed);
  const reportTypeLabel = isReportTierId(row.interpretationTier)
    ? getReportTierDefinition(row.interpretationTier).label
    : titleCase(row.interpretationTier);
  const sourcePaymentIntentIds = getSourcePaymentIntentIds(meta, row.purchaseIntake);
  const birthLocation = resolveLocation(intake?.birthLocation, row.birthPlaceName);

  if (!intake?.birthDate || !intake?.birthTime || !birthLocation) {
    logger.warn("orders_missing_report_divin8_metadata", {
      orderType: "report",
      sourceId: row.id,
      userId: row.userId,
    });
  }

  return {
    id: getOrderId("report", row.id),
    type: "report",
    sourceId: row.id,
    userId: row.userId,
    archived: row.archived,
    clientName: resolveClientName({
      userId: row.userId,
      purchaseName: intake?.fullName,
      clientById: client,
      clientByUser: fallbackClient,
      email: intake?.email ?? user.email,
    }),
    email: intake?.email ?? user.email,
    sourceStatus: row.status,
    sourceCreatedAt: row.createdAt,
    membershipTier: entitlementsByUserId.get(row.userId)?.tier ?? null,
    availableActions: getAvailableActions("report"),
    execution: buildOrderExecution(row, getOrderId("report", row.id), row.userId),
    recordingLink: null,
    recordingAddedAt: null,
    refundedAt: null,
    refundReason: null,
    refundNote: null,
    metadata: {
      source_status: row.status,
      source_created_at: row.createdAt.toISOString(),
      birth_date: intake?.birthDate ?? null,
      birth_time: intake?.birthTime ?? null,
      birth_location: birthLocation,
      intake: {
        ...createEmptyIntakeMetadata(),
        birth_date: intake?.birthDate ?? null,
        birth_time: intake?.birthTime ?? null,
        location: birthLocation,
        phone: intake?.phone ?? null,
        timezone: intake?.birthTimezone ?? null,
        consent_given: intake?.consentGiven ?? null,
        submitted_questions: intake?.questions && intake.questions.length > 0
          ? intake.questions
          : buildQuestions([intake?.primaryFocus ?? null]),
        notes: intake?.notes ?? null,
      },
      availability: null,
      report_type: reportTypeLabel,
      report_type_id: row.interpretationTier,
      raw_intake: row.purchaseIntake,
      training_package: null,
      training_package_id: null,
      selected_systems: selectedSystems,
      delivery_status: row.memberStatus,
      session_type: null,
      scheduled_at: null,
      meeting_link: null,
      plan_name: null,
      billing_cycle: null,
      renewal_date: null,
      event_name: null,
      event_date: null,
      access_link: null,
      stripe_subscription_id: null,
      ...getEmptyInvoiceMetadata(),
      ...getEmptyRecoveryInvoiceMetadata(),
      payment_match_strategy: null,
    },
    directBookingId: null,
    sourcePaymentIntentIds,
    metadataMatchKeys: [row.id],
  };
}

function createSubscriptionCandidate(
  row: SubscriptionSourceRow,
  usersById: Map<string, UserRow>,
  clientsByUserId: Map<string, ClientRow>,
  entitlementsByUserId: Map<string, EntitlementRow>,
): OrderCandidate | null {
  const user = usersById.get(row.userId);
  if (!user) {
    logger.warn("orders_missing_user_for_subscription", { sourceId: row.id, userId: row.userId });
    return null;
  }

  const client = clientsByUserId.get(row.userId) ?? null;
  const entitlement = entitlementsByUserId.get(row.userId) ?? null;
  const subscriptionMeta = parseSubscriptionMetadata(row.metadata);
  const planName = row.tier === "seeker"
    ? "Premium Member Subscription"
    : row.tier ? `${titleCase(row.tier)} Membership Subscription` : "Membership Subscription";

  return {
    id: getOrderId("subscription", row.id),
    type: "subscription",
    sourceId: row.id,
    userId: row.userId,
    archived: row.archived,
    clientName: resolveClientName({
      userId: row.userId,
      clientByUser: client,
      email: user.email,
    }),
    email: user.email,
    sourceStatus: row.status,
    sourceCreatedAt: row.createdAt,
    membershipTier: entitlement?.tier ?? row.tier ?? null,
    availableActions: getAvailableActions("subscription"),
    execution: buildOrderExecution(null, getOrderId("subscription", row.id), row.userId),
    recordingLink: null,
    recordingAddedAt: null,
    refundedAt: null,
    refundReason: null,
    refundNote: null,
    metadata: {
      source_status: row.status,
      source_created_at: row.createdAt.toISOString(),
      birth_date: null,
      birth_time: null,
      birth_location: null,
      intake: createEmptyIntakeMetadata(),
      availability: null,
      report_type: null,
      report_type_id: null,
      training_package: null,
      training_package_id: null,
      selected_systems: [],
      delivery_status: null,
      session_type: null,
      scheduled_at: null,
      meeting_link: null,
      plan_name: planName,
      billing_cycle: titleCase(subscriptionMeta?.billingInterval ?? entitlement?.billingInterval ?? null),
      renewal_date: toIso(row.currentPeriodEnd ?? entitlement?.currentPeriodEnd ?? null),
      event_name: null,
      event_date: null,
      access_link: null,
      stripe_subscription_id: row.stripeSubscriptionId,
      ...getEmptyInvoiceMetadata(),
      ...getEmptyRecoveryInvoiceMetadata(),
      payment_match_strategy: null,
    },
    directBookingId: null,
    sourcePaymentIntentIds: getSourcePaymentIntentIds(row.metadata),
    metadataMatchKeys: [row.id, row.stripeSubscriptionId, row.stripeCustomerId],
  };
}

function createMentorTrainingCandidate(
  row: MentorTrainingSourceRow,
  usersById: Map<string, UserRow>,
  clientsByUserId: Map<string, ClientRow>,
  entitlementsByUserId: Map<string, EntitlementRow>,
): OrderCandidate | null {
  const user = usersById.get(row.userId);
  if (!user) {
    logger.warn("orders_missing_user_for_mentor_training", { sourceId: row.id, userId: row.userId });
    return null;
  }

  const client = clientsByUserId.get(row.userId) ?? null;
  const entitlement = entitlementsByUserId.get(row.userId) ?? null;
  const packageLabel = titleCase(row.packageType);
  const serviceLabel = packageLabel ? `Mentor Training - ${packageLabel}` : "Mentor Training";

  return {
    id: getOrderId("mentor_training", row.id),
    type: "mentor_training",
    sourceId: row.id,
    userId: row.userId,
    archived: row.archived,
    clientName: resolveClientName({
      userId: row.userId,
      explicitName: client?.fullBirthName ?? null,
      email: user.email,
    }),
    email: user.email,
    sourceStatus: row.status,
    sourceCreatedAt: row.createdAt,
    membershipTier: entitlement?.tier ?? null,
    availableActions: getAvailableActions("mentor_training"),
    execution: buildOrderExecution(null, getOrderId("mentor_training", row.id), row.userId),
    recordingLink: null,
    recordingAddedAt: null,
    refundedAt: null,
    refundReason: null,
    refundNote: null,
    metadata: {
      source_status: row.status,
      source_created_at: row.createdAt.toISOString(),
      birth_date: null,
      birth_time: null,
      birth_location: row.locationInput,
      intake: {
        ...createEmptyIntakeMetadata(),
        location: row.locationInput,
      },
      availability: null,
      report_type: null,
      report_type_id: null,
      training_package: serviceLabel,
      training_package_id: row.packageType,
      selected_systems: [],
      delivery_status: row.status,
      session_type: null,
      scheduled_at: null,
      meeting_link: null,
      plan_name: serviceLabel,
      billing_cycle: null,
      renewal_date: null,
      event_name: null,
      event_date: null,
      access_link: null,
      stripe_subscription_id: null,
      ...getEmptyInvoiceMetadata(),
      ...getEmptyRecoveryInvoiceMetadata(),
      payment_match_strategy: null,
    },
    directBookingId: null,
    sourcePaymentIntentIds: [],
    metadataMatchKeys: [row.id],
  };
}

function createWebinarCandidate(
  row: WebinarSourceRow,
  usersById: Map<string, UserRow>,
  clientsByUserId: Map<string, ClientRow>,
  entitlementsByUserId: Map<string, EntitlementRow>,
): OrderCandidate | null {
  const user = usersById.get(row.userId);
  if (!user) {
    logger.warn("orders_missing_user_for_webinar", { sourceId: row.id, userId: row.userId });
    return null;
  }

  const client = clientsByUserId.get(row.userId) ?? null;

  return {
    id: getOrderId("webinar", row.id),
    type: "webinar",
    sourceId: row.id,
    userId: row.userId,
    archived: row.archived,
    clientName: resolveClientName({
      userId: row.userId,
      clientByUser: client,
      email: user.email,
    }),
    email: user.email,
    sourceStatus: row.status,
    sourceCreatedAt: row.createdAt,
    membershipTier: entitlementsByUserId.get(row.userId)?.tier ?? null,
    availableActions: getAvailableActions("webinar"),
    execution: buildOrderExecution(null, getOrderId("webinar", row.id), row.userId),
    recordingLink: null,
    recordingAddedAt: null,
    refundedAt: null,
    refundReason: null,
    refundNote: null,
    metadata: {
      source_status: row.status,
      source_created_at: row.createdAt.toISOString(),
      birth_date: null,
      birth_time: null,
      birth_location: null,
      intake: createEmptyIntakeMetadata(),
      availability: null,
      report_type: null,
      report_type_id: null,
      training_package: null,
      training_package_id: null,
      selected_systems: [],
      delivery_status: null,
      session_type: null,
      scheduled_at: null,
      meeting_link: null,
      plan_name: null,
      billing_cycle: null,
      renewal_date: null,
      event_name: row.eventTitle,
      event_date: row.eventStartAt.toISOString(),
      access_link: row.joinUrl,
      stripe_subscription_id: null,
      ...getEmptyInvoiceMetadata(),
      ...getEmptyRecoveryInvoiceMetadata(),
      payment_match_strategy: null,
    },
    directBookingId: null,
    sourcePaymentIntentIds: [],
    metadataMatchKeys: [row.id, row.eventKey],
  };
}

function normalizePersistedOrderType(type: string): AdminOrderType {
  if (type === "subscription" || type === "subscription_initial" || type === "subscription_renewal") {
    return "subscription";
  }
  if (type === "session" || type === "report" || type === "webinar" || type === "mentor_training" || type === "regeneration_offer" || type === "custom") {
    return type;
  }
  logger.warn("orders_unknown_persisted_order_type", { type });
  return "custom";
}

function normalizePersistedOrderStatus(status: string): AdminOrderStatus {
  switch (status) {
    case "completed":
      return "completed";
    case "refunded":
      return "refunded";
    case "failed":
      return "failed";
    case "pending":
    default:
      return "pending_payment";
  }
}

function isPersistedInvoiceMetadata(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}

function resolveMembershipSubscriptionPlanName(tier: string | null | undefined) {
  const normalized = tier?.trim().toLowerCase() ?? "";
  return normalized === "seeker" || normalized.includes("seeker membership")
    ? "Premium Member Subscription"
    : normalized ? `${titleCase(normalized)} Membership Subscription` : "Membership Subscription";
}

function resolvePersistedSubscriptionProductName(value: string | null, fallback: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!value || normalized.includes("seeker membership")) {
    return resolveMembershipSubscriptionPlanName(fallback);
  }
  return value;
}

function isRegenerationSubscriptionOrder(type: AdminOrderType, productName: string | null | undefined) {
  return type === "subscription" && productName?.trim().toLowerCase().includes("regeneration");
}

function hasParsedAvailabilityValue(value: unknown) {
  const parsed = parseBookingAvailability(value);
  return Boolean(parsed && Object.values(parsed).some((slots) => slots.length > 0));
}

function findFallbackRegenerationBooking(
  order: PersistedOrderRow,
  bookingsByUserId: Map<string, BookingSourceRow[]>,
) {
  const candidates = bookingsByUserId.get(order.userId) ?? [];
  const orderCreatedAt = order.createdAt.getTime();

  return candidates
    .filter((booking) => (
      booking.sessionType === "regeneration"
      && hasParsedAvailabilityValue(booking.availability)
      && Math.abs(booking.createdAt.getTime() - orderCreatedAt) <= REGENERATION_ORDER_BOOKING_FALLBACK_WINDOW_MS
    ))
    .sort((left, right) => Math.abs(left.createdAt.getTime() - orderCreatedAt) - Math.abs(right.createdAt.getTime() - orderCreatedAt))[0]
    ?? null;
}

function createPersistedAdminOrder(
  row: PersistedOrderRow,
  usersById: Map<string, UserRow>,
  clientsByUserId: Map<string, ClientRow>,
  clientsById: Map<string, ClientRow>,
  entitlementsByUserId: Map<string, EntitlementRow>,
  invoicesById: Map<string, InvoiceRow>,
  regenerationSubscriptionsById: Map<string, RegenerationSubscriptionProjectionRow>,
  bookingsById: Map<string, BookingSourceRow>,
  bookingsByUserId: Map<string, BookingSourceRow[]>,
): AdminOrder | null {
  const user = usersById.get(row.userId);
  if (!user) {
    logger.warn("orders_missing_user_for_persisted_order", { sourceId: row.id, userId: row.userId });
    return null;
  }

  const normalizedType = normalizePersistedOrderType(row.type);
  const invoice = row.invoiceId ? invoicesById.get(row.invoiceId) ?? null : null;
  const client = row.clientId ? clientsById.get(row.clientId) ?? null : clientsByUserId.get(row.userId) ?? null;
  const invoiceMetadata = isPersistedInvoiceMetadata(invoice?.metadata) ? invoice.metadata : null;
  const orderMetadata = isPersistedInvoiceMetadata(row.metadata) ? row.metadata : null;
  const projectionMetadata = parseObject(
    row.subscriptionId ? regenerationSubscriptionsById.get(row.subscriptionId)?.metadata : null,
  );
  const subscriptionState = getString(invoiceMetadata?.subscriptionStatus)
    ?? getString(orderMetadata?.subscriptionStatus)
    ?? null;
  const createdAt = row.createdAt;
  const sessionType = getString(orderMetadata?.sessionType) ?? getString(orderMetadata?.session_type);
  const scheduledAt = getString(orderMetadata?.scheduledAt) ?? getString(orderMetadata?.scheduled_at);
  const meetingLink = getString(orderMetadata?.meetingLink) ?? getString(orderMetadata?.meeting_link);
  const manifestationEnhancement = parseBookingManifestationEnhancement(
    orderMetadata?.manifestationEnhancement ?? projectionMetadata?.manifestationEnhancement,
  );
  const bookingId = getString(orderMetadata?.bookingId)
    ?? getString(projectionMetadata?.bookingId)
    ?? getString(invoiceMetadata?.bookingId);
  const rawProductName = getString(orderMetadata?.product_name)
    ?? getString(invoiceMetadata?.product_name)
    ?? row.label
    ?? "Unknown Product";
  const productName = normalizedType === "subscription"
    ? resolvePersistedSubscriptionProductName(rawProductName, getString(orderMetadata?.tier) ?? row.label)
    : rawProductName;
  const linkedBooking = bookingId
    ? bookingsById.get(bookingId) ?? null
    : isRegenerationSubscriptionOrder(normalizedType, productName)
      ? findFallbackRegenerationBooking(row, bookingsByUserId)
      : null;
  const linkedBookingIntake = linkedBooking ? parseBookingIntake(linkedBooking.intake) : null;
  const linkedBookingIntakeSnapshot = linkedBooking ? parseBookingIntakeSnapshot(linkedBooking.intakeSnapshot) : null;
  const linkedBookingAvailability = linkedBookingIntakeSnapshot?.availability ?? parseBookingAvailability(linkedBooking?.availability);
  const bookingAvailability = parseBookingAvailability(
    orderMetadata?.bookingAvailability
      ?? projectionMetadata?.bookingAvailability
      ?? orderMetadata?.availability
      ?? linkedBookingAvailability,
  );
  const bookingTimezone = getString(orderMetadata?.bookingTimezone)
    ?? getString(projectionMetadata?.bookingTimezone)
    ?? getString(orderMetadata?.timezone)
    ?? linkedBookingIntakeSnapshot?.timezone
    ?? linkedBooking?.timezone
    ?? null;
  const emptyIntake = createEmptyIntakeMetadata();
  const persistedPaymentSource = row.stripePaymentIntentId ?? invoice?.stripePaymentIntentId
    ? "stripe_confirmed"
    : row.status === "refunded"
      ? "refunded"
      : orderMetadata?.manuallyMarkedPaid === true || orderMetadata?.manualPaid === true
        ? "manual_paid"
        : row.paymentReference
          ? "stripe_confirmed"
          : "pending_reconciliation";

  return {
    id: getOrderId(normalizedType, row.id),
    source_id: row.id,
    user_id: row.userId,
    archived: row.archived,
    client_name: resolveClientName({
      userId: row.userId,
      explicitName: client?.fullBirthName ?? null,
      email: user.email,
    }),
    email: user.email,
    type: normalizedType,
    status: normalizePersistedOrderStatus(row.status),
    amount: row.amount / 100,
    currency: row.currency,
    product_name: productName,
    stripe_payment_id: row.stripePaymentIntentId ?? invoice?.stripePaymentIntentId ?? null,
    payment_status: row.status,
    payment_id: row.paymentReference,
    payment_provider: "stripe",
    created_at: createdAt.toISOString(),
    membership_tier: entitlementsByUserId.get(row.userId)?.tier ?? null,
    available_actions: getAvailableActions(normalizedType, normalizedType === "session" ? row.label : null),
    execution: buildOrderExecution(null, getOrderId(normalizedType, row.id), row.userId),
    recording_link: row.recordingLink,
    recording_added_at: row.recordingAddedAt?.toISOString() ?? null,
    refunded_at: row.refundedAt?.toISOString() ?? null,
    refund_reason: row.refundReason ?? null,
    refund_note: row.refundNote ?? null,
    metadata: {
      source_status: row.status,
      source_created_at: createdAt.toISOString(),
      product_name: productName,
      birth_date: null,
      birth_time: null,
      birth_location: null,
      intake: {
        ...emptyIntake,
        birth_date: linkedBooking?.birthDate ?? linkedBookingIntakeSnapshot?.birthDate ?? null,
        birth_time: linkedBooking?.birthTime ?? linkedBookingIntakeSnapshot?.birthTime ?? null,
        location: resolveLocation(
          linkedBookingIntakeSnapshot?.location ?? linkedBooking?.birthPlaceName,
          linkedBooking?.birthPlace,
        ),
        phone: linkedBookingIntakeSnapshot?.phone ?? linkedBooking?.phone ?? null,
        gender: linkedBookingIntakeSnapshot?.gender
          ?? linkedBookingIntakeSnapshot?.intake?.gender
          ?? linkedBookingIntake?.gender
          ?? null,
        timezone: bookingTimezone,
        consent_given: linkedBookingIntakeSnapshot?.consentGiven ?? linkedBooking?.consentGiven ?? null,
        submitted_questions: linkedBookingIntakeSnapshot?.submittedQuestions ?? [],
        topics: linkedBookingIntakeSnapshot?.intake?.topics ?? linkedBookingIntake?.topics ?? [],
        goals: linkedBookingIntakeSnapshot?.intake?.goals ?? linkedBookingIntake?.goals ?? [],
        health_focus_areas: linkedBookingIntakeSnapshot?.intake?.healthFocusAreas ?? linkedBookingIntake?.healthFocusAreas ?? [],
        manifestation_intention: linkedBookingIntakeSnapshot?.intake?.manifestationIntention ?? linkedBookingIntake?.manifestationIntention ?? null,
        other: linkedBookingIntakeSnapshot?.intake?.other ?? linkedBookingIntake?.other ?? null,
        notes: linkedBookingIntakeSnapshot?.notes ?? linkedBookingIntake?.notes ?? linkedBooking?.notes ?? null,
        manifestation_enhancement_selected: manifestationEnhancement?.selected ?? null,
        manifestation_goals: manifestationEnhancement?.intentions ?? null,
        manifestation_enhancement: manifestationEnhancement,
      },
      availability: bookingAvailability,
      report_type: null,
      report_type_id: null,
      training_package: null,
      training_package_id: null,
      selected_systems: [],
      delivery_status: null,
      session_type: normalizedType === "session" ? formatSessionTypeLabel(sessionType, row.label) : null,
      scheduled_at: normalizedType === "session" ? scheduledAt : null,
      meeting_link: normalizedType === "session" ? meetingLink : null,
      plan_name: normalizedType === "subscription" ? row.label : null,
      billing_cycle: getString(orderMetadata?.billingInterval)
        ?? getString(invoiceMetadata?.billingInterval)
        ?? (invoice?.billingMode === "subscription" ? "Monthly" : null),
      renewal_date: null,
      event_name: normalizedType === "webinar" ? row.label : null,
      event_date: null,
      access_link: null,
      stripe_subscription_id: row.stripeSubscriptionId ?? invoice?.stripeSubscriptionId ?? null,
      billing_mode: invoice?.billingMode ?? null,
      invoice_id: invoice?.id ?? row.invoiceId ?? null,
      invoice_status: invoice?.status ?? null,
      invoice_link: invoice?.stripePaymentLink ?? null,
      invoice_expires_at: toIso(invoice?.expiresAt ?? null),
      invoice_paid_at: toIso(invoice?.paidAt ?? null),
      invoice_consumed_at: toIso(invoice?.consumedAt ?? null),
      stripe_invoice_id: row.stripeInvoiceId,
      stripe_invoice_url: row.stripeInvoiceUrl,
      stripe_invoice_status: row.stripeInvoiceStatus,
      order_variant: row.type,
      invoice_label: invoice?.label ?? row.label,
      subscription_state: subscriptionState,
      failure_code: row.failureCode ?? invoice?.failureCode ?? null,
      failure_message: row.failureMessage ?? invoice?.failureMessage ?? null,
      failure_message_normalized: row.failureMessageNormalized ?? invoice?.failureMessageNormalized ?? null,
      last_payment_attempt_at: toIso(invoice?.lastPaymentAttemptAt ?? null),
      ...getEmptyRecoveryInvoiceMetadata(),
      invoice_origin: getString(orderMetadata?.invoice_origin),
      price_snapshot_cents: getNumber(orderMetadata?.price_snapshot_cents),
      price_snapshot_currency: getString(orderMetadata?.price_snapshot_currency),
      invoice_timeline: Array.isArray(orderMetadata?.invoice_timeline) ? orderMetadata.invoice_timeline : [],
      payment_match_strategy: "persisted_order",
      payment_source: persistedPaymentSource,
      payment_sync_status: persistedPaymentSource,
      stripe_checkout_session_id: row.paymentReference?.startsWith("cs_") ? row.paymentReference : invoice?.stripeCheckoutSessionId ?? null,
      manual_paid: persistedPaymentSource === "manual_paid",
    },
  };
}

async function buildAllOrders(db: Database, options: { showArchived?: boolean } = {}): Promise<AdminOrder[]> {
  const {
    userRows,
    clientRows,
    entitlementRows,
    invoiceRows,
    persistedOrderRows,
    bookingRows,
    regenerationSubscriptionRows,
    reportRows,
    subscriptionRows,
    mentorTrainingRows,
    webinarRows,
    paymentRows,
  } = await fetchSourceData(db, options);

  const usersById = new Map(userRows.map((row) => [row.id, row]));
  const { byUserId: clientsByUserId, byId: clientsById } = chooseLatestClientByUser(clientRows);
  const entitlementsByUserId = new Map(entitlementRows.map((row) => [row.userId, row]));
  const invoicesById = new Map(invoiceRows.map((row) => [row.id, row]));
  const regenerationSubscriptionsById = new Map(regenerationSubscriptionRows.map((row) => [row.id, row]));
  const bookingsById = new Map(bookingRows.map((row) => [row.id, row]));
  const bookingsByUserId = new Map<string, BookingSourceRow[]>();
  for (const row of bookingRows) {
    const existing = bookingsByUserId.get(row.userId) ?? [];
    existing.push(row);
    bookingsByUserId.set(row.userId, existing);
  }
  const paymentsByUser = buildPaymentMap(paymentRows);
  const sessionExecutionByOrderId = buildSessionExecutionMap(reportRows);
  const bookingBackedMentoringCircleEvents = new Set(
    bookingRows
      .filter((row) => row.sessionType === "mentoring_circle" && row.eventKey)
      .map((row) => `${row.userId}:${row.eventKey}`),
  );
  const persistedOrders = persistedOrderRows
    .map((row) =>
      createPersistedAdminOrder(
        row,
        usersById,
        clientsByUserId,
        clientsById,
        entitlementsByUserId,
        invoicesById,
        regenerationSubscriptionsById,
        bookingsById,
        bookingsByUserId,
      ))
    .filter((row): row is AdminOrder => Boolean(row));

  const candidates: OrderCandidate[] = [];
  for (const row of bookingRows) {
    try {
      const candidate = createSessionCandidate(
        row,
        usersById,
        clientsByUserId,
        entitlementsByUserId,
        sessionExecutionByOrderId,
      );
      if (candidate) {
        candidates.push(applyPersistedOrderState(
          candidate,
          findPersistedOrderForSource(persistedOrderRows, "session", row.id),
        ));
      }
    } catch (error) {
      logger.warn("orders_booking_aggregation_failed", { sourceId: row.id, userId: row.userId, error });
    }
  }
  for (const row of reportRows) {
    try {
      const candidate = createReportCandidate(row, usersById, clientsByUserId, clientsById, entitlementsByUserId);
      if (candidate) {
        candidates.push(applyPersistedOrderState(
          candidate,
          findPersistedOrderForSource(persistedOrderRows, "report", row.id),
        ));
      }
    } catch (error) {
      logger.warn("orders_report_aggregation_failed", { sourceId: row.id, userId: row.userId, error });
    }
  }
  for (const row of subscriptionRows) {
    try {
      const candidate = createSubscriptionCandidate(row, usersById, clientsByUserId, entitlementsByUserId);
      if (candidate) {
        candidates.push(applyPersistedOrderState(
          candidate,
          findPersistedOrderForSource(persistedOrderRows, "subscription", row.id),
        ));
      }
    } catch (error) {
      logger.warn("orders_subscription_aggregation_failed", { sourceId: row.id, userId: row.userId, error });
    }
  }
  for (const row of mentorTrainingRows) {
    try {
      const candidate = createMentorTrainingCandidate(row, usersById, clientsByUserId, entitlementsByUserId);
      if (candidate) {
        candidates.push(applyPersistedOrderState(
          candidate,
          findPersistedOrderForSource(persistedOrderRows, "mentor_training", row.id),
        ));
      }
    } catch (error) {
      logger.warn("orders_mentor_training_aggregation_failed", { sourceId: row.id, userId: row.userId, error });
    }
  }
  for (const row of webinarRows) {
    if (bookingBackedMentoringCircleEvents.has(`${row.userId}:${row.eventKey}`)) {
      continue;
    }
    try {
      const candidate = createWebinarCandidate(row, usersById, clientsByUserId, entitlementsByUserId);
      if (candidate) {
        candidates.push(applyPersistedOrderState(
          candidate,
          findPersistedOrderForSource(persistedOrderRows, "webinar", row.id),
        ));
      }
    } catch (error) {
      logger.warn("orders_webinar_aggregation_failed", { sourceId: row.id, userId: row.userId, error });
    }
  }

  candidates.sort((left, right) => right.sourceCreatedAt.getTime() - left.sourceCreatedAt.getTime());
  const claimedPaymentIds = new Set<string>();
  const persistedSourceBackedOrderIds = new Set<string>();
  for (const row of persistedOrderRows) {
    for (const candidate of candidates) {
      if (persistedOrderMatchesSource(row, candidate.type, candidate.sourceId)) {
        persistedSourceBackedOrderIds.add(getOrderId(candidate.type, row.id));
        persistedSourceBackedOrderIds.add(getOrderId(candidate.type, candidate.sourceId));
      }
    }
  }

  const orders = candidates.map((candidate) => {
    const { payment, strategy } = matchPaymentForOrder(candidate, paymentsByUser, claimedPaymentIds);
    if (!payment) {
      logger.warn("orders_payment_match_missing", buildOrdersLogContext(candidate));
    }
    return buildAdminOrder(candidate, payment, strategy);
  });

  const ordered = [...persistedOrders.filter((row) => !persistedSourceBackedOrderIds.has(row.id)), ...orders]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const visibleOrders = options.showArchived ? ordered : filterSupersededPendingAttempts(ordered);
  return attachSubscriptionDetails(db, visibleOrders);
}

export async function getOrdersGroupedByUser(
  db: Database,
  options: { showArchived?: boolean } = {},
): Promise<AdminOrdersGroupedByUser> {
  const grouped = new Map<string, AdminOrder[]>();
  const allOrders = await buildAllOrders(db, options);

  for (const order of allOrders) {
    const existing = grouped.get(order.user_id);
    if (existing) {
      existing.push(order);
      continue;
    }
    grouped.set(order.user_id, [order]);
  }

  return grouped;
}

export async function getAdminOrders(db: Database, query: AdminOrdersQuery = {}): Promise<AdminOrdersListResult> {
  const limit = clampLimit(query.limit);
  const offset = clampOffset(query.offset);
  const allOrders = await buildAllOrders(db, { showArchived: query.showArchived });
  const filteredOrders = allOrders.filter((order) => orderMatchesQuery(order, query));
  const data = filteredOrders.slice(offset, offset + limit);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / limit));
  const page = Math.floor(offset / limit) + 1;

  return {
    orders: data,
    data,
    pagination: {
      page,
      pageSize: limit,
      limit,
      offset,
      total: filteredOrders.length,
      totalPages,
      hasMore: offset + limit < filteredOrders.length,
    },
  };
}

export async function getAdminOrderById(db: Database, orderId: string): Promise<AdminOrder> {
  const allOrders = await buildAllOrders(db, { showArchived: true });
  const parsed = parseOrderId(orderId);
  const normalizedOrderId = getOrderId(parsed.type, parsed.sourceId);
  const order = allOrders.find((item) => item.id === normalizedOrderId);

  if (!order) {
    throw createHttpError(404, "Order not found");
  }

  return order;
}

function persistedOrderMatchesSource(row: {
  id: string;
  type: string;
  subscriptionId: string | null;
  metadata: unknown;
}, type: AdminOrderType, sourceId: string): boolean {
  const metadata = isRecord(row.metadata) ? row.metadata : null;

  if (row.id === sourceId) {
    return true;
  }

  if (type === "custom") {
    return row.id === sourceId;
  }

  if (type === "session") {
    return getString(metadata?.bookingId) === sourceId || getString(metadata?.booking_id) === sourceId;
  }

  if (type === "report") {
    return getString(metadata?.reportId) === sourceId || getString(metadata?.report_id) === sourceId;
  }

  if (type === "subscription") {
    return row.subscriptionId === sourceId
      || getString(metadata?.subscriptionId) === sourceId
      || getString(metadata?.subscription_id) === sourceId;
  }

  if (type === "webinar") {
    return getString(metadata?.eventKey) === sourceId || getString(metadata?.event_key) === sourceId;
  }

  if (type === "mentor_training") {
    return getString(metadata?.trainingOrderId) === sourceId
      || getString(metadata?.training_order_id) === sourceId;
  }

  return false;
}

export async function setArchivedStateForAdminOrders(
  db: Database,
  input: { orderIds: string[]; archived: boolean },
): Promise<{ updatedOrderIds: string[] }> {
  const parsedOrderMap = new Map<string, ParsedOrderId>();
  for (const orderId of input.orderIds) {
    const parsed = parseOrderId(orderId);
    parsedOrderMap.set(getOrderId(parsed.type, parsed.sourceId), parsed);
  }
  const parsedOrders = Array.from(parsedOrderMap.values());

  if (parsedOrders.length === 0) {
    return { updatedOrderIds: [] };
  }

  const now = new Date();
  const updatedOrderIds = parsedOrders.map((entry) => getOrderId(entry.type, entry.sourceId));
  const sourceIdsByType = {
    session: parsedOrders.filter((entry) => entry.type === "session").map((entry) => entry.sourceId),
    report: parsedOrders.filter((entry) => entry.type === "report").map((entry) => entry.sourceId),
    subscription: parsedOrders.filter((entry) => entry.type === "subscription").map((entry) => entry.sourceId),
    mentor_training: parsedOrders.filter((entry) => entry.type === "mentor_training").map((entry) => entry.sourceId),
    webinar: parsedOrders.filter((entry) => entry.type === "webinar").map((entry) => entry.sourceId),
    custom: parsedOrders.filter((entry) => entry.type === "custom").map((entry) => entry.sourceId),
  };

  await db.transaction(async (tx) => {
    if (sourceIdsByType.session.length > 0) {
      await tx
        .update(bookings)
        .set({ archived: input.archived, archived_at: input.archived ? now : null, updated_at: now })
        .where(inArray(bookings.id, sourceIdsByType.session));
    }

    if (sourceIdsByType.report.length > 0) {
      await tx
        .update(reports)
        .set({ archived: input.archived, archived_at: input.archived ? now : null, updated_at: now })
        .where(inArray(reports.id, sourceIdsByType.report));
    }

    if (sourceIdsByType.subscription.length > 0) {
      await tx
        .update(subscriptions)
        .set({ archived: input.archived, archived_at: input.archived ? now : null, updated_at: now })
        .where(inArray(subscriptions.id, sourceIdsByType.subscription));
    }

    if (sourceIdsByType.mentor_training.length > 0) {
      await tx
        .update(mentorTrainingOrders)
        .set({ archived: input.archived, archived_at: input.archived ? now : null, updated_at: now })
        .where(inArray(mentorTrainingOrders.id, sourceIdsByType.mentor_training));
    }

    if (sourceIdsByType.webinar.length > 0) {
      await tx
        .update(mentoringCircleRegistrations)
        .set({ archived: input.archived, archived_at: input.archived ? now : null, updated_at: now })
        .where(inArray(mentoringCircleRegistrations.id, sourceIdsByType.webinar));
    }

    const persistedRows = await tx
      .select({
        id: persistedOrdersTable.id,
        type: persistedOrdersTable.type,
        subscriptionId: persistedOrdersTable.subscription_id,
        metadata: persistedOrdersTable.metadata,
      })
      .from(persistedOrdersTable);

    const persistedIds = new Set<string>(sourceIdsByType.custom);
    for (const row of persistedRows) {
      for (const parsed of parsedOrders) {
        if (persistedOrderMatchesSource(row, parsed.type, parsed.sourceId)) {
          persistedIds.add(row.id);
        }
      }
    }

    if (persistedIds.size > 0) {
      await tx
        .update(persistedOrdersTable)
        .set({ archived: input.archived, archived_at: input.archived ? now : null, updated_at: now })
        .where(inArray(persistedOrdersTable.id, Array.from(persistedIds)));
    }
  });

  return { updatedOrderIds };
}
