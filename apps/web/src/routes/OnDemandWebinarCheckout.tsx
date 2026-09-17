import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import {
  ADRONIS_ON_DEMAND_FEATURE_BULLETS,
  ADRONIS_ON_DEMAND_LANDSCAPE_POSTER_PATH,
  ADRONIS_ON_DEMAND_CANCEL_PATH,
  ADRONIS_ON_DEMAND_PLAYER_PATH,
  ADRONIS_ON_DEMAND_THANK_YOU_PATH,
  ADRONIS_ON_DEMAND_WEBINAR_ID,
  getOnDemandWebinarById,
  getOnDemandWebinarPublicCatalog,
} from "@wisdom/utils";
import OnDemandWebinarCheckoutButton from "../components/webinars/OnDemandWebinarCheckoutButton";
import { usePageMeta } from "../hooks/usePageMeta";
import { trackCtaClick } from "../lib/analytics";
import { fetchOnDemandWebinarMe, fetchPublicOnDemandWebinar, startOnDemandWebinarCheckout } from "../lib/onDemandWebinarApi";

const CANONICAL = "https://theprimementor.com/webinars/adronis-disclosure-to-contact/on-demand";
const LANDING_OG_IMAGE = `https://theprimementor.com${ADRONIS_ON_DEMAND_LANDSCAPE_POSTER_PATH}`;

export default function OnDemandWebinarCheckout() {
  const { isSignedIn, getToken } = useAuth();
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

  usePageMeta({
    title: "Adronis: From Disclosure to Contact | On Demand",
    description:
      "Watch the recorded Adronis webinar with Brad Johnson on humanity’s path from disclosure toward global first contact. Available now on demand for $7.99 CAD.",
    canonical: CANONICAL,
    ogImage: LANDING_OG_IMAGE,
  });

  useEffect(() => {
    void fetchPublicOnDemandWebinar(ADRONIS_ON_DEMAND_WEBINAR_ID).then(setCatalog);
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      setOwned(false);
      return;
    }
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

  if (!catalog) {
    return <div className="mx-auto max-w-3xl px-6 py-16 text-white/70">Webinar not found.</div>;
  }

  const bullets = catalog.featureBullets.length ? catalog.featureBullets : ADRONIS_ON_DEMAND_FEATURE_BULLETS;

  return (
    <div className="relative isolate overflow-hidden text-white">
      <section className="relative px-6 pb-20 pt-16 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_36%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_34%),radial-gradient(circle_at_bottom,rgba(99,102,241,0.10),transparent_40%)]" />
        <div className="relative mx-auto max-w-4xl">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-amber-200/72">On Demand Recording</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
            {catalog.title}
          </h1>
          <p className="mt-3 text-sm uppercase tracking-[0.18em] text-cyan-200/70">{catalog.presenter}</p>
          <p className="mt-4 text-lg font-medium text-amber-100">
            {catalog.displayPrice}
            <span className="mx-2 text-white/30">·</span>
            <span className="text-white/70">{catalog.displayDuration}</span>
          </p>

          <figure className="mt-8 overflow-hidden rounded-[1.6rem] border border-amber-200/20 bg-slate-950 p-2">
            <img
              src={ADRONIS_ON_DEMAND_LANDSCAPE_POSTER_PATH}
              alt={catalog.posterAlt}
              width={1672}
              height={941}
              className="mx-auto h-auto w-full rounded-[1.2rem] object-contain"
              loading="eager"
              decoding="async"
            />
          </figure>

          <div className="mx-auto mt-8 max-w-3xl space-y-5">
            <p className="text-base leading-8 text-white/72 sm:text-lg">
              The recorded Adronis webinar is now available to watch anytime. Brad Johnson channels Adronis on
              humanity’s path from the current phase of disclosure toward global first contact — and what may
              follow in its aftermath.
            </p>
            <p className="text-base leading-8 text-white/68">
              {catalog.description}
            </p>
            <ul className="space-y-2 text-sm leading-7 text-white/70 sm:text-base">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-200/80" aria-hidden />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2">
              <OnDemandWebinarCheckoutButton
                source="on_demand_webinar_landing_page"
                owned={owned}
                saleable={catalog.saleable}
                onError={setError}
                className="inline-flex rounded-full bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {owned ? "Watch Now" : "Watch On Demand — $7.99 CAD"}
              </OnDemandWebinarCheckoutButton>
              <p className="mt-3 text-sm text-white/55">Create an Account or Sign-in to Purchase</p>
              {error ? <p className="mt-3 text-sm text-amber-200">{error}</p> : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
