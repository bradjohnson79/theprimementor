import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/react";
import { useSearchParams } from "react-router-dom";
import { formatPacificTime } from "@wisdom/utils";
import { api } from "../lib/api";
import { startMentoringCircleCheckout } from "../lib/mentoringCircleCheckout";
import { MENTORING_CIRCLE_SESSION_FALLBACK_ISO } from "../lib/mentoringCircleConstants";

interface MentoringCircleEventState {
  eventId: string;
  eventKey: string;
  eventTitle: string;
  sessionDate: string;
  salesOpenAt: string;
  salesOpen: boolean;
  timezone: string;
  posterPath: string;
  priceCents: number;
  currency: string;
  bookingId: string | null;
  paymentId: string | null;
  paymentStatus: string | null;
  purchaseStatus: "not_started" | "pending_payment" | "confirmed";
  accessStatus: "locked" | "pending_payment" | "confirmed";
  joinEligible: boolean;
  registered: boolean;
  joinUrl: string | null;
}

interface MentoringCircleState {
  currentEvent: MentoringCircleEventState | null;
  nextEvent: MentoringCircleEventState | null;
  activeEventForPurchase: MentoringCircleEventState | null;
  requestedEvent: MentoringCircleEventState | null;
}

const MENTORING_CIRCLE_POSTER_SRC = "/images/mentoring-circle-april-26.webp";

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function MentoringCircle() {
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [circleState, setCircleState] = useState<MentoringCircleState | null>(null);
  const [loadingCircle, setLoadingCircle] = useState(true);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [pollingForAccess, setPollingForAccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const requestedEventId = searchParams.get("eventId");

  const purchasableEvent = circleState?.activeEventForPurchase ?? circleState?.currentEvent ?? circleState?.nextEvent ?? null;
  const accessibleEvent = circleState?.requestedEvent?.joinEligible
    ? circleState.requestedEvent
    : circleState?.currentEvent?.joinEligible
    ? circleState.currentEvent
    : circleState?.nextEvent?.joinEligible
      ? circleState.nextEvent
      : circleState?.activeEventForPurchase?.joinEligible
        ? circleState.activeEventForPurchase
        : null;

  useEffect(() => {
    let cancelled = false;

    async function loadCircleState(showLoading: boolean) {
      if (showLoading) {
        setLoadingCircle(true);
      }
      try {
        const token = await getToken();
        const path = requestedEventId
          ? `/mentoring-circle/me?eventId=${encodeURIComponent(requestedEventId)}`
          : "/mentoring-circle/me";
        const response = (await api.get(path, token)) as { data: MentoringCircleState };
        if (!cancelled) {
          setCircleState(response.data);
        }
        return response.data;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load event details.");
        }
        return null;
      } finally {
        if (!cancelled && showLoading) {
          setLoadingCircle(false);
        }
      }
    }

    void loadCircleState(true);

    const checkoutState = searchParams.get("checkout");
    if (checkoutState !== "success") {
      if (checkoutState === "canceled") {
        setSuccess(null);
        setError("Checkout was canceled before payment completed.");
      }
      return () => {
        cancelled = true;
      };
    }

    setError(null);
    setSuccess("Payment received. Confirming your access...");
    setPollingForAccess(true);

    void (async () => {
      for (let attempt = 0; attempt < 6 && !cancelled; attempt += 1) {
        const state = await loadCircleState(attempt === 0 ? false : false);
        if (
          state?.requestedEvent?.joinEligible
          || state?.currentEvent?.joinEligible
          || state?.nextEvent?.joinEligible
          || state?.activeEventForPurchase?.joinEligible
        ) {
          setSuccess("Registration confirmed. Your Zoom link is ready.");
          setPollingForAccess(false);
          const next = new URLSearchParams(searchParams);
          next.delete("checkout");
          setSearchParams(next, { replace: true });
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }

      if (!cancelled) {
        setPollingForAccess(false);
        setSuccess("Payment completed. Access is still syncing and should appear shortly.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken, requestedEventId, searchParams, setSearchParams]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const eventDateLabel = useMemo(() => {
    const iso = purchasableEvent?.sessionDate ?? MENTORING_CIRCLE_SESSION_FALLBACK_ISO;
    return formatPacificTime(iso);
  }, [purchasableEvent]);

  async function handleCheckout() {
    setError(null);
    setSuccess(null);
    setStartingCheckout(true);
    try {
      const token = await getToken();
      const eventId = purchasableEvent?.eventId ?? requestedEventId;
      if (!eventId) {
        throw new Error("Mentoring Circle event could not be resolved.");
      }
      await startMentoringCircleCheckout(eventId, { token });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reserve your spot.");
    } finally {
      setStartingCheckout(false);
    }
  }

  async function copyLink() {
    if (!accessibleEvent?.joinUrl) return;
    await navigator.clipboard.writeText(accessibleEvent.joinUrl);
    setCopied(true);
  }

  const ctaLabel = `Reserve Spot (${purchasableEvent ? formatPrice(purchasableEvent.priceCents) : "$25"})`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="px-6 py-10"
    >
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[28px] bg-gradient-to-br from-accent-cyan/25 via-violet-400/15 to-amber-300/25 p-[1px] shadow-[0_0_60px_rgba(99,102,241,0.12)]">
          <section className="glass-card rounded-[27px] p-6 sm:p-8">
            <div className="overflow-hidden rounded-2xl bg-black/20 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
              {posterFailed ? (
                <div className="aspect-[16/9] bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.24),transparent_35%),linear-gradient(135deg,#0b1020_0%,#141b35_50%,#1f1842_100%)] p-6">
                  <div className="flex h-full flex-col justify-end rounded-xl border border-white/10 bg-black/10 p-6 backdrop-blur-sm">
                    <span className="inline-flex w-fit rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-amber-100">
                      Live Event
                    </span>
                    <h1 className="mt-4 text-3xl font-semibold text-white">Mentoring Circle: The Prime Law</h1>
                    <p className="mt-2 text-sm text-white/70">{eventDateLabel}</p>
                  </div>
                </div>
              ) : (
                <img
                  src={MENTORING_CIRCLE_POSTER_SRC}
                  alt="Mentoring Circle Poster"
                  className="relative z-10 block aspect-[16/9] w-full object-cover"
                  onLoad={() => setPosterFailed(false)}
                  onError={() => setPosterFailed(true)}
                />
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-amber-100">
                  {purchasableEvent ? new Date(purchasableEvent.sessionDate).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  }) : "Live Event"}
                </div>
                <h2 className="mt-4 text-3xl font-semibold text-white">
                  {purchasableEvent?.eventTitle ?? "Mentoring Circle: The Prime Law"}
                </h2>
                <p className="mt-2 text-sm text-white/60">{eventDateLabel}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right text-sm text-white/65">
                <p className="text-xs uppercase tracking-wide text-white/40">Access</p>
                <p className="mt-2 font-medium text-white">
                  {accessibleEvent?.joinEligible
                    ? "Purchase confirmed"
                    : purchasableEvent?.purchaseStatus === "pending_payment"
                      ? "Payment pending"
                      : `${formatPrice(purchasableEvent?.priceCents ?? 2500)} reservation`}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-base font-medium text-white">Beta Mind vs Prime Mind</h3>
                <p className="mt-3 text-sm text-white/70">
                  The difference between living in the Beta Mind vs the Prime Mind and what true manifestation is.
                </p>
              </section>
              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-base font-medium text-white">Blueprint Exploration</h3>
                <ul className="mt-3 space-y-2 text-sm text-white/70">
                  <li>Energetic and behavioral patterns revealed live with attendees</li>
                  <li>Where alignment or distortion is shaping results right now</li>
                </ul>
              </section>
              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-base font-medium text-white">Live Demonstration</h3>
                <ul className="mt-3 space-y-2 text-sm text-white/70">
                  <li>Real-time application of manifestation principles</li>
                  <li>How inner alignment changes outcomes without force</li>
                </ul>
              </section>
            </div>

            <p className="mt-6 text-sm text-white/70">
              This is our first Prime Mentor webinar. Reserve your place now to unlock your Zoom access after payment
              is confirmed, then return here anytime to copy or join the event.
            </p>

            {error ? (
              <div className="mt-6 rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            {success ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-950/35 px-4 py-3 text-sm text-emerald-100"
              >
                {success}
              </motion.div>
            ) : null}

            <div className="mt-6">
              {loadingCircle ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/55">
                  {pollingForAccess ? "Confirming your access..." : "Loading event details..."}
                </div>
              ) : accessibleEvent?.joinEligible ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-emerald-400/25 bg-emerald-950/25 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">You're Registered</h3>
                      <p className="mt-1 text-sm text-white/65">{formatPacificTime(accessibleEvent.sessionDate)}</p>
                    </div>
                    <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-100">
                      Registered
                    </span>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-white/40">Zoom Join Link</p>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <a
                        href={accessibleEvent.joinUrl ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-sm text-accent-cyan hover:underline"
                      >
                        {accessibleEvent.joinUrl}
                      </a>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void copyLink()}
                          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/80 transition hover:bg-white/5"
                        >
                          <CopyIcon />
                          Copy Link
                        </button>
                        <a
                          href={accessibleEvent.joinUrl ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-lg bg-accent-cyan px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-accent-cyan/90"
                        >
                          Quick Join
                        </a>
                      </div>
                    </div>
                  </div>

                  {copied ? (
                    <div className="mt-3 inline-flex rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-1 text-xs font-medium text-accent-cyan">
                      Link Copied!
                    </div>
                  ) : null}
                </motion.div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-lg font-semibold text-white">
                    {purchasableEvent?.purchaseStatus === "pending_payment" ? "Payment Processing" : "Reserve Your Spot"}
                  </h3>
                  <p className="mt-2 text-sm text-white/65">
                    {purchasableEvent?.purchaseStatus === "pending_payment"
                      ? "Your Stripe payment is being confirmed. This page will refresh your access automatically."
                      : "Reserve your place for the currently active Mentoring Circle event and you will be redirected to Stripe checkout."}
                  </p>
                  <button
                    type="button"
                    disabled={startingCheckout || pollingForAccess}
                    onClick={() => void handleCheckout()}
                    className="cosmic-motion mt-5 inline-flex items-center rounded-xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(255,215,0,0.18)] transition hover:scale-[1.01] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pollingForAccess
                      ? "Confirming Access..."
                      : startingCheckout
                        ? "Opening Checkout..."
                        : ctaLabel}
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
