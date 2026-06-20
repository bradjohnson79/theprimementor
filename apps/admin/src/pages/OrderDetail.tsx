import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import Card from "../components/Card";
import Loading from "../components/Loading";
import OrderStatusBadge from "../components/OrderStatusBadge";
import { api } from "../lib/api";
import type { AdminInvoiceResponse } from "../lib/orders";
import type {
  AdminOrderCreateInvoiceResponse,
  AdminOrder,
  AdminOrderAvailability,
  AdminOrderAvailabilityDay,
  AdminOrderDetailResponse,
  AdminOrderGenerateResponse,
  AdminOrderIntakeUpdateBody,
  AdminOrderMarkPaidResponse,
  AdminOrderRecoveryInvoiceResponse,
  AdminSubscriptionDetails,
} from "../lib/orders";
import { formatOrderDate, formatOrderMoney, getOrderExecutionLabel, getOrderTypeLabel, getPaymentMatchLabel } from "../lib/orders";

function renderValue(value: string | null | undefined) {
  return value && value.trim() ? value : "—";
}

function renderList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "—";
}

function renderBoolean(value: boolean | null | undefined) {
  return typeof value === "boolean" ? (value ? "Yes" : "No") : "—";
}

const AVAILABILITY_DAY_LABELS: Record<AdminOrderAvailabilityDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

const AVAILABILITY_DAYS: AdminOrderAvailabilityDay[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];

function formatAvailabilityTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date(Date.UTC(2000, 0, 1, hours, minutes));
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function hasAvailability(availability: AdminOrderAvailability | null) {
  return Boolean(availability && AVAILABILITY_DAYS.some((day) => (availability[day] ?? []).length > 0));
}

function renderAvailability(availability: AdminOrderAvailability | null) {
  if (!hasAvailability(availability)) {
    return "—";
  }

  return (
    <div className="space-y-1.5">
      {AVAILABILITY_DAYS.map((day) => {
        const times = availability?.[day] ?? [];
        if (times.length === 0) return null;

        return (
          <p key={day}>
            {AVAILABILITY_DAY_LABELS[day]}:{" "}
            <span className="text-white/70">{times.map(formatAvailabilityTime).join(", ")}</span>
          </p>
        );
      })}
    </div>
  );
}

function renderHealthFocusAreas(values: AdminOrder["metadata"]["intake"]["health_focus_areas"]) {
  if (values.length === 0) return "—";
  return values.map((entry) => `${entry.name} (${entry.severity}/10)`).join(", ");
}

