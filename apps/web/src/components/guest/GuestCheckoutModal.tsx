import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { api } from "../../lib/api";

export interface GuestCheckoutResponse {
  success?: boolean;
  alreadyPaid?: boolean;
  requiresPayment?: boolean;
  url?: string | null;
  orderPageUrl?: string | null;
  [key: string]: unknown;
}

interface GuestCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  /** API path under /api, e.g. "/guest/shop/checkout" */
  endpoint: string;
  /** Extra fields merged into the POST body alongside email/fullName (e.g. productId, eventId) */
  extraBody?: Record<string, unknown>;
  title: string;
  /** Short line describing what they're buying, shown above the form */
  itemLabel?: string;
  /** Optional picker (e.g. session length, live vs pre-recorded); the chosen option's body is merged in. */
  choices?: Array<{ label: string; extraBody: Record<string, unknown> }>;
  choiceLabel?: string;
  /**
   * Manifestation Monthly only: ask the same optional $29 first-month add-on question the signed-in
   * intake asks. Guests pay first, so the choice is made here and priced into Stripe Checkout.
   */
  manifestationAddOn?: boolean;
}

const MANIFESTATION_ADD_ON_OPTIONS = [
  {
    selected: true,
    title: "Yes - Add Additional Manifestation Request (+$29 CAD)",
    description: "Add one additional manifestation request during the first monthly cycle.",
  },
  {
    selected: false,
    title: "No - Continue with Regeneration Only",
    description: "Continue with the standard Manifestation Monthly Package.",
  },
] as const;

/**
 * Shared "Continue as guest" checkout modal: collects email + name only (no account), posts to
 * the given guest-checkout endpoint, and redirects straight to Stripe Checkout on success. Used
 * for product flows that don't need extra intake before payment (shop, webinar tickets) and for the
 * pay-first session / Divin8 report / Manifestation Monthly flows, where the intake form is filled
 * in after payment from the thank-you page or the purchase email (deferIntake).
 */
export default function GuestCheckoutModal({
  open,
  onClose,
  endpoint,
  extraBody,
  title,
  itemLabel,
  choices,
  choiceLabel,
  manifestationAddOn = false,
}: GuestCheckoutModalProps) {
  const [choiceIndex, setChoiceIndex] = useState(0);
  const [addOnSelected, setAddOnSelected] = useState<boolean | null>(null);
  const [addOnError, setAddOnError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — real users never see/fill this
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (manifestationAddOn && addOnSelected === null) {
      setAddOnError("Choose whether you would like to include the optional first-month add-on.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = (await api.post(endpoint, {
        email,
        fullName: fullName.trim() || undefined,
        website: website.trim() || undefined,
        ...extraBody,
        ...(choices?.[choiceIndex]?.extraBody ?? {}),
        ...(manifestationAddOn ? { manifestationEnhancement: addOnSelected === true } : {}),
      })) as GuestCheckoutResponse;
      const data = (response?.data as GuestCheckoutResponse | undefined) ?? response;
      if (data.url && data.requiresPayment !== false) {
        window.location.assign(data.url);
        return;
      }
      if (data.alreadyPaid) {
        setSent("You already own this — check your email for the download link.");
        return;
      }
      setSent("Check your email — we've sent your confirmation and access link.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message.length <= 180 ? message : "Could not start checkout. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Portal to <body> so the dialog sits above the sticky site header (which is outside <main>).
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.1),_transparent_48%),linear-gradient(180deg,rgba(9,13,24,0.98),rgba(4,6,15,0.97))] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-white/50 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {itemLabel ? <p className="mt-1 text-sm text-white/60">{itemLabel}</p> : null}

        {sent ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">{sent}</p>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex w-full items-center justify-center rounded-xl bg-white/10 px-5 py-3 text-sm font-medium text-white hover:bg-white/15"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <p className="text-xs text-white/55">No account needed. We'll email your confirmation and access links.</p>
            {choices && choices.length > 1 ? (
              <div>
                <label htmlFor="guest-checkout-choice" className="block text-xs font-medium uppercase tracking-wide text-white/50">
                  {choiceLabel ?? "Option"}
                </label>
                <select
                  id="guest-checkout-choice"
                  value={choiceIndex}
                  onChange={(event) => setChoiceIndex(Number(event.target.value))}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white px-4 py-3 text-sm text-slate-900 focus:border-cyan-300/50 focus:outline-none"
                >
                  {choices.map((choice, index) => (
                    <option key={choice.label} value={index}>{choice.label}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {manifestationAddOn ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid="guest-manifestation-add-on">
                <h3 className="text-sm font-semibold text-white">Would you like to add one additional manifestation request for your first month?</h3>
                <p className="mt-2 text-xs leading-6 text-white/62">
                  For +$29 CAD, Brad can safeguard and amplify one extra desired outcome within the same monthly cycle.
                </p>
                <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Optional First-Month Add-On">
                  {MANIFESTATION_ADD_ON_OPTIONS.map((option) => {
                    const active = addOnSelected === option.selected;
                    return (
                      <button
                        key={option.title}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => {
                          setAddOnSelected(option.selected);
                          setAddOnError(null);
                        }}
                        className={`rounded-xl border px-4 py-3 text-left transition ${
                          active
                            ? "border-cyan-300/60 bg-cyan-400/12 text-white shadow-[0_0_22px_rgba(34,211,238,0.12)]"
                            : "border-white/10 bg-white/[0.03] text-white/72 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        <span className="block text-sm font-semibold">{option.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-white/58">{option.description}</span>
                      </button>
                    );
                  })}
                </div>
                {addOnError ? <p className="mt-2 text-sm text-amber-200">{addOnError}</p> : null}
                {addOnSelected === true ? (
                  <p className="mt-3 text-xs leading-5 text-white/58">You'll describe your additional manifestation request on your intake form after payment.</p>
                ) : null}
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                  <span className="text-white/60">Today's Total</span>
                  <span className="font-semibold text-white" data-testid="guest-manifestation-total">
                    {addOnSelected === true ? "$128 CAD" : "$99 CAD"}
                  </span>
                </div>
              </div>
            ) : null}
            <div>
              <label htmlFor="guest-checkout-email" className="block text-xs font-medium uppercase tracking-wide text-white/50">
                Email
              </label>
              <input
                id="guest-checkout-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-cyan-300/50 focus:outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="guest-checkout-name" className="block text-xs font-medium uppercase tracking-wide text-white/50">
                Name (optional)
              </label>
              <input
                id="guest-checkout-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-cyan-300/50 focus:outline-none"
                placeholder="Your name"
              />
            </div>
            {/* Honeypot: hidden from real users via CSS, left empty by them, but visible to bots */}
            <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden">
              <label htmlFor="guest-checkout-website">Website</label>
              <input
                id="guest-checkout-website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </div>
            {error ? <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {busy ? "Starting checkout…" : "Continue to payment"}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
