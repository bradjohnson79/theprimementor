import { useState, type FormEvent } from "react";
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
}

/**
 * Shared "Continue as guest" checkout modal: collects email + name only (no account), posts to
 * the given guest-checkout endpoint, and redirects straight to Stripe Checkout on success. Used
 * for product flows that don't need extra intake (shop, Manifestation Monthly, webinar tickets).
 * Session bookings and reports need richer intake and are not wired to this component yet — see
 * GUEST-CHECKOUT-PLAN.md.
 */
export default function GuestCheckoutModal({
  open,
  onClose,
  endpoint,
  extraBody,
  title,
  itemLabel,
}: GuestCheckoutModalProps) {
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
    setBusy(true);
    setError(null);
    try {
      const response = (await api.post(endpoint, {
        email,
        fullName: fullName.trim() || undefined,
        website: website.trim() || undefined,
        ...extraBody,
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.1),_transparent_48%),linear-gradient(180deg,rgba(9,13,24,0.98),rgba(4,6,15,0.97))] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.55)]"
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
    </div>
  );
}
