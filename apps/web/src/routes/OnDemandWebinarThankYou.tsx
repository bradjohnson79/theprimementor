import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import {
  ADRONIS_ON_DEMAND_WEBINAR_ID,
  getOnDemandWebinarById,
  getOnDemandWebinarPublicCatalog,
} from "@wisdom/utils";
import { trackCtaClick } from "../lib/analytics";
import { syncOwnedCheckoutSession } from "../lib/checkoutSessionSync";
import { fetchOnDemandWebinarMe } from "../lib/onDemandWebinarApi";

const POLL_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 1500;

export default function OnDemandWebinarThankYou() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [searchParams] = useSearchParams();
  const webinar = getOnDemandWebinarById(ADRONIS_ON_DEMAND_WEBINAR_ID);
  const catalog = webinar
    ? getOnDemandWebinarPublicCatalog(webinar, { assetReady: false, playbackProtected: false })
    : null;
  const checkoutSessionId = searchParams.get("checkoutSessionId");
  const [status, setStatus] = useState<"loading" | "processing" | "ready" | "denied">("loading");

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;

    async function loadAccess(attempt = 0): Promise<void> {
      const token = await getToken();
      if (checkoutSessionId && attempt === 0) {
        try {
          await syncOwnedCheckoutSession({
            checkoutSessionId,
            entityType: "on_demand_webinar",
            entityId: checkoutSessionId,
            token,
          });
        } catch {
          // Webhook fulfillment remains authoritative; keep polling entitlement.
        }
      }

      try {
        const state = await fetchOnDemandWebinarMe(ADRONIS_ON_DEMAND_WEBINAR_ID, token);
        if (cancelled) return;
        if (state.owned) {
          setStatus("ready");
          trackCtaClick("on_demand_webinar_checkout_completed", "on_demand_webinar_thank_you", {
            webinarId: ADRONIS_ON_DEMAND_WEBINAR_ID,
          });
          return;
        }
        if (checkoutSessionId && attempt < POLL_ATTEMPTS) {
          setStatus("processing");
          await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
          return loadAccess(attempt + 1);
        }
        setStatus(checkoutSessionId ? "processing" : "denied");
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

  if (!isLoaded) {
    return <div className="mx-auto max-w-3xl px-6 py-16 text-white/70">Loading...</div>;
  }
  if (!isSignedIn) {
    return <Navigate to={`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname + window.location.search)}`} replace />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-16 text-white">
      <p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">On-Demand Webinar</p>
      <h1 className="text-3xl font-semibold">{catalog?.title ?? "Your webinar"}</h1>
      {status === "ready" ? (
        <>
          <p className="text-white/70">Your purchase is confirmed. Watch the recording anytime in Dashboard → Webinars.</p>
          <Link
            to="/dashboard/webinars"
            className="inline-flex rounded-full bg-amber-300 px-5 py-2.5 text-sm font-semibold text-slate-950"
          >
            Go to My Webinars
          </Link>
        </>
      ) : status === "denied" ? (
        <p className="text-amber-200">This page is only available after a completed purchase.</p>
      ) : (
        <p className="text-white/70">Confirming your purchase...</p>
      )}
    </div>
  );
}
