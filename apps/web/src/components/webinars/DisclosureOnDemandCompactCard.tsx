import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import {
  ADRONIS_ON_DEMAND_WEBINAR_ID,
  getOnDemandWebinarById,
  getOnDemandWebinarPublicCatalog,
} from "@wisdom/utils";
import { trackEvent } from "../../lib/analytics";
import { fetchOnDemandWebinarMe, fetchPublicOnDemandWebinar } from "../../lib/onDemandWebinarApi";
import OnDemandWebinarCheckoutButton from "./OnDemandWebinarCheckoutButton";

export default function DisclosureOnDemandCompactCard() {
  const { isSignedIn, getToken } = useAuth();
  const fallback = getOnDemandWebinarById(ADRONIS_ON_DEMAND_WEBINAR_ID);
  const [catalog, setCatalog] = useState(() => (
    fallback
      ? getOnDemandWebinarPublicCatalog(fallback, { assetReady: false, playbackProtected: false })
      : null
  ));
  const [owned, setOwned] = useState(false);

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

  if (!catalog?.published) return null;

  return (
    <section aria-labelledby="disclosure-on-demand-compact-heading" className="px-4 pb-8 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:p-5">
        <img
          src={catalog.posterPath}
          alt={catalog.posterAlt}
          width={160}
          height={90}
          className="h-24 w-full rounded-2xl object-cover object-center sm:h-20 sm:w-36"
          loading="lazy"
          decoding="async"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-amber-100/70">Available On Demand</p>
          <h2 id="disclosure-on-demand-compact-heading" className="text-lg font-semibold text-white">{catalog.title}</h2>
          <p className="text-sm text-white/60">{catalog.displayPrice}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            to={catalog.checkoutPath}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            onClick={() => trackEvent("webinar_learn_more_clicked", {
              webinar_id: ADRONIS_ON_DEMAND_WEBINAR_ID,
              webinar_type: "on_demand_recording",
              placement: "homepage_compact",
              price_cents: catalog.priceCents,
              currency: catalog.currency,
            })}
          >
            Learn More
          </Link>
          <OnDemandWebinarCheckoutButton
            source="home_disclosure_on_demand_compact"
            owned={owned}
            saleable={catalog.saleable}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {owned ? "Watch in Dashboard" : "Purchase — $7.99 CAD"}
          </OnDemandWebinarCheckoutButton>
        </div>
      </div>
    </section>
  );
}
