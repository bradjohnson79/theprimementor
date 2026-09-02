import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import {
  ADRONIS_WEBINAR_EVENT_ID,
  ADRONIS_WEBINAR_TITLE,
  getAdronisWebinarPublicCatalog,
} from "@wisdom/utils";
import { trackCtaClick } from "../lib/analytics";
import { syncOwnedCheckoutSession } from "../lib/checkoutSessionSync";
import { fetchWebinarMe } from "../lib/webinarApi";

const POLL_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 1500;

export default function AdronisWebinarThankYou() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const catalog = getAdronisWebinarPublicCatalog();
  const checkoutSessionId = searchParams.get("checkoutSessionId");
  const [status, setStatus] = useState<"loading" | "processing" | "ready" | "denied">("loading");
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;

    async function loadAccess(attempt = 0): Promise<void> {
      const token = await getToken();
      if (checkoutSessionId && attempt === 0) {
        try {
          await syncOwnedCheckoutSession({
            checkoutSessionId,
            entityType: "webinar",
            token,
          });
        } catch {
          // Webhook fulfillment remains authoritative; keep polling entitlement.
        }
      }

      try {
        const state = await fetchWebinarMe(ADRONIS_WEBINAR_EVENT_ID, token);
        if (cancelled) return;
        if (state.joinEligible && state.zoomRegistrationUrl) {
          setZoomUrl(state.zoomRegistrationUrl);
          setStatus("ready");
          trackCtaClick("adronis_webinar_checkout_completed", "adronis_webinar_thank_you", {
            eventId: ADRONIS_WEBINAR_EVENT_ID,
          });
          return;
        }
        if (state.purchaseStatus === "pending_payment" || checkoutSessionId) {
          if (attempt < POLL_ATTEMPTS) {
            setStatus("processing");
            await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
            return loadAccess(attempt + 1);
          }
          setStatus("processing");
          return;
        }
        setStatus("denied");
      } catch {
        if (cancelled) return;
        if (attempt < POLL_ATTEMPTS && checkoutSessionId) {
          setStatus("processing");
          await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
          return loadAccess(attempt + 1);
        }
        setStatus(checkoutSessionId ? "processing" : "denied");
      }
    }

    void loadAccess();
    return () => {
      cancelled = true;
    };
  }, [checkoutSessionId, getToken, isSignedIn]);

  if (!isSignedIn) {
    const redirectUrl = `${location.pathname}${location.search}${location.hash}`;
    if (isLoaded) {
      return <Navigate to={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`} replace />;
    }
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="space-y-4 rounded-[2rem] border border-white/10 bg-[#07111f]/80 p-6 sm:p-8">
          <h1 className="text-3xl font-semibold text-white">Sign in to view webinar access</h1>
          <p className="text-white/70">
            This page does not disclose webinar registration details until your Prime Mentor account and purchase are verified.
          </p>
          <Link
            to={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-5 rounded-[2rem] border border-white/10 bg-[#07111f]/80 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.28em] text-white/45">Webinar Access</p>
          <h1 className="text-3xl font-semibold text-white">Thank You for Registering</h1>
          <div className="space-y-1 text-white/74">
            <p className="text-lg font-semibold text-white">{ADRONIS_WEBINAR_TITLE}</p>
            <p>{catalog.displayDate}</p>
            <p>{catalog.displayTime}</p>
          </div>

          {status === "loading" ? (
            <p className="text-white/70">Confirming your registration access…</p>
          ) : null}

          {status === "processing" ? (
            <p className="text-white/70">
              Your payment was received and your registration access is being prepared.
            </p>
          ) : null}

          {status === "denied" ? (
            <div className="space-y-3">
              <p className="text-white/70">
                This page is available after a verified purchase of {ADRONIS_WEBINAR_TITLE}.
              </p>
              <Link
                to="/"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white"
              >
                Return to The Prime Mentor
              </Link>
            </div>
          ) : null}

          {status === "ready" && zoomUrl ? (
            <div className="space-y-4">
              <p className="text-white/74">
                Your purchase is confirmed. Complete Zoom attendee registration next so Zoom can send you its own meeting-access details.
              </p>
              <a
                href={zoomUrl}
                target="_blank"
                rel="noreferrer noopener"
                onClick={() => trackCtaClick("adronis_webinar_zoom_registration", "adronis_webinar_thank_you", {
                  eventId: ADRONIS_WEBINAR_EVENT_ID,
                })}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950"
              >
                Register on Zoom
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <p className="text-sm text-white/60">
                We’ve sent the Zoom registration link to the email address associated with your Prime Mentor account.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
