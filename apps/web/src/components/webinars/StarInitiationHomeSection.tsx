import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  STAR_INITIATION_WEBINAR_AUTOCHECKOUT_PATH,
  STAR_INITIATION_WEBINAR_CHECKOUT_PATH,
  STAR_INITIATION_WEBINAR_EVENT_ID,
  STAR_INITIATION_WEBINAR_HOME_HIGHLIGHTS,
  STAR_INITIATION_WEBINAR_MAX_ATTENDEES,
  STAR_INITIATION_WEBINAR_THANK_YOU_PATH,
  STAR_INITIATION_WEBINAR_SOLD_OUT,
  STAR_INITIATION_WEBINAR_TITLE,
  getStarInitiationWebinarPublicCatalog,
} from "@wisdom/utils";
import AdronisWebinarCheckoutButton from "./AdronisWebinarCheckoutButton";
import SoldOutNotice from "./SoldOutNotice";
import { trackEventOnce } from "../../lib/analytics";
import { fetchPublicWebinar, fetchWebinarMe, type WebinarPublicCatalog } from "../../lib/webinarApi";

const CTA_CLASS = "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_45px_rgba(251,191,36,0.16)] transition hover:-translate-y-0.5 hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-auto";

export default function StarInitiationHomeSection() {
  const { isSignedIn, getToken } = useAuth();
  const reduceMotion = useReducedMotion();
  const [catalog, setCatalog] = useState<WebinarPublicCatalog>(getStarInitiationWebinarPublicCatalog);
  const [owned, setOwned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicWebinar(STAR_INITIATION_WEBINAR_EVENT_ID).then((next) => {
      if (!cancelled) {
        setCatalog((current) => ({
          ...current,
          ...next,
          registrationOpen: STAR_INITIATION_WEBINAR_SOLD_OUT ? false : next.registrationOpen,
          soldOut: STAR_INITIATION_WEBINAR_SOLD_OUT || ("soldOut" in next && next.soldOut === true),
        }));
      }
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
        const state = await fetchWebinarMe(STAR_INITIATION_WEBINAR_EVENT_ID, token);
        if (!cancelled) {
          setOwned(state.joinEligible);
          setCatalog((current) => ({
            ...current,
            ...state,
            registrationOpen: STAR_INITIATION_WEBINAR_SOLD_OUT ? false : state.registrationOpen,
            soldOut: STAR_INITIATION_WEBINAR_SOLD_OUT || state.soldOut === true,
          }));
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
      trackEventOnce("analytics:star-initiation:home-impression", "cta_click", {
        source: "home_star_initiation",
        label: "webinar_card_viewed",
        eventId: STAR_INITIATION_WEBINAR_EVENT_ID,
      });
    }
  }, [catalog.registrationOpen, owned]);

  const soldOut = catalog.soldOut === true || !catalog.registrationOpen;
  if (!catalog.registrationOpen && !soldOut && !owned) {
    return null;
  }

  const seatsLabel = soldOut
    ? "Sold out"
    : typeof catalog.seatsRemaining === "number"
      ? `${catalog.seatsRemaining} of ${STAR_INITIATION_WEBINAR_MAX_ATTENDEES} seats remaining`
      : `Limited to ${STAR_INITIATION_WEBINAR_MAX_ATTENDEES} attendees`;

  return (
    <section
      id="star-initiation"
      aria-labelledby="star-initiation-heading"
      className="relative overflow-hidden px-4 py-8 sm:px-6 sm:py-10"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(251,191,36,0.14),transparent_36%),radial-gradient(circle_at_82%_18%,rgba(14,165,233,0.16),transparent_40%),radial-gradient(circle_at_50%_100%,rgba(99,102,241,0.12),transparent_42%)]" />
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.45 }}
        className={`relative mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] bg-[#07111f]/88 backdrop-blur-xl lg:grid-cols-[minmax(16rem,28rem)_minmax(0,1fr)] ${soldOut ? "border border-amber-200/45 shadow-[0_0_0_1px_rgba(251,191,36,0.28),0_28px_90px_rgba(0,0,0,0.38),0_0_48px_rgba(251,191,36,0.14)]" : "border border-cyan-200/15 shadow-[0_0_0_1px_rgba(103,232,249,0.08),0_28px_90px_rgba(0,0,0,0.38)]"}`}
      >
        <div className="relative bg-slate-950">
          <img
            src={catalog.portraitPosterPath ?? catalog.posterPath}
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
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-100/75">Live Webinar</p>
            <h2 id="star-initiation-heading" className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              {catalog.title}
            </h2>
            <p className="text-sm text-amber-100/80">{catalog.displayDate}</p>
            <p className="text-sm text-white/70">{catalog.displayTime} · Live on Zoom</p>
            {soldOut && !owned ? (
              <SoldOutNotice detail={`All ${STAR_INITIATION_WEBINAR_MAX_ATTENDEES} seats for ${STAR_INITIATION_WEBINAR_TITLE} are taken.`} />
            ) : (
              <p className="inline-flex rounded-full border border-amber-200/30 bg-amber-300/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-100">
                {seatsLabel}
              </p>
            )}
            <p className="max-w-2xl text-sm leading-7 text-white/72 sm:text-base">{catalog.homeSummary}</p>
          </div>
          <ul className="space-y-2 text-sm leading-6 text-white/70">
            {(catalog.homeHighlights?.length ? catalog.homeHighlights : STAR_INITIATION_WEBINAR_HOME_HIGHLIGHTS).map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-200/80" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-3">
            {owned ? <p className="text-lg font-semibold text-amber-100">{catalog.displayPrice}</p> : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              {owned ? (
                <AdronisWebinarCheckoutButton
                  source="home_star_initiation"
                  eventId={STAR_INITIATION_WEBINAR_EVENT_ID}
                  title={STAR_INITIATION_WEBINAR_TITLE}
                  autocheckoutPath={STAR_INITIATION_WEBINAR_AUTOCHECKOUT_PATH}
                  thankYouPath={STAR_INITIATION_WEBINAR_THANK_YOU_PATH}
                  owned={owned}
                  registrationOpen={catalog.registrationOpen}
                  onError={setError}
                  className={CTA_CLASS}
                >
                  Access Webinar Registration
                </AdronisWebinarCheckoutButton>
              ) : null}
              <Link
                to={STAR_INITIATION_WEBINAR_CHECKOUT_PATH}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-cyan-200/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                Event details
              </Link>
            </div>
            {error ? <p className="text-sm text-amber-100">{error}</p> : null}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
