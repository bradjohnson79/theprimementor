import { formatPacificTime } from "@wisdom/utils";

export type OrderType = "session" | "report" | "subscription" | "webinar" | "mentor_training" | "custom";
export type OrderStatus =
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
export type AdminOrderAvailabilityDay = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
export type AdminOrderAvailability = Record<AdminOrderAvailabilityDay, string[]>;
export type AdminOrderHealthFocusArea = {
  name: string;
  severity: number;
};
export type AdminOrderManifestationEnhancement = {
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
  actor_type: "admin" | "system" | "webhook" | "stripe";
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
  type: OrderType;
  status: OrderStatus;
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
    training_package: string | null;
    training_package_id: string | null;
    selected_systems: string[];
    delivery_status: string | null;
    session_type: string | null;
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
    recovery_invoice_id: string | null;
    recovery_invoice_sent_at: string | null;
    recovery_invoice_hosted_url: string | null;
    invoice_origin?: string | null;
    price_snapshot_cents?: number | null;
    price_snapshot_currency?: string | null;
    invoice_timeline?: unknown[];
  };
}

export interface AdminOrdersResponse {
  orders?: AdminOrder[];
  data: AdminOrder[];
  pagination: {
    page?: number;
    pageSize?: number;
    limit: number;
    offset: number;
    total: number;
    totalPages?: number;
    hasMore: boolean;
  };
}

export interface AdminOrderDetailResponse {
  data: AdminOrder;
}

export interface AdminOrderIntakeUpdateBody {
  phone: string | null;
  birth_date: string | null;
  birth_time: string | null;
  location: string | null;
  timezone: string | null;
  consent_given: boolean;
  topics: string[];
  goals: string[];
  health_focus_areas: AdminOrderHealthFocusArea[];
  other: string | null;
  submitted_questions: string[];
  notes: string | null;
}

export interface AdminOrderRecoveryInvoiceResponse {
  order: AdminOrder;
  stripeInvoiceId: string;
  hostedInvoiceUrl: string | null;
  resent: boolean;
}

export interface AdminOrderCreateInvoiceResponse {
  success: true;
  invoiceId: string;
  invoiceUrl: string | null;
  invoiceStatus: string;
  order: AdminOrder;
}

export interface AdminOrderMarkPaidResponse {
  order: AdminOrder;
}

export interface AdminOrderGenerateResponse {
  data: AdminOrder | null;
  output: AdminOrderOutput | null;
  outcome: string;
  message: string;
  report_id: string | null;
  details: unknown;
}

export interface AdminOrderArchiveResponse {
  data: {
    updatedOrderIds: string[];
  };
}

export interface AdminInvoice {
  id: string;
  client_id: string;
  user_id: string;
  stripe_payment_link: string | null;
  product_type: OrderType;
  label: string;
  amount: number;
  currency: string;
  billing_mode: "one_time" | "subscription";
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

export interface AdminInvoiceResponse {
  data: AdminInvoice;
}

export const ORDER_TYPE_TABS: Array<{ id: "all" | OrderType; label: string }> = [
  { id: "all", label: "All" },
  { id: "session", label: "Sessions" },
  { id: "report", label: "Reports" },
  { id: "subscription", label: "Subscriptions" },
  { id: "webinar", label: "Webinars" },
  { id: "mentor_training", label: "Mentor Training" },
];

export function formatOrderMoney(amount: number, currency: string) {
  if (!currency) {
    return amount === 0 ? "Unpaid" : `${amount.toFixed(2)}`;
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatOrderDate(value: string) {
  return formatPacificTime(value);
}

export function getOrderTypeLabel(type: OrderType) {
  switch (type) {
    case "session":
      return "Session";
    case "report":
      return "Report";
    case "subscription":
      return "Subscription";
    case "webinar":
      return "Webinar";
    case "mentor_training":
      return "Mentor Training";
    case "custom":
      return "Custom";
  }
}

function titleCaseLabel(value: string | null) {
  if (!value) return null;
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function withSuffix(label: string | null, suffix: string) {
  if (!label) return null;
  return label.toLowerCase().endsWith(suffix.toLowerCase()) ? label : `${label} ${suffix}`;
}

export function getOrderServiceLabel(order: AdminOrder) {
  if (order.product_name?.trim()) {
    return order.product_name;
  }
  if (order.metadata.product_name?.trim()) {
    return order.metadata.product_name;
  }
  switch (order.type) {
    case "session":
      return withSuffix(order.metadata.session_type, "Session")
        ?? order.metadata.invoice_label
        ?? "Session";
    case "report":
      return withSuffix(order.metadata.report_type, "Report")
        ?? order.metadata.invoice_label
        ?? "Report";
    case "subscription":
      return order.metadata.plan_name
        ?? withSuffix(titleCaseLabel(order.membership_tier), "Membership")
        ?? order.metadata.invoice_label
        ?? "Membership";
    case "webinar":
      return order.metadata.event_name
        ?? order.metadata.invoice_label
        ?? "Webinar";
    case "mentor_training":
      return order.metadata.training_package
        ?? order.metadata.plan_name
        ?? "Mentor Training";
    case "custom":
      return order.metadata.invoice_label
        ?? titleCaseLabel(order.metadata.order_variant)
        ?? "Custom";
  }
}

export function getPaymentMatchLabel(value: string | null) {
  switch (value) {
    case "direct_foreign_key":
      return "Direct foreign key";
    case "source_payment_intent_id":
      return "Source payment intent";
    case "stripe_metadata":
      return "Stripe metadata";
    case "latest_user_window":
      return "User time-window fallback";
    case "persisted_order":
      return "Persisted order";
    default:
      return "No payment match";
  }
}

export function getOrderExecutionLabel(value: OrderExecutionState) {
  switch (value) {
    case "generating":
      return "Generating";
    case "awaiting_input":
      return "Awaiting Input";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Idle";
  }
}
