import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import { Clapperboard } from "lucide-react";
import { fetchOnDemandWebinarLibrary, type OnDemandWebinarState } from "../lib/onDemandWebinarApi";
import OnDemandWebinarCheckoutButton from "../components/webinars/OnDemandWebinarCheckoutButton";

type LibraryTab = "mine" | "explore";

function WebinarCard({
  webinar,
  owned,
}: {
  webinar: OnDemandWebinarState;
  owned: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
      <img
        src={webinar.posterPath}
        alt={webinar.posterAlt}
        className="mx-auto h-auto w-full max-h-[22rem] object-contain bg-slate-950"
      />
      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/70">
            {owned ? "Purchased" : webinar.displayPrice}
          </p>
          <h2 className="text-xl font-semibold text-white">{webinar.title}</h2>
          <p className="text-sm leading-6 text-white/65">{webinar.description}</p>
          <p className="text-xs text-white/45">{webinar.displayDuration} recording</p>
        </div>
        {owned ? (
          <Link
            to={webinar.playerPath}
            className="inline-flex w-full items-center justify-center rounded-full bg-amber-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
          >
            Watch Now
          </Link>
        ) : (
          <OnDemandWebinarCheckoutButton
            source="dashboard_webinars_explore"
            webinarId={webinar.webinarId}
            saleable={webinar.saleable}
            className="inline-flex w-full items-center justify-center rounded-full bg-amber-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          />
        )}
      </div>
    </article>
  );
}

export default function DashboardWebinars() {
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") === "explore" ? "explore" : "mine";
  const [tab, setTab] = useState<LibraryTab>(requestedTab);
  const [loading, setLoading] = useState(true);
  const [library, setLibrary] = useState<{ owned: OnDemandWebinarState[]; explore: OnDemandWebinarState[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const next = await fetchOnDemandWebinarLibrary(token);
        if (!cancelled) setLibrary(next);
      } catch {
        if (!cancelled) setLibrary({ owned: [], explore: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const owned = library?.owned ?? [];
  const explore = useMemo(
    () => (library?.explore ?? []).filter((entry) => !entry.owned),
    [library],
  );

  function selectTab(next: LibraryTab) {
    setTab(next);
    setSearchParams(next === "explore" ? { tab: "explore" } : {}, { replace: true });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="dashboard-shell"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="dashboard-panel">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-100">
              <Clapperboard className="h-5 w-5" strokeWidth={1.8} aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/60">Webinars</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Watch on demand inside your dashboard</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/65 sm:text-base">
                Keep purchased recordings here, then explore new webinars as they are published.
              </p>
            </div>
          </div>
        </section>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => selectTab("mine")}
            className={`rounded-full px-4 py-2 text-sm ${tab === "mine" ? "bg-white/10 text-white" : "text-white/55 hover:text-white"}`}
          >
            My Webinars
          </button>
          <button
            type="button"
            onClick={() => selectTab("explore")}
            className={`rounded-full px-4 py-2 text-sm ${tab === "explore" ? "bg-white/10 text-white" : "text-white/55 hover:text-white"}`}
          >
            Explore Webinars
          </button>
        </div>

        {loading ? (
          <section className="dashboard-panel text-sm text-white/60">Loading webinars...</section>
        ) : tab === "mine" && owned.length === 0 ? (
          <section className="dashboard-panel space-y-3">
            <h2 className="text-lg font-semibold text-white">No webinars yet</h2>
            <p className="text-sm text-white/60">When you purchase an on-demand webinar, it will appear here.</p>
            <button type="button" onClick={() => selectTab("explore")} className="text-sm text-amber-200 underline">
              Explore Webinars
            </button>
          </section>
        ) : tab === "explore" && explore.length === 0 ? (
          <section className="dashboard-panel text-sm text-white/60">
            You already own every published on-demand webinar.
          </section>
        ) : (
          <section className="grid gap-5 lg:grid-cols-2">
            {(tab === "mine" ? owned : explore).map((webinar) => (
              <WebinarCard key={webinar.webinarId} webinar={webinar} owned={tab === "mine"} />
            ))}
          </section>
        )}
      </div>
    </motion.div>
  );
}
