import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import {
  STAR_FAMILY_WEBINAR_DASHBOARD_PATH,
  STAR_FAMILY_WEBINAR_EVENT_ID,
  STAR_FAMILY_WEBINAR_TITLE,
  getStarFamilyWebinarPublicCatalog,
} from "@wisdom/utils";
import { trackEvent, trackEventOnce } from "../lib/analytics";
import { syncOwnedCheckoutSession } from "../lib/checkoutSessionSync";
import { fetchWebinarMe } from "../lib/webinarApi";

const POLL_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 1500;

export default function StarFamilyWebinarThankYou() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const catalog = getStarFamilyWebinarPublicCatalog();
  const checkoutSessionId = searchParams.get("checkoutSessionId");
  const [status, setStatus] = useState<"loading" | "processing" | "ready" | "denied">("loading");
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

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
          // Webhook fulfillment remains authoritative.
        }
      }
      try {
        const state = await fetchWebinarMe(STAR_FAMILY_WEBINAR_EVENT_ID, token);
        if (cancelled) return;
        if (state.joinEligible && state.zoomRegistrationUrl) {
          setZoomUrl(state.zoomRegistrationUrl);
          setReference(state.bookingId ?? null);
          setStatus("ready");
          trackEventOnce("analytics:star-family:purchase-completed", "webinar_purchase_completed", {
            webinar_id: STAR_FAMILY_WEBINAR_EVENT_ID,
            webinar_type: "live_webinar",
            placement: "landing_page",
            price_cents: catalog.priceCents,
            currency: catalog.currency,
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
  }, [catalog.currency, catalog.priceCents, checkoutSessionId, getToken, isSignedIn]);

  if (!isSignedIn) {
    const redirectUrl = `${location.pathname}${location.search}${location.hash}`;
    if (isLoaded) {
      return <Navigate to={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`} replace />;
    }
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="space-y-5 rounded-[2rem] border border-white/10 bg-[#07111f]/80 p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/60">Live Webinar</p>
        <h1 className="text-3xl font-semibold text-white">You’re Registered for {STAR_FAMILY_WEBINAR_TITLE}</h1>
        <div className="space-y-1 text-white/75">
          <p>{catalog.displayDate}</p>
          <p>{catalog.displayTime}</p>
          <p>Live on Zoom</p>
          <p>{catalog.displayPrice}</p>
          {reference ? <p>Purchase reference: {reference}</p> : null}
        </div>
        {status === "loading" || status === "processing" ? (
          <p className="text-white/70">Confirming your payment and registration. This page updates when the purchase is verified.</p>
        ) : null}
        {status === "denied" ? (
          <p className="text-white/70">This account does not have a verified registration for this webinar.</p>
        ) : null}
        {status === "ready" && zoomUrl ? (
          <a
            href={zoomUrl}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950"
            onClick={() => trackEvent("webinar_zoom_registration_clicked", {
              webinar_id: STAR_FAMILY_WEBINAR_EVENT_ID,
              webinar_type: "live_webinar",
            })}
          >
            Register on Zoom
          </a>
        ) : null}
        <p className="text-sm leading-6 text-white/65">Your registration includes the complete recording. It will appear in Dashboard → Webinars when it is ready.</p>
        <Link to={STAR_FAMILY_WEBINAR_DASHBOARD_PATH} className="inline-flex text-sm font-semibold text-cyan-100 underline">
          Go to My Webinars
        </Link>
      </div>
    </div>
  );
}
