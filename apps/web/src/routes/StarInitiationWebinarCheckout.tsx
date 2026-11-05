import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import {
  STAR_INITIATION_WEBINAR_AUTOCHECKOUT_PATH,
  STAR_INITIATION_WEBINAR_EVENT_ID,
  STAR_INITIATION_WEBINAR_FEATURE_BULLETS,
  STAR_INITIATION_WEBINAR_PORTRAIT_POSTER_PATH,
  STAR_INITIATION_WEBINAR_MAX_ATTENDEES,
  STAR_INITIATION_WEBINAR_THANK_YOU_PATH,
  STAR_INITIATION_WEBINAR_TITLE,
  getStarInitiationWebinarPublicCatalog,
} from "@wisdom/utils";
import AdronisWebinarCheckoutButton from "../components/webinars/AdronisWebinarCheckoutButton";
import { usePageMeta } from "../hooks/usePageMeta";
import { trackCtaClick } from "../lib/analytics";
import { PURCHASE_REASSURANCE } from "../lib/purchaseReassurance";
import { fetchPublicWebinar, fetchWebinarMe, type WebinarPublicCatalog } from "../lib/webinarApi";
import { startWebinarCheckout } from "../lib/webinarCheckout";
import { pageCanonical } from "../lib/siteMeta";

const CTA_CLASS_NAME = "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#D7B454] to-[#F2D88A] px-6 py-3 text-sm font-semibold text-[#07111C] shadow-[0_10px_32px_rgba(215,180,84,0.22)] transition hover:-translate-y-px hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

