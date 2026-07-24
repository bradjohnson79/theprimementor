import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import regenerationOfferImage from "../assets/regeneration-qa-package.png";
import RegenerationOfferCheckoutButton from "../components/regeneration-offer/RegenerationOfferCheckoutButton";
import { useRegenerationOfferStatus } from "../hooks/useRegenerationOfferStatus";
import { trackCtaClick, trackEventOnce } from "../lib/analytics";
import { formatRegenerationOfferPrice } from "../lib/regenerationOffer";

const CTA_CLASS =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-5 py-3 text-sm font-medium text-slate-950 transition hover:from-cyan-400 hover:via-sky-400 hover:to-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-60";

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
  const priceLabel = formatRegenerationOfferPrice(status);

  useEffect(() => {
    if (active) {
      trackEventOnce("analytics:regeneration-offer:landing-view", "cta_click", {
        source: "regeneration_offer_landing",
        label: "regeneration_offer_landing_view",
      });
    }
  }, [active]);

  const sectionMotion = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.18 },
        transition: { duration: 0.55, ease: "easeOut" as const },
      };

  return (
    <div className="relative">
      <section className="relative overflow-hidden border-b border-white/8">
        <div className="absolute inset-0">
          <div className="absolute -left-24 top-16 h-80 w-80 rounded-full bg-cyan-400/12 blur-3xl" />
          <div className="absolute right-0 top-0 h-[28rem] w-[28rem] rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,5,15,0.18),rgba(4,5,15,0.58))]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 py-16 sm:py-20 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">
                Limited-Time Offer
              </p>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
                Regeneration Q&A Package
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-white/72 sm:text-lg">
                A 30-day Regeneration experience with one personalized session, priority email support, and a private 30-minute Q&A.
              </p>
              <ul className="mt-5 max-w-3xl space-y-3 text-sm leading-7 text-white/72 sm:text-base">
                {INCLUDED_ITEMS.map((item) => (
                  <li key={item.title} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-200/70" aria-hidden="true" />
                    <span>{item.title}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/58 sm:text-base">
                {priceLabel} CAD · One-time purchase · No subscription
              </p>
              <p className="mt-3 text-sm text-white/58">
                Available until August 31, 2026 at 11:59 PM Pacific.
              </p>

              {active ? (
                <div className="mt-8 space-y-3">
                  <RegenerationOfferCheckoutButton
                    source="regeneration_offer_landing"
                    onError={setError}
                    className={CTA_CLASS}
                  />
                  {error ? <p className="text-sm text-cyan-100/80">{error}</p> : null}
                </div>
              ) : (
                <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm leading-7 text-white/70">
                  {loading
                    ? "Checking offer availability..."
                    : "This limited-time offer has expired. Please explore the current Regeneration services."}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.16),_transparent_48%),linear-gradient(180deg,rgba(8,12,24,0.96),rgba(4,6,15,0.94))] p-6 shadow-2xl">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-cyan-200/62">
                30-Day Regeneration Experience
              </p>
              <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-white">
                One-time support without a monthly subscription
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/65">
                Complete your Regeneration Session, then use priority email support and your included 30-minute Q&A inside the same 30-day window.
              </p>
            </div>
          </div>
        </div>
      </section>

      <motion.section {...sectionMotion} className="relative border-t border-white/8 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center">
            <div className="min-w-0">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">
                What&apos;s Included
              </p>
              <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-[2.15rem]">
                Everything in the package supports a focused 30-day regeneration window.
              </h2>
              <div className="mt-6 space-y-5">
                {INCLUDED_ITEMS.map((item) => (
                  <div key={item.title}>
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-white/66 sm:text-base">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.16),_transparent_45%),linear-gradient(180deg,rgba(9,13,24,0.94),rgba(5,7,16,0.94))] p-3 shadow-[0_24px_64px_rgba(0,0,0,0.3)]">
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <img
                  src={regenerationOfferImage}
                  alt="Regeneration Q&A Package promotional artwork"
                  className="aspect-[4/3] h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section {...sectionMotion} className="relative border-t border-white/8 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">
            How It Works
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-[2.15rem]">
            A simple path from session to support to Q&A.
          </h2>
          <ul className="mt-6 max-w-3xl space-y-3">
            {[
              "1. Purchase the Regeneration Q&A Package as a one-time order.",
              "2. Complete your Regeneration Session with Brad.",
              "3. Your 30 days of priority email support begin on session completion.",
              "4. Book and use your included 30-minute Q&A inside that same support window.",
            ].map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-7 text-white/68 sm:text-base">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/70" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </motion.section>

      <motion.section {...sectionMotion} className="relative border-t border-white/8 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">
            FAQ
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-[2.15rem]">
            Important details
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {FAQ_ITEMS.map((item) => (
              <article key={item.question} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-base font-semibold text-white">{item.question}</h3>
                <p className="mt-3 text-sm leading-7 text-white/64">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section {...sectionMotion} className="relative border-t border-white/8 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_44%),linear-gradient(180deg,rgba(9,13,24,0.96),rgba(5,7,16,0.94))] px-6 py-8 sm:px-8 sm:py-10">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">
              Begin Your Package
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-[2.25rem]">
              Order the Regeneration Q&A Package
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/66 sm:text-base">
              {priceLabel} CAD one-time. Offer ends August 31, 2026 at 11:59 PM America/Vancouver time.
            </p>
            <div className="mt-8">
              {active ? (
                <RegenerationOfferCheckoutButton
                  source="regeneration_offer_landing_bottom"
                  onError={setError}
                  className={CTA_CLASS}
                />
              ) : (
                <Link
                  to="/sessions/regeneration"
                  onClick={() => trackCtaClick("view_current_regeneration", "regeneration_offer_expired", {
                    href: "/sessions/regeneration",
                  })}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/8"
                >
                  View Current Services
                </Link>
              )}
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
