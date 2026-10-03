import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  STAR_FAMILY_WEBINAR_CHECKOUT_PATH,
  STAR_FAMILY_WEBINAR_EVENT_ID,
  STAR_FAMILY_WEBINAR_HOME_HIGHLIGHTS,
  getStarFamilyWebinarPublicCatalog,
} from "@wisdom/utils";
import { trackEvent, trackEventOnce } from "../../lib/analytics";
import StarFamilyCheckoutButton from "./StarFamilyCheckoutButton";
import StarFamilyPoster from "./StarFamilyPoster";

const CTA_CLASS = "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

export default function StarFamilyHomeSection() {
  const reduceMotion = useReducedMotion();
  const catalog = getStarFamilyWebinarPublicCatalog();

  useEffect(() => {
    trackEventOnce("analytics:star-family:home-view", "webinar_home_view", {
      webinar_id: STAR_FAMILY_WEBINAR_EVENT_ID,
      webinar_type: "live_webinar",
      placement: "homepage_primary",
      price_cents: catalog.priceCents,
      currency: catalog.currency,
    });
  }, [catalog.currency, catalog.priceCents]);

  return (
    <section
      id="star-family-communion"
      aria-labelledby="star-family-communion-heading"
      className="relative overflow-hidden px-4 py-8 sm:px-6 sm:py-10"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(251,191,36,0.14),transparent_36%),radial-gradient(circle_at_82%_18%,rgba(14,165,233,0.16),transparent_40%),radial-gradient(circle_at_50%_100%,rgba(99,102,241,0.12),transparent_42%)]" />
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.45 }}
        className="relative mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] border border-cyan-200/15 bg-[#07111f]/88 shadow-[0_0_0_1px_rgba(103,232,249,0.08),0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl lg:grid-cols-[minmax(16rem,28rem)_minmax(0,1fr)]"
      >
        <div className="bg-[#04050f]">
          <StarFamilyPoster priority />
        </div>
        <div className="flex flex-col justify-center space-y-5 p-6 sm:p-8 lg:p-10">
          <div className="space-y-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-100/75">Live Webinar</p>
            <h2 id="star-family-communion-heading" className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              {catalog.title}
            </h2>
            <p className="text-sm text-amber-100/80">{catalog.displayDate}</p>
            <p className="text-sm text-white/70">{catalog.displayTime} · Live on Zoom</p>
            <p className="max-w-2xl text-sm leading-7 text-white/72 sm:text-base">{catalog.homeSummary}</p>
          </div>
          <ul className="space-y-2 text-sm leading-6 text-white/70">
            {catalog.homeHighlights.length ? catalog.homeHighlights.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-200/80" aria-hidden />
                <span>{item}</span>
              </li>
            )) : STAR_FAMILY_WEBINAR_HOME_HIGHLIGHTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="space-y-3">
            <p className="text-lg font-semibold text-amber-100">{catalog.displayPrice}</p>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Complimentary recording included</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {catalog.registrationOpen ? (
                <StarFamilyCheckoutButton source="home_star_family" placement="homepage_primary" className={CTA_CLASS} />
              ) : (
                <p className="text-sm text-white/70">Live registration for this webinar has closed.</p>
              )}
              <Link
                to={STAR_FAMILY_WEBINAR_CHECKOUT_PATH}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-cyan-200/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                onClick={() => trackEvent("webinar_learn_more_clicked", {
                  webinar_id: STAR_FAMILY_WEBINAR_EVENT_ID,
                  webinar_type: "live_webinar",
                  placement: "homepage_primary",
                })}
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
