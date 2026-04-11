import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import Card from "../components/Card";
import { formatPacificTime } from "@wisdom/utils";
import { api } from "../lib/api";

interface PaymentSummary {
  id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  provider: string;
  provider_payment_intent_id: string | null;
  provider_customer_id: string | null;
  metadata: Record<string, unknown> | null;
  booking_id: string | null;
  created_at: string;
  updated_at: string | null;
  user?: {
    id: string;
    email: string;
    role: string;
  };
  booking?: {
    id: string;
    start_time_utc: string;
    status: string;
    booking_type?: {
      id: string;
      name: string;
    };
  };
}

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function formatDateTime(value: string) {
  return formatPacificTime(value);
}

export default function Payments() {
  const { getToken } = useAuth();
  const [payments, setPayments] = useState<PaymentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedPayment = useMemo(
    () => payments.find((payment) => payment.id === selectedPaymentId) ?? null,
    [payments, selectedPaymentId],
  );

  const metrics = useMemo(() => {
    const totalAmountCents = payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
    const pendingCount = payments.filter((payment) =>
      payment.status === "pending" || payment.status === "requires_payment",
    ).length;
    const failedCount = payments.filter((payment) => payment.status === "failed").length;
    const paidCount = payments.filter((payment) => payment.status === "paid").length;

    return {
      totalAmountCents,
      pendingCount,
      failedCount,
      paidCount,
    };
  }, [payments]);

  async function loadPayments() {
    setLoading(true);
    try {
      const token = await getToken();
      const response = (await api.get("/admin/payments", token)) as { data: PaymentSummary[] };
      setPayments(response.data);
      setSelectedPaymentId((current) => current ?? response.data[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleMarkPaid(paymentId: string) {
    setActingId(paymentId);
    setError(null);
    setSuccess(null);

    try {
      const token = await getToken();
      await api.post(`/payments/${paymentId}/confirm`, { manual: true }, token);
      setSuccess("Payment marked as paid.");
      await loadPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark payment paid.");
    } finally {
      setActingId(null);
    }
  }

  async function handleRefund(paymentId: string) {
    setActingId(paymentId);
    setError(null);
    setSuccess(null);

    try {
      const token = await getToken();
      await api.post(`/payments/${paymentId}/refund`, {}, token);
      setSuccess("Refund recorded.");
      await loadPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refund failed.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-white">Payments</h2>
        <p className="mt-1 text-white/50">
          Monitor payment status, review booking-linked charges, and apply admin fallback actions.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm font-medium text-white/50">Total Volume</p>
          <p className="mt-2 text-3xl font-bold text-accent-cyan">{formatMoney(metrics.totalAmountCents, "CAD")}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-white/50">Pending</p>
          <p className="mt-2 text-3xl font-bold text-accent-violet">{metrics.pendingCount}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-white/50">Paid</p>
          <p className="mt-2 text-3xl font-bold text-accent-teal">{metrics.paidCount}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-white/50">Failed</p>
          <p className="mt-2 text-3xl font-bold text-rose-300">{metrics.failedCount}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr,0.95fr]">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Payments Table</h3>
              <p className="mt-1 text-sm text-white/50">Booking-linked financial records, newest first.</p>
            </div>
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-white/50">Loading payments...</p>
          ) : payments.length ? (
            <div className="mt-5 space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className={`rounded-xl border p-4 transition ${
                    selectedPaymentId === payment.id
                      ? "border-accent-cyan bg-accent-cyan/10"
                      : "border-glass-border bg-white/5"
                  }`}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <button
                      type="button"
                      onClick={() => setSelectedPaymentId(payment.id)}
                      className="text-left"
                    >
                      <p className="font-medium text-white">
                        {payment.user?.email || payment.user_id}
                      </p>
                      <p className="mt-1 text-sm text-white/60">
                        {formatMoney(payment.amount_cents, payment.currency)} · {payment.status} · {formatDateTime(payment.created_at)}
                      </p>
                      <p className="mt-1 text-xs text-white/40">
                        {payment.booking?.booking_type?.name || "Standalone payment"} {payment.booking_id ? `· Booking ${payment.booking_id.slice(0, 8)}` : ""}
                      </p>
                    </button>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentId(payment.id)}
                        className="rounded-lg border border-glass-border px-3 py-2 text-sm text-white/80 transition hover:border-white/40 hover:text-white"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        disabled={actingId === payment.id || payment.status === "paid" || payment.status === "refunded"}
                        onClick={() => handleMarkPaid(payment.id)}
                        className="rounded-lg bg-accent-cyan px-3 py-2 text-sm font-semibold text-navy-deep transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {actingId === payment.id ? "Saving..." : "Mark Paid"}
                      </button>
                      <button
                        type="button"
                        disabled={actingId === payment.id || payment.status !== "paid"}
                        onClick={() => handleRefund(payment.id)}
                        className="rounded-lg border border-glass-border px-3 py-2 text-sm text-white/80 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Refund
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-white/50">No payments yet.</p>
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-white">Payment Detail</h3>
          {selectedPayment ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-glass-border bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-white/40">Amount</p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {formatMoney(selectedPayment.amount_cents, selectedPayment.currency)}
                </p>
                <p className="mt-1 text-sm text-white/60">
                  {selectedPayment.status} · {selectedPayment.provider}
                </p>
              </div>

              <div className="rounded-xl border border-glass-border bg-white/5 p-4 text-sm text-white/70">
                <p><span className="text-white/40">User:</span> {selectedPayment.user?.email || selectedPayment.user_id}</p>
                <p className="mt-2"><span className="text-white/40">Created:</span> {formatDateTime(selectedPayment.created_at)}</p>
                <p className="mt-2"><span className="text-white/40">Booking:</span> {selectedPayment.booking_id || "None"}</p>
                <p className="mt-2"><span className="text-white/40">Intent:</span> {selectedPayment.provider_payment_intent_id || "Not created"}</p>
                <p className="mt-2"><span className="text-white/40">Customer:</span> {selectedPayment.provider_customer_id || "Not linked"}</p>
              </div>

              <div className="rounded-xl border border-glass-border bg-navy-deep p-4">
                <p className="text-xs uppercase tracking-wide text-white/40">Metadata</p>
                <pre className="mt-3 overflow-x-auto text-xs text-white/70">
                  {JSON.stringify(selectedPayment.metadata ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-glass-border px-4 py-8 text-sm text-white/50">
              Select a payment to inspect details.
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
