import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import {
  ADRONIS_ON_DEMAND_AUTOCHECKOUT_PATH,
  ADRONIS_ON_DEMAND_CANCEL_PATH,
  ADRONIS_ON_DEMAND_PLAYER_PATH,
  ADRONIS_ON_DEMAND_THANK_YOU_PATH,
  ADRONIS_ON_DEMAND_WEBINAR_ID,
  getOnDemandWebinarById,
  getOnDemandWebinarPublicCatalog,
} from "@wisdom/utils";
import OnDemandWebinarCheckoutButton from "../components/webinars/OnDemandWebinarCheckoutButton";
import { trackCtaClick } from "../lib/analytics";
import { fetchOnDemandWebinarMe, fetchPublicOnDemandWebinar, startOnDemandWebinarCheckout } from "../lib/onDemandWebinarApi";

export default function OnDemandWebinarCheckout() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fallback = getOnDemandWebinarById(ADRONIS_ON_DEMAND_WEBINAR_ID);
  const [catalog, setCatalog] = useState(() => (
    fallback
      ? getOnDemandWebinarPublicCatalog(fallback, { assetReady: false, playbackProtected: false })
      : null
  ));
  const [owned, setOwned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autocheckoutStartedRef = useRef(false);
  const shouldAutocheckout = searchParams.get("autocheckout") === "1";
  const canceledCheckout = searchParams.get("checkout") === "canceled";

  useEffect(() => {
    void fetchPublicOnDemandWebinar(ADRONIS_ON_DEMAND_WEBINAR_ID).then(setCatalog);
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const state = await fetchOnDemandWebinarMe(ADRONIS_ON_DEMAND_WEBINAR_ID, token);
        if (cancelled) return;
        setCatalog(state);
        if (state.owned) {
          setOwned(true);
          navigate(ADRONIS_ON_DEMAND_PLAYER_PATH, { replace: true });
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
    if (!isSignedIn || !shouldAutocheckout || autocheckoutStartedRef.current || owned || !catalog?.saleable) {
      return;
    }

    autocheckoutStartedRef.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete("autocheckout");
    setSearchParams(next, { replace: true });

    void (async () => {
      try {
        const token = await getToken();
        trackCtaClick("on_demand_webinar_checkout_started", "on_demand_webinar_autocheckout", {
          webinarId: ADRONIS_ON_DEMAND_WEBINAR_ID,
        });
        await startOnDemandWebinarCheckout(ADRONIS_ON_DEMAND_WEBINAR_ID, { token });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to open Stripe checkout.";
        if (/already been purchased|already been paid/i.test(message)) {
          navigate(ADRONIS_ON_DEMAND_THANK_YOU_PATH, { replace: true });
          return;
        }
        setError(message);
      }
    })();
  }, [catalog?.saleable, getToken, isSignedIn, navigate, owned, searchParams, setSearchParams, shouldAutocheckout]);

  if (canceledCheckout) {
    return <Navigate to={ADRONIS_ON_DEMAND_CANCEL_PATH} replace />;
  }

  if (!isSignedIn) {
    const redirectUrl = `${location.pathname}${location.search}${location.hash}` || ADRONIS_ON_DEMAND_AUTOCHECKOUT_PATH;
    if (isLoaded) {
      return <Navigate to={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`} replace />;
    }
    return <div className="mx-auto max-w-3xl px-6 py-16 text-white/70">Loading...</div>;
  }

  if (!catalog) {
    return <div className="mx-auto max-w-3xl px-6 py-16 text-white/70">Webinar not found.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-16 text-white">
      <img src={catalog.posterPath} alt={catalog.posterAlt} width={576} height={1024} className="mx-auto w-full max-w-[26rem] rounded-3xl object-contain bg-slate-950" />
      <h1 className="text-3xl font-semibold">{catalog.title}</h1>
      <p className="text-white/70">{catalog.description}</p>
      <OnDemandWebinarCheckoutButton
        source="on_demand_webinar_checkout_page"
        owned={owned}
        saleable={catalog.saleable}
        onError={setError}
        className="inline-flex rounded-full bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950"
      />
      {error ? <p className="text-sm text-amber-200">{error}</p> : null}
    </div>
  );
}
