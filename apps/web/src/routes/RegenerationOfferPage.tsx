import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import regenerationOfferImage from "../assets/regeneration-qa-package.png";
import RegenerationOfferCheckoutButton from "../components/regeneration-offer/RegenerationOfferCheckoutButton";
import { useRegenerationOfferStatus } from "../hooks/useRegenerationOfferStatus";
import { trackCtaClick, trackEventOnce } from "../lib/analytics";
import { formatRegenerationOfferPrice } from "../lib/regenerationOffer";

const INCLUDED_ITEMS = [
  {
    title: "1 Regeneration Session",
    description: "A personalized session to restore balance, clarity, and vitality.",
  },
  {
    title: "30 Days Priority Email Support",
    description: "Ask questions and receive priority support throughout your 30-day journey.",
  },
  {
    title: "1 x 30-Minute Q&A",
    description: "Book and use your private Q&A anytime within the same 30-day support window.",
  },
];

const FAQ_ITEMS = [
  {
    question: "When does the 30-day support window begin?",
    answer: "The support window begins when your Regeneration Session is completed.",
  },
  {
    question: "When must the Q&A be used?",
    answer: "The 30-minute Q&A must be booked and used within the 30-day support window.",
  },
  {
    question: "Is this a subscription?",
    answer: "No. This is a one-time purchase with no recurring billing.",
  },
];

export default function RegenerationOfferPage() {
  const prefersReducedMotion = useReducedMotion();
  const { status, loading } = useRegenerationOfferStatus();
  const [error, setError] = useState<string | null>(null);
  const active = status?.active === true;

  useEffect(() => {
    if (active) {
      trackEventOnce("analytics:regeneration-offer:landing-view", "cta_click", {
        source: "regeneration_offer_landing",
        label: "regeneration_offer_landing_view",
      });
    }
  }, [active]);

  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.6, ease: "easeOut" as const },
      };

  return (
    <div className="relative overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_8%,rgba(251,191,36,0.20),transparent_32%),radial-gradient(circle_at_78%_28%,rgba(34,211,238,0.14),transparent_36%),linear-gradient(180deg,rgba(15,23,42,0),rgba(15,23,42,0.58))]" />

      <section className="relative px-6 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(20rem,0.78fr)]">
          <motion.div {...motionProps} className="space-y-7">
            <div className="space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-amber-100/75">Limited-Time Offer</p>
              <div className="space-y-3">
                <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">
                  Regeneration Q&A Package
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-white/70">
                  A 30-day Regeneration experience with one personalized session, priority email support, and a private 30-minute Q&A.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-white/42">One-Time Price</p>
                <p className="mt-1 text-4xl font-semibold text-amber-100">{formatRegenerationOfferPrice(status)} CAD</p>
              </div>
              <div className="h-14 w-px bg-white/12" />
              <p className="max-w-xs text-sm leading-6 text-white/60">
                Available until August 31, 2026 at 11:59 PM Pacific. No subscription.
              </p>
            </div>

            {active ? (
              <div className="space-y-3">
                <RegenerationOfferCheckoutButton
                  source="regeneration_offer_landing"
                  onError={setError}
                  className="inline-flex min-h-14 items-center justify-center rounded-xl bg-amber-300 px-7 py-4 text-sm font-semibold text-slate-950 shadow-[0_20px_55px_rgba(251,191,36,0.18)] transition hover:-translate-y-0.5 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                />
                {error ? <p className="text-sm text-amber-100">{error}</p> : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/12 bg-white/[0.055] px-5 py-4 text-sm leading-7 text-white/70">
                {loading ? "Checking offer availability..." : "This limited-time offer has expired. Please explore the current Regeneration services."}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
            transition={prefersReducedMotion ? undefined : { duration: 0.75, ease: "easeOut" }}
            className="relative"
          >
            <img
              src={regenerationOfferImage}
              alt="Regeneration Q&A Package promotional artwork"
              className="w-full rounded-[1.75rem] border border-amber-200/24 shadow-[0_30px_95px_rgba(0,0,0,0.38)]"
              loading="eager"
              decoding="async"
            />
          </motion.div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-6 py-14">
        <div className="mx-auto max-w-6xl space-y-8">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-cyan-100/62">Included</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Everything in the package</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {INCLUDED_ITEMS.map((item) => (
              <article key={item.title} className="border-t border-white/12 pt-5">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/62">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-6 py-14">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1fr]">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-amber-100/62">How It Works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">A focused 30-day window</h2>
          </div>
          <div className="space-y-5 text-sm leading-7 text-white/66">
            <p>Your Regeneration Session anchors the package. Once that session is completed, your 30 days of priority email support begin.</p>
            <p>The included 30-minute Q&A must be booked and used during that same 30-day support window.</p>
            <p>This offer is designed for people who want immediate regeneration support with a short follow-up container, without starting a monthly subscription.</p>
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-6 py-14">
        <div className="mx-auto max-w-6xl space-y-8">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-cyan-100/62">FAQ</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Important details</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {FAQ_ITEMS.map((item) => (
              <article key={item.question} className="border-t border-white/12 pt-5">
                <h3 className="text-base font-semibold text-white">{item.question}</h3>
                <p className="mt-3 text-sm leading-7 text-white/62">{item.answer}</p>
              </article>
            ))}
          </div>
          <div className="flex flex-col gap-3 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/58">Offer ends August 31, 2026 at 11:59 PM America/Vancouver time.</p>
            {active ? (
              <RegenerationOfferCheckoutButton
                source="regeneration_offer_landing_bottom"
                onError={setError}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
              />
            ) : (
              <Link
                to="/#regeneration"
                onClick={() => trackCtaClick("view_current_regeneration", "regeneration_offer_expired", { href: "/#regeneration" })}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/8"
              >
                View Current Services
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