export default function StarInitiationWebinarCheckout() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<WebinarPublicCatalog>(getStarInitiationWebinarPublicCatalog);
  const [owned, setOwned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autocheckoutStartedRef = useRef(false);
  const shouldAutocheckout = searchParams.get("autocheckout") === "1";
  const soldOut = catalog.soldOut === true;

  usePageMeta({
    title: `${STAR_INITIATION_WEBINAR_TITLE} | Live Webinar | The Prime Mentor`,
    description: catalog.homeSummary ?? catalog.description,
    canonical: pageCanonical(catalog.checkoutPath),
    ogImage: `https://theprimementor.com${STAR_INITIATION_WEBINAR_PORTRAIT_POSTER_PATH}`,
    jsonLd: [{
      "@context": "https://schema.org",
      "@type": "Event",
      name: catalog.title,
      description: catalog.description,
      startDate: catalog.startsAt,
      eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
      eventStatus: catalog.registrationOpen
        ? "https://schema.org/EventScheduled"
        : "https://schema.org/EventScheduled",
      location: {
        "@type": "VirtualLocation",
        url: pageCanonical(catalog.checkoutPath),
      },
      image: [`https://theprimementor.com${STAR_INITIATION_WEBINAR_PORTRAIT_POSTER_PATH}`],
      organizer: {
        "@type": "Organization",
        name: "The Prime Mentor",
        url: "https://theprimementor.com",
      },
      offers: {
        "@type": "Offer",
        price: (catalog.priceCents / 100).toFixed(2),
        priceCurrency: catalog.currency,
        url: pageCanonical(catalog.checkoutPath),
        availability: catalog.registrationOpen
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      },
      maximumAttendeeCapacity: STAR_INITIATION_WEBINAR_MAX_ATTENDEES,
    }],
  });

  useEffect(() => {
    let cancelled = false;
    void fetchPublicWebinar(STAR_INITIATION_WEBINAR_EVENT_ID).then((next) => {
      if (!cancelled) setCatalog((current) => ({ ...current, ...next }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const state = await fetchWebinarMe(STAR_INITIATION_WEBINAR_EVENT_ID, token);
        if (cancelled) return;
        setCatalog((current) => ({ ...current, ...state }));
        if (state.joinEligible) {
          setOwned(true);
          if (shouldAutocheckout) {
            navigate(STAR_INITIATION_WEBINAR_THANK_YOU_PATH, { replace: true });
          }
        }
      } catch {
        if (!cancelled) setOwned(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn, navigate, shouldAutocheckout]);

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
        trackCtaClick("adronis_webinar_checkout_started", "star_initiation_autocheckout", {
          eventId: STAR_INITIATION_WEBINAR_EVENT_ID,
        });
        await startWebinarCheckout(STAR_INITIATION_WEBINAR_EVENT_ID, { token });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to open Stripe checkout.";
        if (/already been purchased|already been paid/i.test(message)) {
          navigate(STAR_INITIATION_WEBINAR_THANK_YOU_PATH, { replace: true });
          return;
        }
        setError(message);
      }
    })();
  }, [catalog.registrationOpen, getToken, isSignedIn, navigate, owned, searchParams, setSearchParams, shouldAutocheckout]);

  if (!isSignedIn && shouldAutocheckout) {
    const redirectUrl = `${location.pathname}${location.search}${location.hash}` || STAR_INITIATION_WEBINAR_AUTOCHECKOUT_PATH;
    if (isLoaded) {
      return <Navigate to={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`} replace />;
    }
  }

  const seatsLabel = typeof catalog.seatsRemaining === "number"
    ? `${catalog.seatsRemaining} of ${STAR_INITIATION_WEBINAR_MAX_ATTENDEES} seats remaining`
    : `Limited to ${STAR_INITIATION_WEBINAR_MAX_ATTENDEES} attendees`;

  return (
    <div className="relative isolate min-h-full overflow-hidden text-[#F8FAFC]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(24,80,120,0.34),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(43,125,142,0.22),transparent_32%),radial-gradient(circle_at_50%_70%,rgba(80,40,130,0.18),transparent_42%)]"
        aria-hidden="true"
      />
      <section className="relative px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:px-8">
        <div className="relative mx-auto w-full max-w-[76rem] space-y-10">
          <div className="space-y-5">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-[#E5C267]">Live Webinar</p>
            <h1 className="hero-headline max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-[#F8FAFC] sm:text-5xl lg:text-6xl">
              {catalog.title}
            </h1>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#67E8F9]">{catalog.presenter}</p>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <p className="text-2xl font-semibold text-[#F0D78A]">{catalog.displayPrice}</p>
              <p className="pb-0.5 text-base text-[#94A3B8]">{catalog.displayDate}</p>
            </div>
            <p className="text-base text-[#CBD5E1]">{catalog.displayTime} · Live on Zoom</p>
            <p className="inline-flex rounded-full border border-amber-200/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
              {soldOut && !owned ? "Sold out" : seatsLabel}
            </p>

            <div className="space-y-3 pt-2">
              {owned ? (
                <Link to={STAR_INITIATION_WEBINAR_THANK_YOU_PATH} className={CTA_CLASS_NAME}>
                  Access Webinar Registration
                </Link>
              ) : (
                <AdronisWebinarCheckoutButton
                  source="star_initiation_landing"
                  eventId={STAR_INITIATION_WEBINAR_EVENT_ID}
                  title={STAR_INITIATION_WEBINAR_TITLE}
                  autocheckoutPath={STAR_INITIATION_WEBINAR_AUTOCHECKOUT_PATH}
                  thankYouPath={STAR_INITIATION_WEBINAR_THANK_YOU_PATH}
                  owned={owned}
                  registrationOpen={catalog.registrationOpen}
                  onError={setError}
                  className={CTA_CLASS_NAME}
                >
                  {catalog.registrationOpen ? `Register — ${catalog.displayPrice}` : "Registration closed"}
                </AdronisWebinarCheckoutButton>
              )}
              {!owned ? <p className="text-sm text-[#94A3B8]">{PURCHASE_REASSURANCE}</p> : null}
              {error ? <p className="text-sm text-[#F0D78A]">{error}</p> : null}
            </div>
          </div>

          <figure className="overflow-hidden rounded-3xl border border-white/[0.09] bg-[#050a12] shadow-[0_30px_90px_rgba(0,0,0,0.48),0_0_55px_rgba(41,190,220,0.08)]">
            <img
              src={catalog.portraitPosterPath ?? catalog.posterPath}
              alt={catalog.posterAlt}
              width={576}
              height={1024}
              className="mx-auto h-auto w-full max-w-[28rem] object-contain sm:max-w-[32rem]"
              loading="eager"
              decoding="async"
            />
          </figure>

          <div className="glass-card space-y-5 p-6 sm:p-8">
            {(catalog.descriptionParagraphs?.length
              ? catalog.descriptionParagraphs
              : [catalog.description]
            ).map((paragraph) => (
              <p key={paragraph} className="text-base leading-8 text-[#CBD5E1] sm:text-lg">{paragraph}</p>
            ))}
            <ul className="space-y-2 text-sm leading-7 text-[#CBD5E1] sm:text-base">
              {(catalog.featureBullets?.length ? catalog.featureBullets : STAR_INITIATION_WEBINAR_FEATURE_BULLETS).map((bullet) => (
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
