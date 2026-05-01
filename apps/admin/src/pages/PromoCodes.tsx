import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import {
  PROMO_TARGET_LABELS,
  PROMO_TARGET_VALUES,
  type PromoBillingScope,
  type PromoTarget,
} from "@wisdom/utils";
import Card from "../components/Card";
import { api } from "../lib/api";

type PromoSyncStatus = "synced" | "needs_sync" | "broken";
type PromoLifecycleStatus = "active" | "inactive" | "expired" | "archived";

interface PromoCodeSummary {
  id: string;
  code: string;
  discountType: "percentage";
  discountValue: number;
  active: boolean;
  expiresAt: string | null;
  usageLimit: number | null;
  timesUsed: number;
  appliesTo: PromoTarget[] | null;
  appliesToBilling: PromoBillingScope | null;
  minAmountCents: number | null;
  firstTimeOnly: boolean;
  campaign: string | null;
  stripeCouponId: string;
  stripePromotionCodeId: string;
  syncStatus: PromoSyncStatus;
  lastValidatedAt: string | null;
  lastValidationOk: boolean | null;
  lastValidationSnapshot: {
    issues: string[];
  } | null;
  validationFailureCode: string | null;
  validationFailureMessage: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  lifecycleStatus: PromoLifecycleStatus;
  performance: {
    usageCount: number;
    revenueImpactedCents: number;
    averageOrderValueCents: number | null;
  };
  syncRecommendation: "db_to_stripe" | "stripe_to_db" | null;
}

interface PromoFormState {
  code: string;
  discountValue: string;
  active: boolean;
  permanent: boolean;
  expiresAt: string;
  usageLimit: string;
  appliesTo: PromoTarget[];
  appliesToBilling: PromoBillingScope | "";
  minAmountCents: string;
  firstTimeOnly: boolean;
  campaign: string;
}

function createInitialFormState(): PromoFormState {
  return {
    code: "",
    discountValue: "",
    active: true,
    permanent: true,
    expiresAt: "",
    usageLimit: "",
    appliesTo: [],
    appliesToBilling: "",
    minAmountCents: "",
    firstTimeOnly: false,
    campaign: "",
  };
}

