import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ADRONIS_WEBINAR_AUTOCHECKOUT_PATH,
  ADRONIS_WEBINAR_EVENT_ID,
  ADRONIS_WEBINAR_THANK_YOU_PATH,
  ADRONIS_WEBINAR_TITLE,
  getAdronisWebinarPublicCatalog,
} from "@wisdom/utils";
import AdronisWebinarCheckoutButton from "../components/webinars/AdronisWebinarCheckoutButton";
import { trackCtaClick } from "../lib/analytics";
import { startWebinarCheckout } from "../lib/webinarCheckout";
import { fetchWebinarMe } from "../lib/webinarApi";

export default function AdronisWebinarCheckout() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog] = useState(getAdronisWebinarPublicCatalog);
  const [error, setError] = useState<string | null>(null);
  const [owned, setOwned] = useState(false);
  const autocheckoutStartedRef = useRef(false);
  const shouldAutocheckout = searchParams.get("autocheckout") === "1";

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const state = await fetchWebinarMe(ADRONIS_WEBINAR_EVENT_ID, token);
        if (cancelled) return;
        if (state.joinEligible) {
          setOwned(true);
          navigate(ADRONIS_WEBINAR_THANK_YOU_PATH, { replace: true });
        }
      } catch {
        if (!cancelled) setOwned(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn, navigate]);

  useEffect(() => {
    if (!isSignedIn || !shouldAutocheckout || autocheckoutStartedRef.current || owned) {
      return;
    }

    autocheckoutStartedRef.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete("autocheckout");
    setSearchParams(next, { replace: true });

    void (async () => {
      try {
        const token = await getToken();
        trackCtaClick("adronis_webinar_checkout_started", "adronis_webinar_autocheckout", {
          eventId: ADRONIS_WEBINAR_EVENT_ID,
        });
        await startWebinarCheckout(ADRONIS_WEBINAR_EVENT_ID, { token });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to open Stripe checkout.";
        if (/already been purchased|already been paid/i.test(message)) {
          navigate(ADRONIS_WEBINAR_THANK_YOU_PATH, { replace: true });
          return;
        }
        setError(message);
      }
    })();
  }, [getToken, isSignedIn, navigate, owned, searchParams, setSearchParams, shouldAutocheckout]);

  if (!isSignedIn) {
    const redirectUrl = `${location.pathname}${location.search}${location.hash}` || ADRONIS_WEBINAR_AUTOCHECKOUT_PATH;
    if (isLoaded) {
      return <Navigate to={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`} replace />;
    }
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="space-y-4 rounded-[2rem] border border-white/10 bg-[#07111f]/80 p-6 sm:p-8">
          <h1 className="text-3xl font-semibold text-white">Sign in to continue registration</h1>
          <p className="text-white/70">
            A free Prime Mentor account is required to purchase this webinar.
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
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-16">
      <div className="space-y-4 rounded-[2rem] border border-white/10 bg-[#07111f]/80 p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.28em] text-white/45">Live Webinar</p>
        <h1 className="text-3xl font-semibold text-white">{ADRONIS_WEBINAR_TITLE}</h1>
        <p className="text-white/70">{catalog.displayDate}</p>
        <p className="text-white/70">{catalog.displayTime}</p>
        <p className="text-lg font-semibold text-white">{catalog.displayPrice}</p>
        {error ? <p className="text-sm text-amber-100">{error}</p> : null}
        <AdronisWebinarCheckoutButton
          source="adronis_webinar_checkout_page"
          owned={owned}
          registrationOpen={catalog.registrationOpen}
          onError={setError}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950"
        />
      </div>
    </div>
  );
}
