import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { REGISTER_REASSURANCE } from "../lib/purchaseReassurance";
import {
  PRIME_ALCHEMY_WEBINAR_AUTOCHECKOUT_PATH,
  PRIME_ALCHEMY_WEBINAR_EVENT_ID,
  PRIME_ALCHEMY_WEBINAR_THANK_YOU_PATH,
  getPrimeAlchemyWebinarPublicCatalog,
} from "@wisdom/utils";
import AdronisWebinarCheckoutButton from "../components/webinars/AdronisWebinarCheckoutButton";
import { usePageMeta } from "../hooks/usePageMeta";
import { trackCtaClick } from "../lib/analytics";
import { startWebinarCheckout } from "../lib/webinarCheckout";
import { fetchWebinarMe } from "../lib/webinarApi";
import GuestCheckoutModal from "../components/guest/GuestCheckoutModal";

const CTA_CLASS_NAME = "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#D7B454] to-[#F2D88A] px-6 py-3 text-sm font-semibold text-[#07111C] shadow-[0_10px_32px_rgba(215,180,84,0.22)] transition hover:-translate-y-px hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

export default function PrimeAlchemyWebinarLearnMore() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const catalog = getPrimeAlchemyWebinarPublicCatalog();
  const [owned, setOwned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const autocheckoutStartedRef = useRef(false);
  const shouldAutocheckout = searchParams.get("autocheckout") === "1";

  usePageMeta({
    title: `${catalog.title} | The Prime Mentor`,
    description: catalog.description,
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

  useEffect(() => {
    if (!isSignedIn || !shouldAutocheckout || autocheckoutStartedRef.current || owned || !catalog.registrationOpen) {
      return;
    }

    autocheckoutStartedRef.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete("autocheckout");
    setSearchParams(next, { replace: true });

    void (async () => {
      try {
        const token = await getToken();
        trackCtaClick("adronis_webinar_checkout_started", "prime_alchemy_webinar_autocheckout", {
          eventId: PRIME_ALCHEMY_WEBINAR_EVENT_ID,
        });
        await startWebinarCheckout(PRIME_ALCHEMY_WEBINAR_EVENT_ID, { token });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to open Stripe checkout.";
        if (/already been purchased|already been paid/i.test(message)) {
          navigate(PRIME_ALCHEMY_WEBINAR_THANK_YOU_PATH, { replace: true });
          return;
        }
        setError(message);
      }
    })();
  }, [catalog.registrationOpen, getToken, isSignedIn, navigate, owned, searchParams, setSearchParams, shouldAutocheckout]);

  if (shouldAutocheckout && isLoaded && !isSignedIn) {
    return <Navigate to={`/sign-up?redirect_url=${encodeURIComponent(PRIME_ALCHEMY_WEBINAR_AUTOCHECKOUT_PATH)}`} replace />;
  }

  if (owned && shouldAutocheckout) {
    return <Navigate to={PRIME_ALCHEMY_WEBINAR_THANK_YOU_PATH} replace />;
  }

  const ctaLabel = owned ? "Access Webinar Registration" : `Register — ${catalog.displayPrice}`;

  return (
    <div className="relative isolate min-h-full overflow-hidden text-[#F8FAFC]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(24,80,120,0.34),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(43,125,142,0.22),transparent_32%),radial-gradient(circle_at_50%_70%,rgba(80,40,130,0.18),transparent_42%)]"
        aria-hidden="true"
      />
      <section className="relative px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:px-8">
        <div className="relative mx-auto w-full max-w-[76rem]">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-[#E5C267]">Upcoming Live Webinar</p>
          <h1 className="hero-headline mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-[#F8FAFC] sm:text-5xl lg:text-6xl">
            {catalog.title}
          </h1>
          <p className="mt-4 text-sm font-medium uppercase tracking-[0.18em] text-[#67E8F9]">{catalog.presenter}</p>
          <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-2">
            <p className="text-2xl font-semibold text-[#F0D78A]">{catalog.displayPrice}</p>
            <p className="pb-0.5 text-base text-[#94A3B8]">{catalog.displayDate}</p>
            <p className="pb-0.5 text-base text-[#94A3B8]">{catalog.displayTime}</p>
            <p className="pb-0.5 text-base text-[#94A3B8]">3-hour Zoom event</p>
          </div>

          <div className="mt-6 space-y-3">
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
              {ctaLabel}
            </AdronisWebinarCheckoutButton>
            {!owned && !isSignedIn ? (
              <button
                type="button"
                onClick={() => setGuestModalOpen(true)}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto"
              >
                Continue as guest
              </button>
            ) : null}
            {owned ? null : (
              <p className="text-sm text-[#94A3B8]">{REGISTER_REASSURANCE}</p>
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
            {catalog.descriptionParagraphs.map((paragraph) => (
              <p key={paragraph} className="text-base leading-8 text-[#CBD5E1] sm:text-lg">{paragraph}</p>
            ))}
            <p className="text-base leading-8 text-[#F0D78A]">
              Live three-hour Zoom event — {catalog.displayPrice}
            </p>
            <ul className="space-y-2 text-sm leading-7 text-[#CBD5E1] sm:text-base">
              {catalog.featureBullets.map((bullet) => (
                <li key={bullet} className="flex gap-3">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E5C267]" aria-hidden />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2">
              <AdronisWebinarCheckoutButton
                source="prime_alchemy_learn_more_details"
                eventId={catalog.eventId}
                title={catalog.title}
                autocheckoutPath={catalog.autocheckoutPath}
                thankYouPath={catalog.thankYouPath}
                owned={owned}
                registrationOpen={catalog.registrationOpen}
                onError={setError}
                className={CTA_CLASS_NAME}
              >
                {ctaLabel}
              </AdronisWebinarCheckoutButton>
            </div>
          </div>
        </div>
      </section>
      <GuestCheckoutModal
        open={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
        endpoint="/guest/webinar-checkout"
        extraBody={{ eventId: catalog.eventId }}
        title="Continue as guest"
        itemLabel={`${catalog.title} — ${catalog.displayPrice}`}
      />
    </div>
  );
}
