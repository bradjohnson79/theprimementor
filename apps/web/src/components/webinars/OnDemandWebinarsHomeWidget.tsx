import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  formatOnDemandWebinarPrice,
  getOnDemandWebinarPublicCatalog,
  getPrimeAlchemyWebinarPublicCatalog,
  listPublishedOnDemandWebinars,
  PRIME_ALCHEMY_WEBINAR_EVENT_ID,
  type OnDemandWebinarCatalogEntry,
} from "@wisdom/utils";
import { useAuth } from "@clerk/react";
import { trackEventOnce } from "../../lib/analytics";
import { fetchOnDemandWebinarMe, fetchPublicOnDemandWebinar, type OnDemandWebinarPublicCatalog } from "../../lib/onDemandWebinarApi";
import { fetchWebinarMe } from "../../lib/webinarApi";
import AdronisWebinarCheckoutButton from "./AdronisWebinarCheckoutButton";
import OnDemandWebinarCheckoutButton from "./OnDemandWebinarCheckoutButton";

import { PURCHASE_REASSURANCE, REGISTER_REASSURANCE } from "../../lib/purchaseReassurance";
const PURCHASE_NOTE = PURCHASE_REASSURANCE;
const REGISTER_NOTE = REGISTER_REASSURANCE;
const UPCOMING_TAB_ID = "upcoming";

function fallbackCatalog(webinar: OnDemandWebinarCatalogEntry) {
  return getOnDemandWebinarPublicCatalog(webinar, { assetReady: false, playbackProtected: false });
}

function useTabOrientation() {
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const apply = () => setOrientation(query.matches ? "vertical" : "horizontal");
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return orientation;
}

