import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ADRONIS_ON_DEMAND_FEATURE_BULLETS,
  ADRONIS_ON_DEMAND_WEBINAR_ID,
  getOnDemandWebinarById,
  getOnDemandWebinarPublicCatalog,
} from "@wisdom/utils";
import { trackEventOnce } from "../../lib/analytics";
import { fetchOnDemandWebinarMe, fetchPublicOnDemandWebinar } from "../../lib/onDemandWebinarApi";
import OnDemandWebinarCheckoutButton from "./OnDemandWebinarCheckoutButton";

export default function OnDemandWebinarsHomeSection() {
  const { isSignedIn, getToken } = useAuth();
  const reduceMotion = useReducedMotion();
  const fallback = getOnDemandWebinarById(ADRONIS_ON_DEMAND_WEBINAR_ID);
  const [catalog, setCatalog] = useState(() => (
    fallback
      ? getOnDemandWebinarPublicCatalog(fallback, { assetReady: false, playbackProtected: false })
      : null
  ));
  const [owned, setOwned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicOnDemandWebinar(ADRONIS_ON_DEMAND_WEBINAR_ID).then((next) => {
      if (!cancelled) setCatalog(next);
    });
    return () => {
      cancelled = true;
    };
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
        if (!cancelled) {
          setOwned(state.owned);
          setCatalog(state);
        }
      } catch {
        if (!cancelled) setOwned(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (!catalog?.published) return;
    trackEventOnce("analytics:adronis-on-demand:home-impression", "cta_click", {
      source: "home_on_demand_webinar",
      label: "on_demand_card_viewed",
      webinarId: ADRONIS_ON_DEMAND_WEBINAR_ID,
    });
  }, [catalog?.published]);

  if (!catalog?.published) {
    return null;
  }

  return (
    <section
      id="on-demand-webinars"
      aria-labelledby="on-demand-webinars-heading"
      className="relative overflow-hidden px-4 py-8 sm:px-6 sm:py-10"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(251,191,36,0.14),transparent_36%),radial-gradient(circle_at_82%_18%,rgba(14,165,233,0.16),transparent_40%),radial-gradient(circle_at_50%_100%,rgba(99,102,241,0.12),transparent_42%)]" />
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.45 }}
        className="relative mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] border border-amber-200/20 bg-[#07111f]/88 shadow-[0_0_0_1px_rgba(212,175,55,0.12),0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl lg:grid-cols-[minmax(16rem,26rem)_minmax(0,1fr)]"
      >
        <div className="relative bg-slate-950">
          <img
            src={catalog.posterPath}
            alt={catalog.posterAlt}
            width={576}
            height={1024}
            className="mx-auto h-auto w-full max-w-[26rem] object-contain"
            loading="eager"
            decoding="async"
          />
        </div>

        <div className="flex flex-col justify-center space-y-5 p-6 sm:p-8 lg:p-10">
          <div className="space-y-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-amber-100/75">Webinars On Demand</p>
            <h2 id="on-demand-webinars-heading" className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              {catalog.title}
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
              {catalog.description}
            </p>
          </div>

          <ul className="space-y-2 text-sm leading-6 text-white/70">
            {(catalog.featureBullets.length ? catalog.featureBullets : ADRONIS_ON_DEMAND_FEATURE_BULLETS).map((bullet) => (
              <li key={bullet} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-200/80" aria-hidden />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-3">
            <p className="text-lg font-semibold text-white">{catalog.displayPrice}</p>
            <OnDemandWebinarCheckoutButton
              source="home_on_demand_webinar"
              owned={owned}
              saleable={catalog.saleable}
              onError={setError}
              className="inline-flex w-full items-center justify-center rounded-full bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {owned ? "Watch Now" : "Watch On Demand — $7.99 CAD"}
            </OnDemandWebinarCheckoutButton>
            <p className="text-xs leading-5 text-white/50">
              A free account is required. After purchase, watch anytime in Dashboard → Webinars.
            </p>
            {error ? <p className="text-sm text-amber-200">{error}</p> : null}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
