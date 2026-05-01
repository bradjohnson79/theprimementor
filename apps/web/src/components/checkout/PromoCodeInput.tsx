interface PromoCodeInputProps {
  code: string;
  onCodeChange: (value: string) => void;
  onApply: () => void;
  onRemove: () => void;
  applying: boolean;
  disabled?: boolean;
  error?: string | null;
  appliedCode?: string | null;
  estimatedDiscount?: number | null;
  finalEstimate?: number | null;
  currency?: string | null;
  title?: string;
  subtitle?: string;
}

export default function PromoCodeInput({
  code,
  onCodeChange,
  onApply,
  onRemove,
  applying,
  disabled = false,
  error = null,
  appliedCode = null,
  estimatedDiscount = null,
  finalEstimate = null,
  currency = null,
  title = "Promo Code",
  subtitle = "Apply one promo code before checkout. Stripe will remain the final pricing authority.",
}: PromoCodeInputProps) {
  const fieldClassName = "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-white/40 focus:border-accent-cyan/50 focus:outline-none focus:ring-1 focus:ring-accent-cyan/30";

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200/80">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm text-white/60">{subtitle}</p>
        </div>
        {appliedCode ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white/80 transition hover:border-white/30 hover:text-white"
          >
            Remove
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          placeholder="Enter promo code"
          className={fieldClassName}
          disabled={disabled || Boolean(appliedCode)}
        />
        <button
          type="button"
          onClick={onApply}
          disabled={disabled || applying || Boolean(appliedCode) || !code.trim()}
          className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {applying ? "Applying..." : appliedCode ? "Applied" : "Apply"}
        </button>
      </div>

      {appliedCode ? (
        <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          <p className="font-medium">{appliedCode} applied.</p>
          {(estimatedDiscount != null || finalEstimate != null) ? (
            <p className="mt-1 text-emerald-100/85">
              {estimatedDiscount != null ? `Estimated savings: ${estimatedDiscount.toFixed(2)} ${currency ?? ""}` : ""}
              {estimatedDiscount != null && finalEstimate != null ? " · " : ""}
              {finalEstimate != null ? `Estimated total: ${finalEstimate.toFixed(2)} ${currency ?? ""}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
    </section>
  );
}
