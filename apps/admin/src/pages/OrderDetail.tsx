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
  AdminOrder,
  AdminOrderAvailability,
  AdminOrderAvailabilityDay,
  AdminOrderDetailResponse,
  AdminOrderGenerateResponse,
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
};

const AVAILABILITY_DAYS: AdminOrderAvailabilityDay[] = ["monday", "tuesday", "wednesday", "thursday"];

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
    () => Boolean(order?.available_actions.includes("generate_output")),
    [order],
  );

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
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                <p className="mt-1 text-white/85">{renderList(order.available_actions)}</p>
              </div>
            </div>
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
            <button
              type="button"
              onClick={() => canRefund && setRefundModalOpen(true)}
              disabled={!canRefund || refunding}
              className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-5 py-3 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
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
      </Card>

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
                <div>
                  <dt className="text-xs text-white/40">Submitted Timezone</dt>
                  <dd className="text-white/85">{renderValue(order.metadata.intake.timezone)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/40">Client Availability</dt>
                  <dd className="text-white/85">
                    {hasAvailability(order.metadata.availability) ? (
                      <div className="space-y-1.5">
                        {AVAILABILITY_DAYS.map((day) => {
                          const times = order.metadata.availability?.[day] ?? [];
                          if (times.length === 0) return null;

                          return (
                            <p key={day}>
                              {AVAILABILITY_DAY_LABELS[day]}:{" "}
                              <span className="text-white/70">{times.map(formatAvailabilityTime).join(", ")}</span>
                            </p>
                          );
                        })}
                      </div>
                    ) : "—"}
                  </dd>
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
          <h3 className="text-lg font-semibold text-white">Intake Form Data</h3>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-xs text-white/40">Phone</dt>
              <dd className="text-white/85">{renderValue(order.metadata.intake.phone)}</dd>
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
