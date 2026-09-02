import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ADRONIS_WEBINAR_EVENT_ID,
  ADRONIS_WEBINAR_FEATURE_BULLETS,
  getAdronisWebinarPublicCatalog,
} from "@wisdom/utils";
import { trackEventOnce } from "../../lib/analytics";
import { fetchPublicWebinar, fetchWebinarMe } from "../../lib/webinarApi";
import AdronisWebinarCheckoutButton from "./AdronisWebinarCheckoutButton";

export default function AdronisWebinarHomeCard() {
  const { isSignedIn, getToken } = useAuth();
  const reduceMotion = useReducedMotion();
  const [catalog, setCatalog] = useState(getAdronisWebinarPublicCatalog);
  const [owned, setOwned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicWebinar(ADRONIS_WEBINAR_EVENT_ID).then((next) => {
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
        const state = await fetchWebinarMe(ADRONIS_WEBINAR_EVENT_ID, token);
        if (!cancelled) {
          setOwned(state.joinEligible);
          setCatalog((current) => ({ ...current, ...state, featureBullets: current.featureBullets }));
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
    if (catalog.registrationOpen || owned) {
      trackEventOnce("analytics:adronis-webinar:home-impression", "cta_click", {
        source: "home_adronis_webinar",
        label: "webinar_card_viewed",
        eventId: ADRONIS_WEBINAR_EVENT_ID,
      });
    }
  }, [catalog.registrationOpen, owned]);

  if (!catalog.registrationOpen && !owned) {
    return null;
  }

  return (
    <section
      id="adronis-webinar"
      aria-labelledby="adronis-webinar-heading"
      className="relative overflow-hidden px-4 py-8 sm:px-6 sm:py-10"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(52,211,153,0.16),transparent_36%),radial-gradient(circle_at_82%_18%,rgba(99,102,241,0.18),transparent_40%),radial-gradient(circle_at_50%_100%,rgba(14,165,233,0.12),transparent_42%)]" />
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.45 }}
        className="relative mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] border border-cyan-200/20 bg-[#07111f]/88 shadow-[0_0_0_1px_rgba(212,175,55,0.12),0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl lg:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)]"
      >
        <div className="relative bg-slate-950">
          <img
            src={catalog.posterPath}
            alt={catalog.posterAlt}
            width={1024}
            height={576}
            className="h-auto w-full object-contain"
            loading="eager"
            decoding="async"
          />
        </div>

        <div className="flex flex-col justify-center space-y-5 p-6 sm:p-8 lg:p-10">
          <div className="space-y-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-amber-100/75">Live Webinar</p>
            <h2 id="adronis-webinar-heading" className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              {catalog.title}
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
              Join Brad Johnson for a life-changing live webinar experience as he channels Adronis.
            </p>
            <p className="max-w-2xl text-sm leading-7 text-white/66 sm:text-base">
              Adronis will share deep insights into humanity’s path from the current phase of disclosure toward global first contact. Explore how this transition may unfold, what global contact could mean for humanity, and what may follow in its aftermath.
            </p>
            <p className="max-w-2xl text-sm leading-7 text-white/66 sm:text-base">
              The webinar will be held live on Zoom and will include an interactive question-and-answer session with Adronis.
            </p>
          </div>

          <ul className="grid gap-2.5 text-sm text-white/78">
            {ADRONIS_WEBINAR_FEATURE_BULLETS.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span aria-hidden="true" className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-200/40 text-[0.7rem] text-amber-100">★</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-1 border-t border-white/10 pt-4">
            <p className="text-base font-semibold text-amber-100">{catalog.displayDate}</p>
            <p className="text-sm text-white/70">{catalog.displayTime}</p>
            <p className="pt-1 text-lg font-semibold text-white">{catalog.displayPrice}</p>
          </div>

          <div className="space-y-2">
            <AdronisWebinarCheckoutButton
              source="home_adronis_webinar"
              owned={owned}
              registrationOpen={catalog.registrationOpen}
              onError={setError}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_45px_rgba(251,191,36,0.16)] transition hover:-translate-y-0.5 hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            />
            {error ? <p className="text-sm text-amber-100">{error}</p> : null}
            {!owned ? (
              <p className="text-xs leading-5 text-white/55">
                A free Prime Mentor account is required to purchase and access the webinar registration link.
              </p>
            ) : null}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
