import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import {
  PRIME_ALCHEMY_WEBINAR_EVENT_ID,
  PRIME_ALCHEMY_WEBINAR_THANK_YOU_PATH,
  getPrimeAlchemyWebinarPublicCatalog,
} from "@wisdom/utils";
import AdronisWebinarCheckoutButton from "../components/webinars/AdronisWebinarCheckoutButton";
import { usePageMeta } from "../hooks/usePageMeta";
import { fetchWebinarMe } from "../lib/webinarApi";

const CTA_CLASS_NAME = "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#D7B454] to-[#F2D88A] px-6 py-3 text-sm font-semibold text-[#07111C] shadow-[0_10px_32px_rgba(215,180,84,0.22)] transition hover:-translate-y-px hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

export default function PrimeAlchemyWebinarLearnMore() {
  const { isSignedIn, getToken } = useAuth();
  const [searchParams] = useSearchParams();
  const catalog = getPrimeAlchemyWebinarPublicCatalog();
  const [owned, setOwned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shouldAutocheckout = searchParams.get("autocheckout") === "1";

  usePageMeta({
    title: `${catalog.title} | The Prime Mentor`,
    description: catalog.onDemandHomeSummary,
    canonical: `https://theprimementor.com${catalog.checkoutPath}`,
    ogImage: `https://theprimementor.com${catalog.landscapePosterPath}`,
  });

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const state = await fetchWebinarMe(PRIME_ALCHEMY_WEBINAR_EVENT_ID, token);
        if (cancelled) return;
        if (state.joinEligible) setOwned(true);
      } catch {
        if (!cancelled) setOwned(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn]);

  if (owned && shouldAutocheckout) {
    return <Navigate to={PRIME_ALCHEMY_WEBINAR_THANK_YOU_PATH} replace />;
  }

  return (
    <div className="relative isolate min-h-full overflow-hidden text-[#F8FAFC]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(24,80,120,0.34),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(43,125,142,0.22),transparent_32%),radial-gradient(circle_at_50%_70%,rgba(80,40,130,0.18),transparent_42%)]"
        aria-hidden="true"
      />
      <section className="relative px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:px-8">
        <div className="relative mx-auto w-full max-w-[76rem]">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-[#E5C267]">Available On Demand</p>
          <h1 className="hero-headline mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-[#F8FAFC] sm:text-5xl lg:text-6xl">
            {catalog.title}
          </h1>
          <p className="mt-4 text-sm font-medium uppercase tracking-[0.18em] text-[#67E8F9]">{catalog.presenter}</p>
          <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-2">
            <p className="text-2xl font-semibold text-[#F0D78A]">{catalog.onDemandDisplayDate}</p>
            <p className="pb-0.5 text-base text-[#94A3B8]">On-demand recording</p>
          </div>

          <div className="mt-6 space-y-3">
            {owned ? (
              <AdronisWebinarCheckoutButton
                source="prime_alchemy_learn_more"
                eventId={catalog.eventId}
                title={catalog.title}
                autocheckoutPath={catalog.autocheckoutPath}
                thankYouPath={catalog.thankYouPath}
                owned={owned}
                registrationOpen={catalog.registrationOpen}
                onError={setError}
                className={CTA_CLASS_NAME}
              >
                Access Webinar Registration
              </AdronisWebinarCheckoutButton>
            ) : (
              <p className="text-base leading-7 text-[#CBD5E1]">
                Live registration has ended. On-demand purchase opens {catalog.onDemandDisplayDate}.
              </p>
            )}
            {error ? <p className="text-sm text-[#F0D78A]">{error}</p> : null}
          </div>

          <figure className="mt-10 overflow-hidden rounded-3xl border border-white/[0.09] bg-[#050a12] shadow-[0_30px_90px_rgba(0,0,0,0.48),0_0_55px_rgba(41,190,220,0.08)]">
            <img
              src={catalog.landscapePosterPath}
              alt={catalog.posterAlt}
              width={1672}
              height={941}
              className="mx-auto h-auto w-full object-contain"
              loading="eager"
              decoding="async"
            />
          </figure>

          <div className="glass-card mt-10 space-y-5 p-6 sm:p-8">
            <p className="text-base leading-8 text-[#CBD5E1] sm:text-lg">{catalog.onDemandHomeSummary}</p>
            {catalog.descriptionParagraphs.map((paragraph) => (
              <p key={paragraph} className="text-base leading-8 text-[#CBD5E1] sm:text-lg">{paragraph}</p>
            ))}
            <ul className="space-y-2 text-sm leading-7 text-[#CBD5E1] sm:text-base">
              {catalog.featureBullets.map((bullet) => (
                <li key={bullet} className="flex gap-3">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E5C267]" aria-hidden />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
