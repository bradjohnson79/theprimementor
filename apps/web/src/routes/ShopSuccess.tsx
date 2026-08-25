import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { api } from "../lib/api";
import { syncOwnedCheckoutSession } from "../lib/checkoutSessionSync";
import type { ShopOrderSuccess } from "../lib/shop";
import { shopMediaSrc } from "../lib/shop";

const POLL_MS = 1500;
const MAX_POLLS = 10;

function unwrapSuccess(payload: unknown): ShopOrderSuccess {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: ShopOrderSuccess }).data;
  }
  return payload as ShopOrderSuccess;
}

export default function ShopSuccess() {
  const [searchParams] = useSearchParams();
  const { getToken, isSignedIn } = useAuth();
  const sessionId = searchParams.get("session_id") || searchParams.get("checkoutSessionId");
  const [view, setView] = useState<ShopOrderSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    let polls = 0;
    let timer: number | undefined;

    async function load(token: string) {
      const data = unwrapSuccess(await api.get(
        `/shop/order/success?session_id=${encodeURIComponent(sessionId || "")}`,
        token,
      ));
      if (cancelled) return data;
      setView(data);
      return data;
    }

    async function start() {
      try {
        const token = await getToken();
        if (!token) return;
        if (sessionId) {
          await syncOwnedCheckoutSession({
            checkoutSessionId: sessionId,
            entityType: "shop",
            token,
          }).catch(() => undefined);
        }
        const first = await load(token);
        if (cancelled || !first || first.state !== "processing") return;

        const poll = async () => {
          polls += 1;
          const next = await load(token);
          if (cancelled || !next) return;
          if (next.state === "processing" && polls < MAX_POLLS) {
            timer = window.setTimeout(() => {
              void poll();
            }, POLL_MS);
            return;
          }
          if (next.state === "processing") {
            setView({
              ...next,
              message: "Your payment was successful. We're still preparing your download. If it does not appear shortly, contact support and we will finish delivery.",
            });
          }
        };
        timer = window.setTimeout(() => {
          void poll();
        }, POLL_MS);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Purchase confirmation is still processing.");
      }
    }

    void start();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [getToken, isSignedIn, sessionId]);

  const ready = view?.state === "ready" || view?.state === "email_failed";
  const heading = view?.state === "processing"
    ? "Your payment was successful"
    : view?.state === "unpaid" || view?.state === "canceled"
      ? "This payment is not complete"
      : "Thank You for Your Order";

  return (
    <main className="min-h-screen px-6 pb-20 pt-[0.6rem] text-white md:pt-[0.8rem]">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">The Prime Mentor Shop</p>
        <h1 className="mt-4 text-4xl font-semibold">{heading}</h1>
        {view?.productName ? (
          <p className="mt-4 text-xl text-white/88">Your purchase of {view.productName} is complete.</p>
        ) : null}
        {view?.formatLabel ? <p className="mt-2 text-sm uppercase tracking-[0.16em] text-amber-200">{view.formatLabel}</p> : null}
        {error ? <p role="alert" className="mt-6 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{error}</p> : null}
        {!isSignedIn ? (
          <Link to={`/sign-in?redirect_url=${encodeURIComponent(`/shop/order/success${sessionId ? `?session_id=${sessionId}` : ""}`)}`} className="mt-8 inline-flex rounded-xl bg-accent-cyan px-5 py-3 text-sm font-semibold text-slate-950">
            Sign in to open your download
          </Link>
        ) : null}

        {view ? (
          <section className="glass-card mt-8 rounded-3xl p-6 md:p-8">
            {view.productImage ? (
              <img
                src={shopMediaSrc(view.productImage.url)}
                alt={view.productImage.altText || view.productName || "Purchased product"}
                className="mb-6 max-h-72 w-full rounded-2xl object-contain"
              />
            ) : null}
            {view.productName ? <h2 className="text-2xl font-semibold">{view.productName}</h2> : null}
            {view.orderReference ? <p className="mt-2 text-sm text-white/55">Order {view.orderReference}</p> : null}
            <p className="mt-4 text-white/72">{view.message}</p>
            {ready && view.downloadUrl ? (
              <a
                href={view.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex rounded-xl bg-accent-cyan px-5 py-3 text-sm font-semibold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {view.downloadLabel || "Download Your Product"}
              </a>
            ) : null}
            {ready && view.productName ? <p className="mt-3 text-sm text-white/65">{view.productName}</p> : null}
            {view.instructions ? <p className="mt-4 text-sm text-white/65">{view.instructions}</p> : null}
            {ready && view.state !== "email_failed" ? (
              <div className="mt-8">
                <h2 className="text-xl font-semibold">We've also emailed your download</h2>
                <p className="mt-3 text-white/72">
                  A copy of your download information has been sent to the email address used during checkout
                  {view.maskedEmail ? ` (${view.maskedEmail})` : ""}. If you don't see it within a few minutes, please check your junk or spam folder.
                </p>
                <p className="mt-3 text-white/72">Keep the email for future access to your product.</p>
              </div>
            ) : null}
            {ready && view.state === "email_failed" ? (
              <div className="mt-8">
                <h2 className="text-xl font-semibold">Save this download link</h2>
                <p className="mt-3 text-amber-100">
                  Your download is ready. We weren't able to confirm delivery of the email, so please save this download link.
                </p>
                <p className="mt-3 text-white/72">Contact support if you need the message resent.</p>
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/shop" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950">Return to Shop</Link>
          <Link to="/dashboard/purchases" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white">Go to Purchases</Link>
        </div>
      </div>
    </main>
  );
}
