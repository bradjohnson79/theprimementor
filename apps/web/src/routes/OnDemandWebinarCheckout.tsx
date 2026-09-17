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
const CTA_CLASS_NAME = "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#D7B454] to-[#F2D88A] px-6 py-3 text-sm font-semibold text-[#07111C] shadow-[0_10px_32px_rgba(215,180,84,0.22)] transition hover:-translate-y-px hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

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
  const hasAccess = Boolean(isSignedIn && owned);

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
    if (!isSignedIn) return;
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
    if (!isSignedIn || !shouldAutocheckout || autocheckoutStartedRef.current || hasAccess || !catalog?.saleable) {
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
  }, [catalog?.saleable, getToken, hasAccess, isSignedIn, navigate, searchParams, setSearchParams, shouldAutocheckout]);

  if (canceledCheckout) {
    return <Navigate to={ADRONIS_ON_DEMAND_CANCEL_PATH} replace />;
  }

  if (!catalog) {
    return <div className="mx-auto max-w-3xl px-6 py-16 text-slate-300">Webinar not found.</div>;
  }

  const bullets = catalog.featureBullets.length ? catalog.featureBullets : ADRONIS_ON_DEMAND_FEATURE_BULLETS;
  const ctaLabel = hasAccess ? "Watch Now" : "Watch Now — $7.99 CAD";

  return (
    <div className="relative isolate min-h-full overflow-hidden text-[#F8FAFC]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(24,80,120,0.34),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(43,125,142,0.22),transparent_32%),radial-gradient(circle_at_50%_70%,rgba(80,40,130,0.18),transparent_42%)]"
        aria-hidden="true"
      />
      <section className="relative px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:px-8">
        <div className="relative mx-auto w-full max-w-[76rem]">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-[#E5C267]">On Demand Recording</p>
          <h1 className="hero-headline mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-[#F8FAFC] sm:text-5xl lg:text-6xl">
            {catalog.title}
          </h1>
          <p className="mt-4 text-sm font-medium uppercase tracking-[0.18em] text-[#67E8F9]">{catalog.presenter}</p>
          <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-2">
            <p className="text-2xl font-semibold text-[#F0D78A]">{catalog.displayPrice}</p>
            <p className="pb-0.5 text-base text-[#94A3B8]">{catalog.displayDuration}</p>
          </div>

          <div className="mt-6 space-y-3">
            <OnDemandWebinarCheckoutButton
              source="on_demand_webinar_landing_page"
              owned={hasAccess}
              saleable={catalog.saleable}
              onError={setError}
              className={CTA_CLASS_NAME}
            >
              {ctaLabel}
            </OnDemandWebinarCheckoutButton>
            {hasAccess ? null : (
              <p className="text-sm text-[#94A3B8]">Create an Account or Sign-in to Purchase</p>
            )}
            {error ? <p className="text-sm text-[#F0D78A]">{error}</p> : null}
          </div>

          <figure className="mt-10 overflow-hidden rounded-3xl border border-white/[0.09] bg-[#050a12] shadow-[0_30px_90px_rgba(0,0,0,0.48),0_0_55px_rgba(41,190,220,0.08)]">
            <img
              src={ADRONIS_ON_DEMAND_LANDSCAPE_POSTER_PATH}
              alt={catalog.posterAlt}
              width={1672}
              height={941}
              className="mx-auto h-auto w-full object-contain"
              loading="eager"
              decoding="async"
            />
          </figure>

          <div className="glass-card mt-10 space-y-5 p-6 sm:p-8">
            <p className="text-base leading-8 text-[#CBD5E1] sm:text-lg">
              The recorded Adronis webinar is now available to watch anytime. Brad Johnson channels Adronis on
              humanity’s path from the current phase of disclosure toward global first contact — and what may
              follow in its aftermath.
            </p>
            <p className="text-base leading-8 text-[#CBD5E1]">
              {catalog.description}
            </p>
            <ul className="space-y-2 text-sm leading-7 text-[#CBD5E1] sm:text-base">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E5C267]" aria-hidden />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2">
              <OnDemandWebinarCheckoutButton
                source="on_demand_webinar_landing_page_details"
                owned={hasAccess}
                saleable={catalog.saleable}
                onError={setError}
                className={CTA_CLASS_NAME}
              >
                {ctaLabel}
              </OnDemandWebinarCheckoutButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