function formatMoney(amountCents: number, currency = "CAD") {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function formatDateTime(value: string | null) {
  if (!value) return "Permanent";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromPromoToForm(promo: PromoCodeSummary): PromoFormState {
  return {
    code: promo.code,
    discountValue: String(promo.discountValue),
    active: promo.active,
    permanent: !promo.expiresAt,
    expiresAt: toDatetimeLocal(promo.expiresAt),
    usageLimit: promo.usageLimit == null ? "" : String(promo.usageLimit),
    appliesTo: promo.appliesTo ?? [],
    appliesToBilling: promo.appliesToBilling ?? "",
    minAmountCents: promo.minAmountCents == null ? "" : String(promo.minAmountCents),
    firstTimeOnly: promo.firstTimeOnly,
    campaign: promo.campaign ?? "",
  };
}

function syncBadgeStyles(status: PromoSyncStatus) {
  switch (status) {
    case "synced":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
    case "needs_sync":
      return "border-amber-300/25 bg-amber-300/10 text-amber-100";
    default:
      return "border-rose-400/25 bg-rose-400/10 text-rose-100";
  }
}

function lifecycleStyles(status: PromoLifecycleStatus) {
  switch (status) {
    case "expired":
      return "border-white/10 bg-white/[0.03] text-white/55";
    case "archived":
      return "border-white/10 bg-black/20 text-white/40";
    case "inactive":
      return "border-slate-400/20 bg-slate-400/10 text-slate-100";
    default:
      return "border-cyan-300/20 bg-cyan-400/5 text-white";
  }
}

export default function PromoCodes() {
  const { getToken } = useAuth();
  const [promoCodes, setPromoCodes] = useState<PromoCodeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [form, setForm] = useState<PromoFormState>(createInitialFormState());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const editingPromo = useMemo(
    () => promoCodes.find((promo) => promo.id === editingPromoId) ?? null,
    [editingPromoId, promoCodes],
  );

  const metrics = useMemo(() => {
    const activeCount = promoCodes.filter((promo) => promo.lifecycleStatus === "active").length;
    const expiredCount = promoCodes.filter((promo) => promo.lifecycleStatus === "expired").length;
    const brokenCount = promoCodes.filter((promo) => promo.syncStatus === "broken").length;
    const impactedRevenue = promoCodes.reduce((sum, promo) => sum + promo.performance.revenueImpactedCents, 0);
    return { activeCount, expiredCount, brokenCount, impactedRevenue };
  }, [promoCodes]);

  async function loadPromoCodes(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const token = await getToken();
      const response = (await api.get("/admin/promo-codes", token)) as { data: PromoCodeSummary[] };
      setPromoCodes(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load promo codes.");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadPromoCodes();
  }, []);

  function resetForm() {
    setForm(createInitialFormState());
    setEditingPromoId(null);
  }

  function toggleTarget(target: PromoTarget) {
    setForm((current) => ({
      ...current,
      appliesTo: current.appliesTo.includes(target)
        ? current.appliesTo.filter((entry) => entry !== target)
        : [...current.appliesTo, target],
    }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      const payload = {
        code: form.code,
        discountValue: Number(form.discountValue),
        active: form.active,
        expiresAt: form.permanent ? null : (form.expiresAt ? new Date(form.expiresAt).toISOString() : null),
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        appliesTo: form.appliesTo.length > 0 ? form.appliesTo : null,
        appliesToBilling: form.appliesToBilling || null,
        minAmountCents: form.minAmountCents ? Number(form.minAmountCents) : null,
        firstTimeOnly: form.firstTimeOnly,
        campaign: form.campaign || null,
      };

      if (editingPromoId) {
        await api.patch(`/admin/promo-codes/${editingPromoId}`, payload, token);
        setMessage("Promo code updated. Sync status refreshed against Stripe.");
      } else {
        await api.post("/admin/promo-codes", payload, token);
        setMessage("Promo code created and synced with Stripe.");
      }

      resetForm();
      await loadPromoCodes({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save promo code.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRowAction(
    promoCodeId: string,
    action: "verify" | "enable" | "disable" | "archive" | "db_to_stripe" | "stripe_to_db",
  ) {
    setActingId(promoCodeId);
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      if (action === "verify") {
        await api.post(`/admin/promo-codes/${promoCodeId}/verify`, {}, token);
        setMessage("Stripe verification completed.");
      } else if (action === "enable" || action === "disable") {
        await api.patch(`/admin/promo-codes/${promoCodeId}`, { active: action === "enable" }, token);
        setMessage(action === "enable" ? "Promo code enabled." : "Promo code disabled.");
      } else if (action === "archive") {
        if (!window.confirm("Archive this promo code? This preserves history and disables future use.")) {
          return;
        }
        await api.patch(`/admin/promo-codes/${promoCodeId}`, { archive: true }, token);
        setMessage("Promo code archived.");
      } else {
        const directionLabel = action === "db_to_stripe" ? "update Stripe from the database" : "update the database from Stripe";
        if (!window.confirm(`Confirm Fix Sync action: ${directionLabel}?`)) {
          return;
        }
        await api.post(`/admin/promo-codes/${promoCodeId}/fix-sync`, { direction: action }, token);
        setMessage(action === "db_to_stripe"
          ? "Stripe was updated from the promo definition."
          : "Database values were updated from Stripe.");
      }

      await loadPromoCodes({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Promo action failed.");
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
        <h2 className="text-2xl font-bold text-white">Promo Codes</h2>
        <p className="mt-1 text-white/55">
          Create Stripe-backed promo codes, monitor sync health, and control discount availability across all checkout flows.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm font-medium text-white/50">Active Promos</p>
          <p className="mt-2 text-3xl font-bold text-accent-cyan">{metrics.activeCount}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-white/50">Expired</p>
          <p className="mt-2 text-3xl font-bold text-amber-100">{metrics.expiredCount}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-white/50">Broken Sync</p>
          <p className="mt-2 text-3xl font-bold text-rose-200">{metrics.brokenCount}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-white/50">Revenue Impact</p>
          <p className="mt-2 text-3xl font-bold text-accent-teal">{formatMoney(metrics.impactedRevenue)}</p>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{editingPromo ? `Edit ${editingPromo.code}` : "Create Promo Code"}</h3>
            <p className="mt-1 text-sm text-white/55">
              {editingPromo
                ? "Mutable fields update the app record first. Use Fix Sync when you want Stripe brought back into alignment."
                : "New promo codes create both the Stripe coupon and promotion code immediately."}
            </p>
          </div>
          {editingPromo ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
            >
              Cancel Edit
            </button>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-white/70">
            <span className="mb-2 block">Code</span>
            <input
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
              disabled={Boolean(editingPromo)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white disabled:opacity-60"
              placeholder="WELCOME20"
            />
          </label>
          <label className="text-sm text-white/70">
            <span className="mb-2 block">Discount Percentage</span>
            <input
              type="number"
              min={1}
              max={100}
              value={form.discountValue}
              onChange={(event) => setForm((current) => ({ ...current, discountValue: event.target.value }))}
              disabled={Boolean(editingPromo)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white disabled:opacity-60"
              placeholder="20"
            />
          </label>
          <label className="text-sm text-white/70">
            <span className="mb-2 block">Usage Limit</span>
            <input
              type="number"
              min={1}
              value={form.usageLimit}
              onChange={(event) => setForm((current) => ({ ...current, usageLimit: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white"
              placeholder="Leave blank for unlimited"
            />
          </label>
          <label className="text-sm text-white/70">
            <span className="mb-2 block">Minimum Order (cents)</span>
            <input
              type="number"
              min={1}
              value={form.minAmountCents}
              onChange={(event) => setForm((current) => ({ ...current, minAmountCents: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white"
              placeholder="Optional"
            />
          </label>
          <label className="text-sm text-white/70">
            <span className="mb-2 block">Campaign</span>
            <input
              value={form.campaign}
              onChange={(event) => setForm((current) => ({ ...current, campaign: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white"
              placeholder="qa_launch_april"
            />
          </label>
          <label className="text-sm text-white/70">
            <span className="mb-2 block">Billing Scope</span>
            <select
              value={form.appliesToBilling}
              onChange={(event) => setForm((current) => ({ ...current, appliesToBilling: event.target.value as PromoBillingScope | "" }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white"
            >
              <option value="" className="bg-slate-950">None / one-time products</option>
              <option value="one_time" className="bg-slate-950">One-time</option>
              <option value="recurring" className="bg-slate-950">Recurring</option>
            </select>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-4 text-sm text-white/70">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
            />
            <span>Active</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.permanent}
              onChange={(event) => setForm((current) => ({ ...current, permanent: event.target.checked }))}
            />
            <span>Permanent</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.firstTimeOnly}
              onChange={(event) => setForm((current) => ({ ...current, firstTimeOnly: event.target.checked }))}
            />
            <span>First-time customers only</span>
          </label>
        </div>

        {!form.permanent ? (
          <label className="mt-5 block text-sm text-white/70">
            <span className="mb-2 block">Expires At</span>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white"
            />
          </label>
        ) : null}

        <div className="mt-6">
          <p className="text-sm font-medium text-white">Applies To</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {PROMO_TARGET_VALUES.map((target) => {
              const active = form.appliesTo.includes(target);
              return (
                <label
                  key={target}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                    active
                      ? "border-accent-cyan/60 bg-accent-cyan/10 text-white"
                      : "border-white/10 bg-white/5 text-white/75 hover:border-white/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleTarget(target)}
                    className="h-4 w-4 rounded border-white/20 bg-transparent"
                  />
                  <span>{PROMO_TARGET_LABELS[target]}</span>
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-white/45">Leave all unchecked to allow the promo across every supported checkout type.</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="rounded-xl bg-accent-cyan px-4 py-3 text-sm font-semibold text-navy-deep transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving..." : editingPromo ? "Save Promo" : "Create Promo"}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="rounded-xl border border-white/15 px-4 py-3 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
          >
            Reset Form
          </button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Promo Inventory</h3>
            <p className="mt-1 text-sm text-white/55">Verify sync, inspect lifecycle state, and repair drift with explicit admin confirmation.</p>
          </div>
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-white/50">Loading promo codes...</p>
        ) : promoCodes.length ? (
          <div className="mt-5 space-y-4">
            {promoCodes.map((promo) => {
              const rowBusy = actingId === promo.id;
              return (
                <div
                  key={promo.id}
                  className={`rounded-2xl border p-4 ${lifecycleStyles(promo.lifecycleStatus)}`}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-semibold">{promo.code}</h4>
                        <span className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${syncBadgeStyles(promo.syncStatus)}`}>
                          {promo.syncStatus.replace("_", " ")}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/65">
                          {promo.lifecycleStatus}
                        </span>
                      </div>
                      <p className="text-sm text-white/75">
                        {promo.discountValue}% off · {promo.expiresAt ? formatDateTime(promo.expiresAt) : "Permanent"} · Used {promo.timesUsed}
                        {promo.usageLimit != null ? ` / ${promo.usageLimit}` : ""}
                      </p>
                      <p className="text-sm text-white/55">
                        {promo.appliesTo?.length
                          ? promo.appliesTo.map((target) => PROMO_TARGET_LABELS[target]).join(", ")
                          : "All supported checkout targets"}
                      </p>
                      <p className="text-sm text-white/55">
                        Revenue impact: {formatMoney(promo.performance.revenueImpactedCents)} · AOV: {promo.performance.averageOrderValueCents != null
                          ? formatMoney(promo.performance.averageOrderValueCents)
                          : "n/a"}
                      </p>
                      {promo.validationFailureMessage ? (
                        <p className="text-sm text-amber-100/90">{promo.validationFailureMessage}</p>
                      ) : null}
                      {promo.lastValidationSnapshot?.issues?.length ? (
                        <ul className="space-y-1 text-sm text-white/65">
                          {promo.lastValidationSnapshot.issues.map((issue) => (
                            <li key={issue}>- {issue}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPromoId(promo.id);
                          setForm(fromPromoToForm(promo));
                          setMessage(null);
                          setError(null);
                        }}
                        className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRowAction(promo.id, promo.active ? "disable" : "enable")}
                        disabled={rowBusy || promo.lifecycleStatus === "archived"}
                        className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 transition hover:border-white/30 hover:text-white disabled:opacity-50"
                      >
                        {promo.active ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRowAction(promo.id, "verify")}
                        disabled={rowBusy}
                        className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 transition hover:border-white/30 hover:text-white disabled:opacity-50"
                      >
                        {rowBusy ? "Working..." : "Verify with Stripe"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRowAction(promo.id, "db_to_stripe")}
                        disabled={rowBusy}
                        className="rounded-lg bg-accent-cyan px-3 py-2 text-sm font-semibold text-navy-deep transition hover:brightness-110 disabled:opacity-50"
                      >
                        Fix Sync: Update Stripe
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRowAction(promo.id, "stripe_to_db")}
                        disabled={rowBusy}
                        className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 transition hover:border-white/30 hover:text-white disabled:opacity-50"
                      >
                        Fix Sync: Update DB
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRowAction(promo.id, "archive")}
                        disabled={rowBusy || promo.lifecycleStatus === "archived"}
                        className="rounded-lg border border-rose-400/20 px-3 py-2 text-sm text-rose-100 transition hover:border-rose-300/35 hover:text-rose-50 disabled:opacity-50"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 text-sm text-white/50">No promo codes created yet.</p>
        )}
      </Card>
    </motion.div>
  );
}