function formatDuration(durationMs: number | null) {
  if (!durationMs || durationMs <= 0) return "—";
  if (durationMs < 1000) return `${durationMs} ms`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

function ExecutionBadge({ state }: { state: AdminOrder["execution"]["state"] }) {
  const styles: Record<AdminOrder["execution"]["state"], string> = {
    idle: "border-white/10 bg-white/5 text-white/65",
    generating: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
    awaiting_input: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    completed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    failed: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${styles[state]}`}>
      {getOrderExecutionLabel(state)}
    </span>
  );
}

const REFUND_REASON_OPTIONS = [
  { value: "requested_by_customer", label: "Requested by customer" },
  { value: "fraudulent", label: "Fraudulent" },
  { value: "duplicate", label: "Duplicate" },
  { value: "other", label: "Other" },
] as const;

interface IntakeFormState {
  phone: string;
  birthDate: string;
  birthTime: string;
  location: string;
  timezone: string;
  consentGiven: boolean;
  topics: string;
  goals: string;
  healthFocusAreas: string;
  other: string;
  submittedQuestions: string;
  notes: string;
}

function listToLines(values: string[]) {
  return values.join("\n");
}

function healthFocusAreasToLines(values: AdminOrder["metadata"]["intake"]["health_focus_areas"]) {
  return values.map((entry) => `${entry.name} | ${entry.severity}`).join("\n");
}

function createIntakeFormState(order: AdminOrder): IntakeFormState {
  const intake = order.metadata.intake;
  return {
    phone: intake.phone ?? "",
    birthDate: intake.birth_date ?? "",
    birthTime: intake.birth_time ?? "",
    location: intake.location ?? "",
    timezone: intake.timezone ?? "",
    consentGiven: intake.consent_given === true,
    topics: listToLines(intake.topics),
    goals: listToLines(intake.goals),
    healthFocusAreas: healthFocusAreasToLines(intake.health_focus_areas),
    other: intake.other ?? "",
    submittedQuestions: listToLines(intake.submitted_questions),
    notes: intake.notes ?? "",
  };
}

function splitLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseHealthFocusAreas(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [namePart, severityPart] = entry.split("|").map((part) => part.trim());
      const severity = Number(severityPart ?? "5");
      if (!namePart || !Number.isInteger(severity) || severity < 1 || severity > 10) {
        throw new Error("Health focus areas must be entered as \"Name | severity\", with severity from 1 to 10.");
      }
      return { name: namePart, severity };
    });
}

function nullableFormValue(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getRefundPolicyNote(order: AdminOrder) {
  if (order.type === "subscription") {
    return "Subscriptions are non-refundable, but they can be canceled before the next billing cycle.";
  }

  if (order.type === "report") {
    return order.metadata.delivery_status === "fulfilled" || order.execution.state === "completed"
      ? "Reports are non-refundable after delivery."
      : "Reports are generally non-refundable. Admin refunds are only allowed when a report has not been delivered within the projected timeframe.";
  }

  return "Stripe will process the refund immediately. Local order records will only update after Stripe confirms the refund request.";
}

function formatInvoiceStatusLabel(status: string | null | undefined) {
  if (!status) return "Unknown";
  return status
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type SubscriptionActionId = keyof typeof SUBSCRIPTION_ACTION_LABELS;

const SUBSCRIPTION_ACTION_LABELS = {
  view_subscription: "View Subscription",
  pause_subscription: "Pause Subscription",
  resume_subscription: "Resume Subscription",
  cancel_period_end: "Cancel At Period End",
  cancel_immediately: "Cancel Immediately",
  reactivate_subscription: "Reactivate Subscription",
  extend_renewal: "Extend Renewal Date",
  grant_courtesy_month: "Grant Courtesy Month",
  retry_payment: "Retry Payment",
  send_manual_invoice: "Manual Invoice Send",
  extend_regeneration_access: "Extend Access",
  toggle_regeneration_priority_support: "Toggle Priority Support",
  set_regeneration_grace_period: "Manual Grace Period",
  emergency_reactivate_regeneration: "Emergency Reactivation",
} as const;

const SUBSCRIPTION_ACTION_ENDPOINTS: Partial<Record<SubscriptionActionId, string>> = {
  pause_subscription: "pause",
  resume_subscription: "resume",
  cancel_period_end: "cancel-period-end",
  cancel_immediately: "cancel-immediately",
  reactivate_subscription: "reactivate",
  extend_renewal: "extend-renewal",
  grant_courtesy_month: "grant-courtesy-month",
  retry_payment: "retry-payment",
  send_manual_invoice: "send-manual-invoice",
  extend_regeneration_access: "regeneration/extend-access",
  toggle_regeneration_priority_support: "regeneration/priority-support",
  set_regeneration_grace_period: "regeneration/grace-period",
  emergency_reactivate_regeneration: "regeneration/emergency-reactivate",
};

const SUBSCRIPTION_DAY_ACTIONS = new Set<SubscriptionActionId>([
  "extend_renewal",
  "extend_regeneration_access",
  "set_regeneration_grace_period",
]);

function formatSubscriptionLifecycle(value: AdminSubscriptionDetails["lifecycle_status"]) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function subscriptionActionButtonClass(subscription: AdminSubscriptionDetails, action: SubscriptionActionId) {
  const severity = subscription.action_requirements[action]?.severity ?? "secondary";
  if (severity === "danger") {
    return "rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60";
  }
  if (severity === "primary") {
    return "rounded-xl border border-cyan-300/30 bg-gradient-to-r from-cyan-400/20 via-sky-400/20 to-violet-400/20 px-4 py-2.5 text-sm font-medium text-cyan-100 shadow-[0_0_20px_rgba(56,189,248,0.14)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60";
  }
  return "rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/75 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60";
}

function subscriptionActionDescription(action: SubscriptionActionId) {
  switch (action) {
    case "cancel_period_end":
      return "The client will retain access until the current billing cycle ends.";
    case "cancel_immediately":
      return "This will immediately revoke subscription access.";
    case "pause_subscription":
      return "Billing collection is paused in Stripe and local access is suspended until resumed.";
    case "resume_subscription":
      return "Stripe billing collection and local access will be restored if the subscription is active.";
    case "reactivate_subscription":
      return "Auto-renew will be re-enabled in Stripe.";
    default:
      return "This action will be audit logged with the current admin identity.";
  }
}

function formatSubscriptionActivityAction(action: string) {
  return action
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const { getToken } = useAuth();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [regeneratingLink, setRegeneratingLink] = useState(false);
  const [recordingLinkInput, setRecordingLinkInput] = useState("");
  const [savingRecording, setSavingRecording] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState<(typeof REFUND_REASON_OPTIONS)[number]["value"]>("requested_by_customer");
  const [refundCustomReason, setRefundCustomReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [sendingRecoveryInvoice, setSendingRecoveryInvoice] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [createdInvoiceUrl, setCreatedInvoiceUrl] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [editingIntake, setEditingIntake] = useState(false);
  const [intakeForm, setIntakeForm] = useState<IntakeFormState | null>(null);
  const [savingIntake, setSavingIntake] = useState(false);
  const [subscriptionAction, setSubscriptionAction] = useState<SubscriptionActionId | null>(null);
  const [subscriptionActionReason, setSubscriptionActionReason] = useState("");
  const [subscriptionActionDays, setSubscriptionActionDays] = useState("30");
  const [subscriptionActionProcessing, setSubscriptionActionProcessing] = useState(false);
  const [subscriptionNote, setSubscriptionNote] = useState("");
  const [savingSubscriptionNote, setSavingSubscriptionNote] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setError("Order not found.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = (await api.get(`/admin/orders/${orderId}`, token)) as AdminOrderDetailResponse;
      setOrder(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order.");
    } finally {
      setLoading(false);
    }
  }, [getToken, orderId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await loadOrder();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load order.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [loadOrder]);

  useEffect(() => {
    setRecordingLinkInput(order?.recording_link ?? "");
  }, [order?.recording_link]);

  const canGenerate = useMemo(
    () => {
      if (!order?.available_actions.includes("generate_output")) {
        return false;
      }
      const sessionLabel = order.metadata.session_type?.toLowerCase().replace(/[^a-z]+/g, "_") ?? "";
      return !sessionLabel.includes("qa_session") && !sessionLabel.includes("q_a_session");
    },
    [order],
  );

  const canSendRecoveryInvoice = useMemo(
    () => Boolean(order?.type === "report" && order.status === "pending_payment"),
    [order],
  );

  const canMarkAsPaid = useMemo(() => {
    if (!order) return false;
    if (["paid", "completed", "refunded", "cancelled"].includes(order.status)) return false;
    if (order.type === "custom") return false;
    if (order.type === "webinar" && !order.payment_id) return false;
    return true;
  }, [order]);

  const canCreateInvoice = useMemo(() => {
    if (!order) return false;
    const supportsManualInvoice = order.type === "session"
      || (order.type === "subscription" && order.subscription?.kind === "membership");
    if (!supportsManualInvoice) return false;
    if (order.metadata.stripe_invoice_id) return false;
    return !["paid", "completed", "refunded", "cancelled"].includes(order.status);
  }, [order]);

  const createInvoiceUnavailableReason = useMemo(() => {
    if (!order) return "Order is still loading.";
    const supportsManualInvoice = order.type === "session"
      || (order.type === "subscription" && order.subscription?.kind === "membership");
    if (!supportsManualInvoice) {
      return "Manual invoice creation is currently only supported for session orders and recurring membership subscriptions.";
    }
    if (order.metadata.stripe_invoice_id) return "Invoice already exists for this order.";
    if (["paid", "completed", "refunded", "cancelled"].includes(order.status)) {
      return "Invoice cannot be created for an order that is already paid or closed.";
    }
    return null;
  }, [order]);

  async function handleGenerate(force = false) {
    if (!orderId || !canGenerate) return;

    setGenerating(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const token = await getToken();
      const query = force ? "?force=true" : "";
      const response = (await api.post(`/admin/orders/${orderId}/generate${query}`, {}, token)) as AdminOrderGenerateResponse;
      if (response.data) {
        setOrder(response.data);
      } else {
        await loadOrder();
      }

      if (response.outcome === "failed" || response.outcome === "awaiting_input") {
        setActionError(response.message);
      } else {
        setActionSuccess(response.message);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to generate output.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerateLink() {
    if (!order?.metadata.invoice_id) return;
    setRegeneratingLink(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const token = await getToken();
      const response = await api.post(
        `/admin/invoices/${order.metadata.invoice_id}/regenerate`,
        {},
        token,
      ) as AdminInvoiceResponse;
      await loadOrder();
      setActionSuccess(response.data.stripe_payment_link ? "Payment link regenerated." : "Invoice regenerated.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to regenerate payment link.");
    } finally {
      setRegeneratingLink(false);
    }
  }

  async function handleSaveRecording() {
    if (!orderId || order?.type !== "session") return;

    const trimmed = recordingLinkInput.trim();
    if (!trimmed) {
      setActionError("Recording link is required.");
      setActionSuccess(null);
      return;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("unsupported");
      }
    } catch {
      setActionError("Recording link must be a valid URL.");
      setActionSuccess(null);
      return;
    }

    setSavingRecording(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const token = await getToken();
      const response = (await api.post(
        `/admin/orders/${orderId}/recording`,
        { link: trimmed },
        token,
      )) as AdminOrderDetailResponse;
      setOrder(response.data);
      setActionSuccess(order.recording_link ? "Recording updated." : "Recording added.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save recording.");
    } finally {
      setSavingRecording(false);
    }
  }

  async function handleSendRecoveryInvoice() {
    if (!orderId || !canSendRecoveryInvoice) return;

    setSendingRecoveryInvoice(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const token = await getToken();
      const response = (await api.post(
        `/admin/orders/${orderId}/send-recovery-invoice`,
        {},
        token,
      )) as AdminOrderRecoveryInvoiceResponse;
      setOrder(response.order);
      setActionSuccess(
        response.resent
          ? "Invoice email resent to the customer."
          : "Stripe invoice created and emailed to the customer. This order will show Paid when they complete payment.",
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to send Stripe invoice.");
    } finally {
      setSendingRecoveryInvoice(false);
    }
  }

  async function handleCreateInvoice() {
    if (!orderId || !canCreateInvoice) return;

    setCreatingInvoice(true);
    setActionError(null);
    setActionSuccess(null);
    setCreatedInvoiceUrl(null);

    try {
      const token = await getToken();
      const response = (await api.post(
        `/admin/orders/${orderId}/create-invoice`,
        {},
        token,
      )) as AdminOrderCreateInvoiceResponse;
      setOrder(response.order);
      setCreatedInvoiceUrl(response.invoiceUrl);
      setActionSuccess("Invoice created and emailed to customer.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to create invoice. Please try again.");
    } finally {
      setCreatingInvoice(false);
    }
  }

  async function handleCopyInvoiceLink(url: string) {
    await navigator.clipboard.writeText(url);
  }

  async function handleMarkAsPaid() {
    if (!orderId || !canMarkAsPaid) return;

    setMarkingPaid(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const token = await getToken();
      const response = (await api.post(
        `/admin/orders/${orderId}/mark-paid`,
        {},
        token,
      )) as AdminOrderMarkPaidResponse;
      setOrder(response.order);
      setActionSuccess("Order marked as paid. Local records are updated; Stripe was not charged.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to mark order as paid.");
    } finally {
      setMarkingPaid(false);
    }
  }

  function handleStartEditingIntake() {
    if (!order) return;
    setIntakeForm(createIntakeFormState(order));
    setEditingIntake(true);
    setActionError(null);
    setActionSuccess(null);
  }

  function handleCancelEditingIntake() {
    setEditingIntake(false);
    setIntakeForm(null);
  }

  function updateIntakeForm(patch: Partial<IntakeFormState>) {
    setIntakeForm((current) => current ? { ...current, ...patch } : current);
  }

  async function handleSaveIntake() {
    if (!orderId || !intakeForm) return;

    let payload: AdminOrderIntakeUpdateBody;
    try {
      payload = {
        phone: nullableFormValue(intakeForm.phone),
        birth_date: nullableFormValue(intakeForm.birthDate),
        birth_time: nullableFormValue(intakeForm.birthTime),
        location: nullableFormValue(intakeForm.location),
        timezone: nullableFormValue(intakeForm.timezone),
        consent_given: intakeForm.consentGiven,
        topics: splitLines(intakeForm.topics),
        goals: splitLines(intakeForm.goals),
        health_focus_areas: parseHealthFocusAreas(intakeForm.healthFocusAreas),
        other: nullableFormValue(intakeForm.other),
        submitted_questions: splitLines(intakeForm.submittedQuestions),
        notes: nullableFormValue(intakeForm.notes),
      };
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Invalid intake form data.");
      setActionSuccess(null);
      return;
    }

    setSavingIntake(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const token = await getToken();
      const response = (await api.patch(
        `/admin/orders/${orderId}/intake`,
        payload,
        token,
      )) as AdminOrderDetailResponse;
      setOrder(response.data);
      setIntakeForm(createIntakeFormState(response.data));
      setEditingIntake(false);
      setActionSuccess("Intake form data updated.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update intake form data.");
    } finally {
      setSavingIntake(false);
    }
  }

  async function handleRefundOrder() {
    if (!orderId || !order) return;

    const customReason = refundCustomReason.trim();
    if (refundReason === "other" && !customReason) {
      setActionError("Custom refund reason is required.");
      setActionSuccess(null);
      return;
    }

    setRefunding(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const token = await getToken();
      const response = (await api.post(
        `/admin/orders/${orderId}/refund`,
        {
          reason: refundReason,
          ...(refundReason === "other" ? { customReason } : {}),
        },
        token,
      )) as AdminOrderDetailResponse;
      setOrder(response.data);
      setRefundModalOpen(false);
      setRefundReason("requested_by_customer");
      setRefundCustomReason("");
      setActionSuccess("Refund processed.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Refund failed.");
    } finally {
      setRefunding(false);
    }
  }

  function openSubscriptionAction(action: SubscriptionActionId) {
    if (!order?.subscription?.local_id) return;
    if (action === "view_subscription") {
      const stripeSubscriptionId = order.subscription.stripe_subscription_id;
      if (stripeSubscriptionId) {
        window.open(`https://dashboard.stripe.com/subscriptions/${stripeSubscriptionId}`, "_blank", "noopener,noreferrer");
      }
      return;
    }
    const defaultDays = action === "extend_regeneration_access" || action === "set_regeneration_grace_period" ? "14" : "30";
    setSubscriptionAction(action);
    setSubscriptionActionReason("");
    setSubscriptionActionDays(defaultDays);
    setActionError(null);
    setActionSuccess(null);
  }

  async function handleSubscriptionAction() {
    if (!order?.subscription?.local_id || !subscriptionAction) return;
    const endpoint = SUBSCRIPTION_ACTION_ENDPOINTS[subscriptionAction];
    if (!endpoint) return;
    const requirement = order.subscription.action_requirements[subscriptionAction];
    const reason = subscriptionActionReason.trim();
    if (requirement?.reason_required && !reason) {
      setActionError("Admin action reason is required.");
      setActionSuccess(null);
      return;
    }

    const body: Record<string, unknown> = {};
    if (reason) body.reason = reason;
    if (SUBSCRIPTION_DAY_ACTIONS.has(subscriptionAction)) {
      const days = Number(subscriptionActionDays);
      if (!Number.isInteger(days) || days < 1) {
        setActionError("Days must be a positive whole number.");
        setActionSuccess(null);
        return;
      }
      body.days = days;
    }
    if (subscriptionAction === "toggle_regeneration_priority_support") {
      body.enabled = !order.subscription.priority_support;
    }

    setSubscriptionActionProcessing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const token = await getToken();
      await api.post(`/admin/subscriptions/${order.subscription.local_id}/${endpoint}`, body, token);
      await loadOrder();
      setSubscriptionAction(null);
      setSubscriptionActionReason("");
      setActionSuccess(`${SUBSCRIPTION_ACTION_LABELS[subscriptionAction]} completed.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Subscription action failed.");
    } finally {
      setSubscriptionActionProcessing(false);
    }
  }

  async function handleSaveSubscriptionNote() {
    if (!order?.subscription?.local_id) return;
    const note = subscriptionNote.trim();
    if (!note) {
      setActionError("Admin note is required.");
      setActionSuccess(null);
      return;
    }
    setSavingSubscriptionNote(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const token = await getToken();
      await api.post(`/admin/subscriptions/${order.subscription.local_id}/notes`, { note }, token);
      setSubscriptionNote("");
      await loadOrder();
      setActionSuccess("Admin note saved.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save admin note.");
    } finally {
      setSavingSubscriptionNote(false);
    }
  }

  if (loading) {
    return <Loading />;
  }

  if (error || !order) {
    return (
      <div className="text-center text-white/60">
        <p>{error || "Order not found"}</p>
        <Link to="/admin/orders" className="mt-4 inline-block text-accent-cyan hover:underline">
          Back to Orders
        </Link>
      </div>
    );
  }

  const isGenerating = generating || order.execution.state === "generating";
  const generateButtonLabel = isGenerating ? "Generating..." : "Generate Output";
  const reportRefundEligible = order.type !== "report"
    || (order.metadata.delivery_status !== "fulfilled" && order.execution.state !== "completed");
  const canRefund = order.type !== "subscription"
    && reportRefundEligible
    && order.status !== "refunded"
    && ["paid", "completed", "processing", "in_progress"].includes(order.status)
    && Boolean(order.stripe_payment_id || order.payment_id);
  const refundPolicyNote = getRefundPolicyNote(order);
  const subscription = order.subscription ?? null;
  const subscriptionInlineActions = subscription?.available_actions.filter((action): action is SubscriptionActionId =>
    action in SUBSCRIPTION_ACTION_LABELS && action !== "view_subscription" && subscription.action_requirements[action]?.severity !== "danger") ?? [];
  const subscriptionDangerActions = subscription?.available_actions.filter((action): action is SubscriptionActionId =>
    action in SUBSCRIPTION_ACTION_LABELS && subscription.action_requirements[action]?.severity === "danger") ?? [];
  const selectedSubscriptionRequirement = subscriptionAction && subscription
    ? subscription.action_requirements[subscriptionAction]
    : null;
  const isRegenerationOrder = (order.type === "session" && order.metadata.session_type === "regeneration")
    || order.subscription?.kind === "regeneration"
    || order.metadata.order_variant === "regeneration_monthly_package";
  const manifestationEnhancement = order.metadata.intake.manifestation_enhancement;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <Link to="/admin/orders" className="text-sm text-accent-cyan hover:underline">
        ← Back to Orders
      </Link>

      <Card>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.28em] text-white/40">Order Header</p>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-white">{order.id}</h2>
              <OrderStatusBadge status={order.status} />
              <ExecutionBadge state={order.execution.state} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div>
                <p className="text-xs text-white/40">Product</p>
                <p className="mt-1 text-white/85">{renderValue(order.product_name)}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Order Type</p>
                <p className="mt-1 text-white/85">{getOrderTypeLabel(order.type)}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Date</p>
                <p className="mt-1 text-white/85">{formatOrderDate(order.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Amount</p>
                <p className="mt-1 text-white/85">{formatOrderMoney(order.amount, order.currency)}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Available Actions</p>
                {subscription ? (
                  <p className="mt-1 text-white/85">
                    {formatSubscriptionLifecycle(subscription.lifecycle_status)}
                    {subscription.cancel_at_period_end && subscription.current_period_end
                      ? ` · cancels ${formatOrderDate(subscription.current_period_end)}`
                      : ""}
                  </p>
                ) : (
                  <p className="mt-1 text-white/85">{renderList(order.available_actions)}</p>
                )}
              </div>
            </div>
            {order.metadata.recovery_invoice_sent_at || order.metadata.recovery_invoice_hosted_url ? (
              <p className="text-xs text-amber-100/85">
                Recovery invoice
                {order.metadata.recovery_invoice_sent_at
                  ? ` sent ${formatOrderDate(order.metadata.recovery_invoice_sent_at)}`
                  : ""}
                {order.metadata.recovery_invoice_hosted_url ? (
                  <>
                    {" · "}
                    <a
                      href={order.metadata.recovery_invoice_hosted_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-200 underline decoration-amber-200/40 underline-offset-2 hover:text-white"
                    >
                      View / pay
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleGenerate(false)}
              disabled={!canGenerate || isGenerating}
              className="rounded-xl border border-cyan-300/30 bg-gradient-to-r from-cyan-400/20 via-sky-400/20 to-violet-400/20 px-5 py-3 text-sm font-medium text-cyan-100 shadow-[0_0_24px_rgba(56,189,248,0.18)] transition hover:scale-[1.02] hover:shadow-[0_0_32px_rgba(99,102,241,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generateButtonLabel}
            </button>
            {canSendRecoveryInvoice ? (
              <button
                type="button"
                onClick={() => void handleSendRecoveryInvoice()}
                disabled={sendingRecoveryInvoice}
                className="rounded-xl border border-amber-300/35 bg-amber-500/10 px-5 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendingRecoveryInvoice ? "Sending…" : "Email Stripe invoice"}
              </button>
            ) : null}
            {canMarkAsPaid ? (
              <button
                type="button"
                onClick={() => void handleMarkAsPaid()}
                disabled={markingPaid}
                className="rounded-xl border border-emerald-300/35 bg-emerald-500/10 px-5 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {markingPaid ? "Updating…" : "Mark as paid"}
              </button>
            ) : null}
            {order.type === "session" || (order.type === "subscription" && order.subscription?.kind === "membership") ? (
              <button
                type="button"
                onClick={() => void handleCreateInvoice()}
                disabled={!canCreateInvoice || creatingInvoice}
                title={createInvoiceUnavailableReason ?? undefined}
                className="rounded-xl border border-sky-300/35 bg-sky-500/10 px-5 py-3 text-sm font-medium text-sky-100 transition hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingInvoice
                  ? "Creating…"
                  : order.metadata.stripe_invoice_id
                    ? "Invoice Created"
                    : "Create Invoice"}
              </button>
            ) : null}
            {subscription?.stripe_subscription_id ? (
              <button
                type="button"
                onClick={() => openSubscriptionAction("view_subscription")}
                className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-5 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/15"
              >
                View Subscription
              </button>
            ) : null}
            {subscriptionInlineActions.map((action) => {
              const requirement = subscription?.action_requirements[action];
              return (
                <button
                  key={action}
                  type="button"
                  onClick={() => openSubscriptionAction(action)}
                  disabled={!subscription?.local_id || requirement?.disabled || subscriptionActionProcessing}
                  title={requirement?.disabled_reason ?? undefined}
                  className={subscription ? subscriptionActionButtonClass(subscription, action) : ""}
                >
                  {SUBSCRIPTION_ACTION_LABELS[action]}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => canRefund && setRefundModalOpen(true)}
              disabled={!canRefund || refunding}
              title={order.type === "subscription" ? "Subscriptions are managed through Stripe billing lifecycle controls." : undefined}
              className={order.type === "subscription"
                ? "rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/35 transition disabled:cursor-not-allowed"
                : "rounded-xl border border-rose-300/30 bg-rose-500/10 px-5 py-3 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"}
            >
              {order.status === "refunded"
                ? "Order Refunded"
                : order.type === "subscription"
                  ? "Refund Unavailable"
                  : order.type === "report" && !reportRefundEligible
                    ? "Refund Restricted"
                    : refunding
                      ? "Processing Refund..."
                      : "Refund / Cancel Order"}
            </button>
          </div>
        </div>
        <p className="mt-4 text-sm text-white/55">{refundPolicyNote}</p>
        {order.metadata.stripe_invoice_status ? (
          <p className="mt-4 text-sm text-sky-100/85">
            Invoice: {formatInvoiceStatusLabel(order.metadata.stripe_invoice_status)}
          </p>
        ) : null}
        {order.metadata.stripe_invoice_url ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.open(order.metadata.stripe_invoice_url!, "_blank", "noopener,noreferrer")}
              className="rounded-xl border border-sky-300/25 bg-sky-500/10 px-4 py-2 text-sm text-sky-100 transition hover:border-sky-300/40 hover:bg-sky-500/15"
            >
              View Invoice
            </button>
          </div>
        ) : null}
        {order.metadata.invoice_link ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.open(order.metadata.invoice_link!, "_blank", "noopener,noreferrer")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75 transition hover:border-white/20 hover:bg-white/10"
            >
              View Invoice Link
            </button>
            <button
              type="button"
              onClick={() => void handleRegenerateLink()}
              disabled={regeneratingLink || order.metadata.invoice_status === "paid"}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {regeneratingLink ? "Regenerating..." : "Regenerate Link"}
            </button>
          </div>
        ) : null}
        {order.execution.state === "completed" ? (
          <button
            type="button"
            onClick={() => void handleGenerate(true)}
            disabled={isGenerating}
            className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Regenerate Output
          </button>
        ) : null}
        {actionError ? <p className="mt-4 text-sm text-rose-300">{actionError}</p> : null}
        {actionSuccess ? <p className="mt-4 text-sm text-emerald-300">{actionSuccess}</p> : null}
        {actionSuccess === "Invoice created and emailed to customer." && createdInvoiceUrl ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.open(createdInvoiceUrl, "_blank", "noopener,noreferrer")}
              className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 transition hover:border-emerald-300/40 hover:bg-emerald-500/15"
            >
              View Invoice
            </button>
            <button
              type="button"
              onClick={() => void handleCopyInvoiceLink(createdInvoiceUrl)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75 transition hover:border-white/20 hover:bg-white/10"
            >
              Copy Link
            </button>
          </div>
        ) : null}
      </Card>

      {subscription ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-white/40">Subscription Lifecycle</p>
                <h3 className="mt-2 text-lg font-semibold text-white">{formatSubscriptionLifecycle(subscription.lifecycle_status)}</h3>
                {subscription.lifecycle_status === "cancel_pending" && subscription.current_period_end ? (
                  <p className="mt-2 text-sm text-amber-100/85">
                    Subscription scheduled to cancel on {formatOrderDate(subscription.current_period_end)}.
                  </p>
                ) : null}
                {subscription.lifecycle_status === "paused" ? (
                  <p className="mt-2 text-sm text-white/55">Billing collection is paused and access is suspended until resumed.</p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                <p>Kind: {subscription.kind}</p>
                <p>Access: {renderValue(subscription.access_state)}</p>
                <p>Priority: {subscription.priority_support === null ? "—" : subscription.priority_support ? "Enabled" : "Disabled"}</p>
              </div>
            </div>

            {subscriptionDangerActions.length > 0 ? (
              <div className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-500/[0.06] p-4">
                <p className="text-sm font-semibold text-rose-100">Danger Zone</p>
                <p className="mt-2 text-sm text-rose-100/65">
                  These actions can revoke access immediately or force a high-impact support override.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {subscriptionDangerActions.map((action) => {
                    const requirement = subscription.action_requirements[action];
                    return (
                      <button
                        key={action}
                        type="button"
                        onClick={() => openSubscriptionAction(action)}
                        disabled={!subscription.local_id || requirement?.disabled || subscriptionActionProcessing}
                        title={requirement?.disabled_reason ?? undefined}
                        className={subscriptionActionButtonClass(subscription, action)}
                      >
                        {SUBSCRIPTION_ACTION_LABELS[action]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-white">Admin Notes</h3>
            <textarea
              value={subscriptionNote}
              onChange={(event) => setSubscriptionNote(event.target.value)}
              placeholder="Client requested cancellation via email."
              className="mt-4 min-h-28 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/40 focus:bg-white/[0.07]"
            />
            <button
              type="button"
              onClick={() => void handleSaveSubscriptionNote()}
              disabled={savingSubscriptionNote || !subscription.local_id}
              className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingSubscriptionNote ? "Saving…" : "Save Internal Note"}
            </button>
            <div className="mt-5 space-y-3">
              {subscription.admin_notes.length > 0 ? subscription.admin_notes.map((note) => (
                <div key={note.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs text-white/40">{formatOrderDate(note.created_at)}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-white/75">{note.note}</p>
                </div>
              )) : (
                <p className="text-sm text-white/45">No internal subscription notes yet.</p>
              )}
            </div>
          </Card>

          <Card className="xl:col-span-2">
            <h3 className="text-lg font-semibold text-white">Subscription Activity</h3>
            <div className="mt-5 space-y-3">
              {subscription.activity.length > 0 ? subscription.activity.map((entry) => (
                <div key={entry.id} className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm md:grid-cols-[12rem_1fr]">
                  <p className="text-white/45">{formatOrderDate(entry.timestamp)}</p>
                  <div>
                    <p className="text-white/80">
                      {formatSubscriptionActivityAction(entry.action)}
                      {entry.actor_label ? ` by ${entry.actor_label}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      {entry.previous_status ?? "—"} → {entry.new_status ?? "—"}
                      {entry.reason ? ` · Reason: ${entry.reason}` : ""}
                    </p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-white/45">No subscription activity has been audit logged yet.</p>
              )}
            </div>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h3 className="text-lg font-semibold text-white">Client Information</h3>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-xs text-white/40">Full Name</dt>
              <dd className="text-white/85">{renderValue(order.client_name)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Email</dt>
              <dd className="text-white/85">{renderValue(order.email)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">User ID</dt>
              <dd className="break-all text-white/85">{order.user_id}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Membership Tier</dt>
              <dd className="text-white/85">{renderValue(order.membership_tier)}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-white">Order Details</h3>
          <dl className="mt-4 space-y-3">
            {order.type === "report" ? (
              <>
                <div>
                  <dt className="text-xs text-white/40">Report Type</dt>
                  <dd className="text-white/85">{renderValue(order.metadata.report_type)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/40">Systems Included</dt>
                  <dd className="text-white/85">{renderList(order.metadata.selected_systems)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/40">Delivery Status</dt>
                  <dd className="text-white/85">{renderValue(order.metadata.delivery_status)}</dd>
                </div>
              </>
            ) : null}

            {order.type === "session" ? (
              <>
                <div>
                  <dt className="text-xs text-white/40">Session Type</dt>
                  <dd className="text-white/85">{renderValue(order.metadata.session_type)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/40">Scheduled Date / Time</dt>
                  <dd className="text-white/85">{order.metadata.scheduled_at ? formatOrderDate(order.metadata.scheduled_at) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/40">Meeting Link</dt>
                  <dd className="break-all text-white/85">{renderValue(order.metadata.meeting_link)}</dd>
                </div>
              </>
            ) : null}

            {order.type === "subscription" ? (
              <>
                <div>
                  <dt className="text-xs text-white/40">Plan Name</dt>
                  <dd className="text-white/85">{renderValue(order.metadata.plan_name)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/40">Billing Cycle</dt>
                  <dd className="text-white/85">{renderValue(order.metadata.billing_cycle)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/40">Renewal Date</dt>
                  <dd className="text-white/85">{order.metadata.renewal_date ? formatOrderDate(order.metadata.renewal_date) : "—"}</dd>
                </div>
              </>
            ) : null}

            <div>
              <dt className="text-xs text-white/40">Submitted Timezone</dt>
              <dd className="text-white/85">{renderValue(order.metadata.intake.timezone)}</dd>
            </div>

            {order.type === "webinar" ? (
              <>
                <div>
                  <dt className="text-xs text-white/40">Event Name</dt>
                  <dd className="text-white/85">{renderValue(order.metadata.event_name)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/40">Event Date</dt>
                  <dd className="text-white/85">{order.metadata.event_date ? formatOrderDate(order.metadata.event_date) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/40">Access Link</dt>
                  <dd className="break-all text-white/85">{renderValue(order.metadata.access_link)}</dd>
                </div>
              </>
            ) : null}

            {order.type === "custom" ? (
              <>
                <div>
                  <dt className="text-xs text-white/40">Invoice Label</dt>
                  <dd className="text-white/85">{renderValue(order.metadata.invoice_label)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/40">Billing Mode</dt>
                  <dd className="text-white/85">{renderValue(order.metadata.billing_mode)}</dd>
                </div>
              </>
            ) : null}
          </dl>
        </Card>
      </div>

      {isRegenerationOrder ? (
        <Card>
          <h3 className="text-lg font-semibold text-white">Enhancement Summary</h3>
          <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] p-4">
            <p className="text-sm font-semibold text-cyan-100">
              {manifestationEnhancement?.name ?? "Optional Additional Manifestation Request for First Month"}
            </p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-white/40">Status</dt>
                <dd className="mt-1 text-white/85">
                  {manifestationEnhancement?.selected ? "Active" : "Not selected"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">Duration</dt>
                <dd className="mt-1 text-white/85">
                  {manifestationEnhancement?.selected
                    ? `${manifestationEnhancement.duration_days} Days`
                    : "30 Days"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">Price</dt>
                <dd className="mt-1 text-white/85">
                  {manifestationEnhancement?.selected
                    ? `+$${(manifestationEnhancement.price_cents / 100).toFixed(0)} ${manifestationEnhancement.currency}`
                    : "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Intentions</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/78">
                {renderValue(manifestationEnhancement?.intentions ?? order.metadata.intake.manifestation_goals)}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {order.type === "session" ? (
        <Card>
          <h3 className="text-lg font-semibold text-white">Recording Delivery</h3>
          <p className="mt-2 text-sm text-white/55">
            Attach a watch link for this member. Once saved, it will appear in the member dashboard and recordings page.
          </p>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.2em] text-white/40">Recording Link</span>
              <input
                type="url"
                value={recordingLinkInput}
                onChange={(event) => setRecordingLinkInput(event.target.value)}
                placeholder="https://..."
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/40 focus:bg-white/[0.07]"
              />
            </label>

            {order.recording_link ? (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">Current Recording</p>
                <a
                  href={order.recording_link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block break-all text-sm text-emerald-100 underline underline-offset-4"
                >
                  {order.recording_link}
                </a>
                <p className="mt-2 text-xs text-emerald-100/75">
                  Added {order.recording_added_at ? formatOrderDate(order.recording_added_at) : "recently"}.
                </p>
              </div>
            ) : (
              <p className="text-sm text-white/50">No recording has been attached to this order yet.</p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSaveRecording()}
                disabled={savingRecording}
                className="rounded-xl border border-cyan-300/30 bg-gradient-to-r from-cyan-400/20 via-sky-400/20 to-violet-400/20 px-5 py-3 text-sm font-medium text-cyan-100 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingRecording ? "Saving..." : order.recording_link ? "Replace Recording" : "Save Recording"}
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-white">Intake Form Data</h3>
            {order.type === "session" || order.type === "report" ? (
              <button
                type="button"
                onClick={editingIntake ? handleCancelEditingIntake : handleStartEditingIntake}
                disabled={savingIntake}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/75 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editingIntake ? "Cancel" : "Edit"}
              </button>
            ) : null}
          </div>

          {editingIntake && intakeForm ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-white/40">Phone</span>
                  <input
                    type="text"
                    value={intakeForm.phone}
                    onChange={(event) => updateIntakeForm({ phone: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-white/40">Birth Date</span>
                  <input
                    type="date"
                    value={intakeForm.birthDate}
                    onChange={(event) => updateIntakeForm({ birthDate: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-white/40">Birth Time</span>
                  <input
                    type="time"
                    value={intakeForm.birthTime}
                    onChange={(event) => updateIntakeForm({ birthTime: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-white/40">Timezone</span>
                  <input
                    type="text"
                    value={intakeForm.timezone}
                    onChange={(event) => updateIntakeForm({ timezone: event.target.value })}
                    placeholder="America/Vancouver"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/40"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-white/40">Location</span>
                <input
                  type="text"
                  value={intakeForm.location}
                  onChange={(event) => updateIntakeForm({ location: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                />
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={intakeForm.consentGiven}
                  onChange={(event) => updateIntakeForm({ consentGiven: event.target.checked })}
                  className="h-4 w-4 accent-cyan-300"
                />
                Consent given
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-white/40">Focus Topics</span>
                  <textarea
                    value={intakeForm.topics}
                    onChange={(event) => updateIntakeForm({ topics: event.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-white/40">Mentoring Goals</span>
                  <textarea
                    value={intakeForm.goals}
                    onChange={(event) => updateIntakeForm({ goals: event.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-white/40">Health Focus Areas</span>
                <textarea
                  value={intakeForm.healthFocusAreas}
                  onChange={(event) => updateIntakeForm({ healthFocusAreas: event.target.value })}
                  rows={3}
                  placeholder="Left hand and shoulder | 7"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/40"
                />
                <span className="mt-1 block text-xs text-white/35">One per line: name | severity 1-10</span>
              </label>

              <label className="block">
                <span className="text-xs text-white/40">Other Detail</span>
                <textarea
                  value={intakeForm.other}
                  onChange={(event) => updateIntakeForm({ other: event.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                />
              </label>

              <label className="block">
                <span className="text-xs text-white/40">Submitted Questions</span>
                <textarea
                  value={intakeForm.submittedQuestions}
                  onChange={(event) => updateIntakeForm({ submittedQuestions: event.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                />
              </label>

              <label className="block">
                <span className="text-xs text-white/40">Notes</span>
                <textarea
                  value={intakeForm.notes}
                  onChange={(event) => updateIntakeForm({ notes: event.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleSaveIntake()}
                  disabled={savingIntake}
                  className="rounded-xl border border-cyan-300/30 bg-gradient-to-r from-cyan-400/20 via-sky-400/20 to-violet-400/20 px-5 py-3 text-sm font-medium text-cyan-100 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingIntake ? "Saving..." : "Save Intake"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEditingIntake}
                  disabled={savingIntake}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-xs text-white/40">Phone</dt>
                <dd className="text-white/85">{renderValue(order.metadata.intake.phone)}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">Availability</dt>
                <dd className="text-white/85">{renderAvailability(order.metadata.availability)}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">Birth Date</dt>
                <dd className="text-white/85">{renderValue(order.metadata.intake.birth_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">Birth Time</dt>
                <dd className="text-white/85">{renderValue(order.metadata.intake.birth_time)}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">Location</dt>
                <dd className="text-white/85">{renderValue(order.metadata.intake.location)}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">Consent Given</dt>
                <dd className="text-white/85">{renderBoolean(order.metadata.intake.consent_given)}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">Focus Topics</dt>
                <dd className="text-white/85">{renderList(order.metadata.intake.topics)}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">Mentoring Goals</dt>
                <dd className="text-white/85">{renderList(order.metadata.intake.goals)}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">Health Focus Areas</dt>
                <dd className="text-white/85">{renderHealthFocusAreas(order.metadata.intake.health_focus_areas)}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">Other Detail</dt>
                <dd className="whitespace-pre-wrap text-white/85">{renderValue(order.metadata.intake.other)}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">Submitted Questions</dt>
                <dd className="text-white/85">{renderList(order.metadata.intake.submitted_questions)}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">Notes</dt>
                <dd className="whitespace-pre-wrap text-white/85">{renderValue(order.metadata.intake.notes)}</dd>
              </div>
            </dl>
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-white">Execution</h3>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-xs text-white/40">State</dt>
              <dd className="mt-1">
                <ExecutionBadge state={order.execution.state} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Linked Report</dt>
              <dd className="break-all text-white/85">{renderValue(order.execution.report_id)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Last Attempt</dt>
              <dd className="text-white/85">
                {order.execution.last_attempt_timestamp ? formatOrderDate(order.execution.last_attempt_timestamp) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Started</dt>
              <dd className="text-white/85">
                {order.execution.generation_started_at ? formatOrderDate(order.execution.generation_started_at) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Completed</dt>
              <dd className="text-white/85">
                {order.execution.generation_completed_at ? formatOrderDate(order.execution.generation_completed_at) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Duration</dt>
              <dd className="text-white/85">{formatDuration(order.execution.duration_ms)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Last Error</dt>
              <dd className="whitespace-pre-wrap text-white/85">{renderValue(order.execution.last_generation_error)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h3 className="text-lg font-semibold text-white">Payment Information</h3>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-xs text-white/40">Product Name</dt>
              <dd className="text-white/85">{renderValue(order.product_name)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Stripe Payment Intent ID</dt>
              <dd className="break-all text-white/85">{renderValue(order.stripe_payment_id)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Amount</dt>
              <dd className="text-white/85">{formatOrderMoney(order.amount, order.currency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Currency</dt>
              <dd className="text-white/85">{renderValue(order.currency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Payment Status</dt>
              <dd className="text-white/85">{renderValue(order.payment_status ?? order.status)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Payment Source</dt>
              <dd className="text-white/85">{renderValue(order.metadata.payment_source)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Sync Status</dt>
              <dd className="text-white/85">{renderValue(order.metadata.payment_sync_status)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Refunded At</dt>
              <dd className="text-white/85">{order.refunded_at ? formatOrderDate(order.refunded_at) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Refund Reason</dt>
              <dd className="text-white/85">{renderValue(order.refund_reason)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Refund Note</dt>
              <dd className="whitespace-pre-wrap text-white/85">{renderValue(order.refund_note)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Payment Match</dt>
              <dd className="text-white/85">{getPaymentMatchLabel(order.metadata.payment_match_strategy)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Stripe Checkout Session ID</dt>
              <dd className="break-all text-white/85">{renderValue(order.metadata.stripe_checkout_session_id)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Invoice ID</dt>
              <dd className="break-all text-white/85">{renderValue(order.metadata.invoice_id)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Billing Mode</dt>
              <dd className="text-white/85">{renderValue(order.metadata.billing_mode)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Invoice Status</dt>
              <dd className="text-white/85">{renderValue(order.metadata.invoice_status)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Attempted</dt>
              <dd className="text-white/85">
                {order.metadata.last_payment_attempt_at ? formatOrderDate(order.metadata.last_payment_attempt_at) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Failure Code</dt>
              <dd className="text-white/85">{renderValue(order.metadata.failure_code)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Failure Message</dt>
              <dd className="whitespace-pre-wrap text-white/85">{renderValue(order.metadata.failure_message_normalized ?? order.metadata.failure_message)}</dd>
            </div>
          </dl>
        </Card>

        {order.execution.output ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Generated Output</h3>
                <p className="mt-1 text-sm text-white/50">
                  Version {order.execution.output.version} • {formatOrderDate(order.execution.output.generated_at)}
                </p>
              </div>
              <p className="text-sm text-white/50">{renderList(order.execution.output.systems_used)}</p>
            </div>
            <div className="mt-6 space-y-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Summary</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/80">
                  {renderValue(order.execution.output.summary)}
                </p>
              </div>
              {order.execution.output.sections.map((section) => (
                <div key={section.key} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-white">{section.title}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/70">{section.content}</p>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card>
            <h3 className="text-lg font-semibold text-white">Generated Output</h3>
            <p className="mt-4 text-sm text-white/55">
              No stored Divin8 output is available yet for this order.
            </p>
          </Card>
        )}
      </div>

      {subscriptionAction && subscription ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-3xl border p-6 shadow-2xl ${
            selectedSubscriptionRequirement?.severity === "danger"
              ? "border-rose-300/25 bg-rose-950/95"
              : "border-white/10 bg-slate-950"
          }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {SUBSCRIPTION_ACTION_LABELS[subscriptionAction]}
                </h3>
                <p className="mt-2 text-sm text-white/60">
                  {subscriptionActionDescription(subscriptionAction)}
                </p>
                {selectedSubscriptionRequirement?.severity === "danger" ? (
                  <p className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100/80">
                    Danger Zone: this can immediately remove subscription access, priority support, or entitlement state.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => !subscriptionActionProcessing && setSubscriptionAction(null)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {selectedSubscriptionRequirement?.reason_required ? (
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.2em] text-white/40">Admin Action Reason Required</span>
                  <textarea
                    value={subscriptionActionReason}
                    onChange={(event) => setSubscriptionActionReason(event.target.value)}
                    placeholder="Document why this subscription lifecycle change is being made."
                    className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/40 focus:bg-white/[0.07]"
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.2em] text-white/40">Optional Reason</span>
                  <input
                    type="text"
                    value={subscriptionActionReason}
                    onChange={(event) => setSubscriptionActionReason(event.target.value)}
                    placeholder="Optional support note"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/40 focus:bg-white/[0.07]"
                  />
                </label>
              )}

              {SUBSCRIPTION_DAY_ACTIONS.has(subscriptionAction) ? (
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.2em] text-white/40">Days</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={subscriptionActionDays}
                    onChange={(event) => setSubscriptionActionDays(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.07]"
                  />
                </label>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setSubscriptionAction(null)}
                disabled={subscriptionActionProcessing}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubscriptionAction()}
                disabled={subscriptionActionProcessing}
                className={selectedSubscriptionRequirement?.severity === "danger"
                  ? "rounded-xl border border-rose-300/30 bg-rose-500/20 px-5 py-3 text-sm font-medium text-rose-100 transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  : "rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-5 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"}
              >
                {subscriptionActionProcessing ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {refundModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">Refund / Cancel Order</h3>
                <p className="mt-2 text-sm text-white/55">
                  {refundPolicyNote}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !refunding && setRefundModalOpen(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-white/40">Refund Reason</span>
                <select
                  value={refundReason}
                  onChange={(event) => setRefundReason(event.target.value as (typeof REFUND_REASON_OPTIONS)[number]["value"])}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.07]"
                >
                  {REFUND_REASON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="bg-slate-950 text-white">
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {refundReason === "other" ? (
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.2em] text-white/40">Custom Reason</span>
                  <input
                    type="text"
                    value={refundCustomReason}
                    onChange={(event) => setRefundCustomReason(event.target.value)}
                    placeholder="Explain the refund reason"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/40 focus:bg-white/[0.07]"
                  />
                </label>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setRefundModalOpen(false)}
                disabled={refunding}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRefundOrder()}
                disabled={refunding}
                className="rounded-xl border border-rose-300/30 bg-rose-500/15 px-5 py-3 text-sm font-medium text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refunding ? "Processing..." : "Process Refund"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
