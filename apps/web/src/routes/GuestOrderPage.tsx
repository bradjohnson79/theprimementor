import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { usePageMeta } from "../hooks/usePageMeta";

interface GuestOrderItem {
  kind: string;
  [key: string]: unknown;
}

interface GuestOrderData {
  email: string;
  isGuest: boolean;
  items: GuestOrderItem[];
  createAccountUrl: string;
}

function describeItem(item: GuestOrderItem): { title: string; detail: string } {
  const status = (item.status as string | undefined) ?? "pending";
  switch (item.kind) {
    case "session":
      return {
        title: (item.bookingTypeName as string) || "Session booking",
        detail: `Status: ${status}${item.startTimeUtc ? ` · ${new Date(item.startTimeUtc as string).toLocaleString()}` : ""}`,
      };
    case "report":
      return {
        title: (item.title as string) || "Report",
        detail: `Status: ${status === "fulfilled" ? "ready to view" : "being prepared"}`,
      };
    case "shop":
      return {
        title: (item.productName as string) || "Shop product",
        detail: item.downloadUrl ? "Ready to download" : "Processing",
      };
    case "webinar":
      return {
        title: "Webinar / event registration",
        detail: `Status: ${status}${item.startTimeUtc ? ` · ${new Date(item.startTimeUtc as string).toLocaleString()}` : ""}`,
      };
    case "manifestation_monthly":
      return {
        title: "Manifestation Monthly Package",
        detail: `Status: ${status}${item.manifestationEnhancementSelected === true ? " · Includes Additional Manifestation Request for First Month (+$29 CAD)" : ""}`,
      };
    default:
      return { title: "Order item", detail: `Status: ${status}` };
  }
}

/**
 * Guest magic-link order page: GET /api/order/:token. No account needed — the signed, expiring
 * token in the URL is the only credential. Shows what was bought, offers a "resend my links"
 * form and a "create your free account" CTA prefilled with the guest's email.
 */
export default function GuestOrderPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<GuestOrderData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resendSent, setResendSent] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [intakeBusy, setIntakeBusy] = useState<string | null>(null);
  const navigate = useNavigate();

  usePageMeta({
    title: "Your order | The Prime Mentor",
    description: "View your order, access your deliverables, or create a free account.",
    canonical: "",
  });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.get(`/order/${encodeURIComponent(token)}`)
      .then((res) => {
        if (cancelled) return;
        setData(res as GuestOrderData);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "This order link is invalid or has expired.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleResend(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api.post("/guest/resend-links", { email: resendEmail });
    } catch {
      // Same response either way — never reveal whether an email has anything on file.
    }
    setResendSent(true);
  }

  async function handleBillingPortal() {
    if (!token || portalBusy) return;
    setPortalBusy(true);
    try {
      const res = await api.post(`/order/${encodeURIComponent(token)}/billing-portal`);
      const url = (res as { url?: string } | undefined)?.url;
      if (url) window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the billing portal.");
    } finally {
      setPortalBusy(false);
    }
  }

  async function openIntake(kind: "session" | "report", id: string) {
    if (!token || intakeBusy) return;
    setIntakeBusy(id);
    try {
      const res = (await api.post(`/order/${encodeURIComponent(token)}/intake-link`, { kind, id })) as { path?: string; data?: { path?: string } };
      const path = res?.path ?? res?.data?.path;
      if (path) navigate(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open your intake form.");
    } finally {
      setIntakeBusy(null);
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center text-white">
        <h1 className="text-2xl font-semibold">This link is invalid or has expired</h1>
        <p className="mt-3 text-white/65">{error}</p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
          <h2 className="text-sm font-semibold text-white">Resend my links</h2>
          {resendSent ? (
            <p className="mt-3 text-sm text-cyan-100">If we found an order for that email, a fresh link is on its way.</p>
          ) : (
            <form onSubmit={handleResend} className="mt-3 flex gap-2">
              <input
                type="email"
                required
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-300/50 focus:outline-none"
              />
              <button type="submit" className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">
                Resend
              </button>
            </form>
          )}
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/70">Your order</p>
      <h1 className="mt-3 text-3xl font-semibold">Hi, here's what you bought</h1>
      <p className="mt-2 text-white/65">Sent to {data.email}</p>

      <div className="mt-8 space-y-4">
        {data.items.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/5 p-5 text-white/65">
            Nothing here yet — your order may still be processing. Try refreshing in a minute.
          </p>
        ) : (
          data.items.map((item, index) => {
            const { title, detail } = describeItem(item);
            return (
              <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-5">
                <h2 className="font-semibold text-white">{title}</h2>
                <p className="mt-1 text-sm text-white/60">{detail}</p>
                {item.intakePending === true && (item.kind === "session" || item.kind === "report" || item.kind === "manifestation_monthly") ? (
                  <button
                    type="button"
                    disabled={intakeBusy !== null}
                    onClick={() => void openIntake(item.kind === "report" ? "report" : "session", String(item.kind === "report" ? item.reportId : item.kind === "manifestation_monthly" ? item.intakeBookingId : item.bookingId))}
                    className="mt-3 inline-flex rounded-lg bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                  >
                    {intakeBusy ? "Opening…" : item.kind === "report" ? "Complete your Divin8 Reports Intake Form" : "Complete your Services Intake Form"}
                  </button>
                ) : null}
                {typeof item.downloadUrl === "string" ? (
                  <a href={item.downloadUrl} className="mt-3 inline-flex rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950">
                    Download
                  </a>
                ) : null}
                {typeof item.joinUrl === "string" ? (
                  <a href={item.joinUrl} className="mt-3 inline-flex rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">
                    Join / Zoom link
                  </a>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {data.items.some((item) => item.kind === "manifestation_monthly") ? (
        <button
          type="button"
          onClick={() => void handleBillingPortal()}
          disabled={portalBusy}
          className="mt-6 inline-flex rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
        >
          {portalBusy ? "Opening…" : "Manage or cancel subscription"}
        </button>
      ) : null}

      <div className="mt-10 rounded-2xl border border-cyan-300/25 bg-cyan-300/5 p-6">
        <h2 className="text-lg font-semibold text-white">Want a dashboard for all your orders?</h2>
        <p className="mt-2 text-sm text-white/65">Create a free account with this same email and everything above will show up automatically.</p>
        <Link to={data.createAccountUrl} className="mt-4 inline-flex rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-5 py-3 text-sm font-semibold text-slate-950">
          Create your free account
        </Link>
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-sm font-semibold text-white">Lost this link? Resend it</h2>
        {resendSent ? (
          <p className="mt-3 text-sm text-cyan-100">If we found an order for that email, a fresh link is on its way.</p>
        ) : (
          <form onSubmit={handleResend} className="mt-3 flex gap-2">
            <input
              type="email"
              required
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-300/50 focus:outline-none"
            />
            <button type="submit" className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white">
              Resend
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