export default function OnDemandWebinarsHomeWidget() {
  const webinars = useMemo(() => listPublishedOnDemandWebinars(), []);
  const upcoming = useMemo(() => getPrimeAlchemyWebinarPublicCatalog(), []);
  const showUpcoming = upcoming.registrationOpen;
  const tabs = useMemo(() => {
    const items: Array<{ id: string; label: string }> = [];
    if (showUpcoming) items.push({ id: UPCOMING_TAB_ID, label: "Upcoming" });
    for (const webinar of webinars) items.push({ id: webinar.webinarId, label: webinar.title });
    return items;
  }, [showUpcoming, webinars]);
  const { isSignedIn, getToken } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeId, setActiveId] = useState(showUpcoming ? UPCOMING_TAB_ID : (webinars[0]?.webinarId ?? ""));
  const [catalogs, setCatalogs] = useState<Record<string, OnDemandWebinarPublicCatalog>>(() => (
    Object.fromEntries(webinars.map((webinar) => [webinar.webinarId, fallbackCatalog(webinar)]))
  ));
  const [ownedById, setOwnedById] = useState<Record<string, boolean>>({});
  const [upcomingOwned, setUpcomingOwned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orientation = useTabOrientation();
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const activeWebinar = webinars.find((webinar) => webinar.webinarId === active?.id) ?? null;
  const catalog = activeWebinar ? catalogs[activeWebinar.webinarId] : null;
  const checkoutCanceled = searchParams.get("webinar") === "canceled"
    && searchParams.get("eventId") === PRIME_ALCHEMY_WEBINAR_EVENT_ID;

  useEffect(() => {
    let cancelled = false;
    void Promise.all(webinars.map(async (webinar) => {
      const next = await fetchPublicOnDemandWebinar(webinar.webinarId);
      return [webinar.webinarId, next] as const;
    })).then((entries) => {
      if (!cancelled) {
        setCatalogs((current) => ({ ...current, ...Object.fromEntries(entries) }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [webinars]);

  useEffect(() => {
    if (!isSignedIn) {
      setOwnedById({});
      setUpcomingOwned(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const entries = await Promise.all(webinars.map(async (webinar) => {
          const state = await fetchOnDemandWebinarMe(webinar.webinarId, token);
          return [webinar.webinarId, state] as const;
        }));
        const upcomingState = showUpcoming
          ? await fetchWebinarMe(PRIME_ALCHEMY_WEBINAR_EVENT_ID, token).catch(() => null)
          : null;
        if (cancelled) return;
        setOwnedById(Object.fromEntries(entries.map(([id, state]) => [id, state.owned])));
        setUpcomingOwned(upcomingState?.joinEligible === true);
        setCatalogs((current) => ({
          ...current,
          ...Object.fromEntries(entries.map(([id, state]) => [id, state])),
        }));
      } catch {
        if (!cancelled) {
          setOwnedById({});
          setUpcomingOwned(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn, showUpcoming, webinars]);

  useEffect(() => {
    if (!activeWebinar?.published) return;
    trackEventOnce(`analytics:on-demand-home:${activeWebinar.webinarId}`, "cta_click", {
      source: "home_on_demand_webinars",
      label: "on_demand_tab_viewed",
      webinarId: activeWebinar.webinarId,
    });
  }, [activeWebinar]);

  if (!active) return null;
  if (active.id !== UPCOMING_TAB_ID && (!activeWebinar || !catalog)) return null;

  function selectTab(nextId: string) {
    setActiveId(nextId);
    setError(null);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = tabs.findIndex((tab) => tab.id === active?.id);
    const lastIndex = tabs.length - 1;
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = lastIndex;
    if (nextIndex === currentIndex) return;
    event.preventDefault();
    const next = tabs[nextIndex];
    if (!next) return;
    setActiveId(next.id);
    setError(null);
    document.getElementById(`${baseId}-tab-${next.id}`)?.focus();
  }

  const owned = activeWebinar ? ownedById[activeWebinar.webinarId] === true : false;
  const priceLabel = catalog ? (catalog.displayPrice || formatOnDemandWebinarPrice(activeWebinar?.priceCents ?? 0, activeWebinar?.currency ?? "CAD")) : "";

  return (
    <section id="on-demand-webinars" className="relative scroll-mt-28 border-t border-white/8 py-12 sm:py-16" aria-labelledby="on-demand-webinars-heading">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-6 max-w-3xl space-y-3">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-100/70">Webinars</p>
          <h2 id="on-demand-webinars-heading" className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Upcoming and on demand
          </h2>
          <p className="text-sm leading-7 text-white/68 sm:text-base">
            Join the next live Mentoring Circle, or watch a recorded Adronis webinar anytime in Dashboard → Webinars.
          </p>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-cyan-200/15 bg-[#070b16]/80 shadow-[0_24px_80px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(125,211,252,0.12)] backdrop-blur-xl">
          <div className="grid lg:grid-cols-[minmax(15rem,0.32fr)_minmax(0,1fr)]">
            <div
              role="tablist"
              aria-label="Webinars"
              aria-orientation={orientation}
              onKeyDown={onTabKeyDown}
              className="flex flex-col gap-2 border-b border-white/10 p-3 lg:border-b-0 lg:border-r lg:p-4"
            >
              {tabs.map((tab) => {
                const selected = tab.id === active.id;
                return (
                  <button
                    key={tab.id}
                    id={`${baseId}-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={panelId}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectTab(tab.id)}
                    className={`flex min-h-14 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition duration-200 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${
                      selected
                        ? "border-cyan-200/50 bg-cyan-300/10 text-white shadow-[inset_0_0_24px_rgba(34,211,238,0.12)]"
                        : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <span className="text-sm font-semibold leading-5">{tab.label}</span>
                    {selected ? <span className="ml-auto hidden h-2 w-2 shrink-0 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(165,243,252,0.8)] lg:inline-block" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>

            <div
              id={panelId}
              role="tabpanel"
              aria-labelledby={`${baseId}-tab-${active.id}`}
              className="p-4 sm:p-6 lg:p-8"
            >
              {active.id === UPCOMING_TAB_ID ? (
                <article className="grid items-start gap-6 overflow-hidden rounded-2xl border border-amber-200/20 bg-white/[0.04] p-4 sm:p-6 lg:grid-cols-[minmax(11rem,16rem)_minmax(0,1fr)]">
                  <img
                    src={upcoming.portraitPosterPath}
                    alt={upcoming.posterAlt}
                    width={900}
                    height={1600}
                    className="mx-auto w-full max-w-[16rem] rounded-2xl object-cover object-center shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
                    loading="eager"
                    decoding="async"
                  />
                  <div className="flex flex-col justify-center space-y-4">
                    <div className="space-y-2">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-amber-100/75">Upcoming Live Event</p>
                      <h3 className="text-2xl font-semibold tracking-[-0.03em] text-white">{upcoming.title}</h3>
                      <p className="text-sm font-medium text-cyan-100/80">{upcoming.displayDate}</p>
                      <p className="text-sm text-white/60">{upcoming.displayTime}</p>
                      {upcoming.descriptionParagraphs.map((paragraph) => (
                        <p key={paragraph} className="text-sm leading-7 text-white/70">{paragraph}</p>
                      ))}
                    </div>
                    <p className="text-lg font-semibold text-amber-100">{upcoming.displayPrice}</p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <AdronisWebinarCheckoutButton
                        source="home_upcoming_webinar"
                        eventId={upcoming.eventId}
                        title={upcoming.title}
                        autocheckoutPath={upcoming.autocheckoutPath}
                        thankYouPath={upcoming.thankYouPath}
                        owned={upcomingOwned}
                        registrationOpen={upcoming.registrationOpen}
                        onError={setError}
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-amber-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                      >
                        {upcomingOwned ? "Access Webinar Registration" : `Register — ${upcoming.displayPrice}`}
                      </AdronisWebinarCheckoutButton>
                      <Link
                        to={upcoming.checkoutPath}
                        className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-cyan-100 underline-offset-4 hover:underline"
                      >
                        Learn More
                      </Link>
                    </div>
                    {upcomingOwned ? null : <p className="text-xs text-white/50">{REGISTER_NOTE}</p>}
                    {checkoutCanceled ? <p className="text-sm text-amber-200">Checkout was canceled. You can register whenever you are ready.</p> : null}
                    {error ? <p className="text-sm text-amber-200">{error}</p> : null}
                  </div>
                </article>
              ) : activeWebinar && catalog ? (
                <article className="grid overflow-hidden rounded-2xl border border-amber-200/20 bg-white/[0.04] lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
                  <div className="aspect-video self-start bg-slate-950">
                    <img
                      src={catalog.landscapePosterPath || catalog.posterPath}
                      alt={catalog.posterAlt}
                      width={1672}
                      height={941}
                      className="h-full w-full object-cover object-center"
                      loading="eager"
                      decoding="async"
                    />
                  </div>
                  <div className="flex flex-col justify-center space-y-4 p-5 sm:p-6">
                    <div className="space-y-2">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-amber-100/75">Available On Demand</p>
                      <h3 className="text-2xl font-semibold tracking-[-0.03em] text-white">{catalog.title}</h3>
                      <p className="text-sm leading-7 text-white/70">{catalog.homeSummary || catalog.description}</p>
                    </div>
                    <p className="text-lg font-semibold text-amber-100">{priceLabel}</p>
                    <OnDemandWebinarCheckoutButton
                      source="home_on_demand_webinars"
                      webinarId={activeWebinar.webinarId}
                      owned={owned}
                      saleable={catalog.saleable}
                      onError={setError}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-amber-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {owned ? "Watch in Dashboard" : `Purchase — ${priceLabel}`}
                    </OnDemandWebinarCheckoutButton>
                    {owned ? null : <p className="text-xs text-white/50">{PURCHASE_NOTE}</p>}
                    {error ? <p className="text-sm text-amber-200">{error}</p> : null}
                  </div>
                </article>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
