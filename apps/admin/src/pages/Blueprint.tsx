import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import { REPORT_TIER_DEFINITIONS, divin8ReportTierListPrice } from "@wisdom/utils";
import { api } from "../lib/api";
import Loading from "../components/Loading";
import GenerationTab, { type InterpretSuccessPayload } from "../components/GenerationTab";
import ProductTierTab from "../components/ProductTierTab";
import ReportsTab from "../components/ReportsTab";

interface Client {
  id: string;
  full_birth_name: string;
  email: string;
}

type TabId = "generation" | "reports" | "intro" | "deepDive" | "initiate";

export default function Blueprint() {
  const { getToken } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("generation");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [reportTransitionLoading, setReportTransitionLoading] = useState(false);
  const [interpretSeed, setInterpretSeed] = useState<InterpretSuccessPayload | null>(null);
  const reportViewerRef = useRef<HTMLDivElement>(null);

  const scrollAdminMainToTop = useCallback(() => {
    document.getElementById("admin-shell-main")?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadClients() {
      try {
        const token = await getToken();
        const result = await api.get("/clients?limit=100", token);
        if (!cancelled) setClients(result.data);
      } catch (err) {
        console.error("[Blueprint] failed to load clients:", err);
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    }
    loadClients();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const onInterpretationSuccess = useCallback((payload: InterpretSuccessPayload) => {
    setReportTransitionLoading(true);
    setInterpretSeed(payload);
    setSelectedReportId(payload.reportId);
    setActiveTab("reports");
    setListRefreshKey((k) => k + 1);
    requestAnimationFrame(() => {
      scrollAdminMainToTop();
      requestAnimationFrame(() => {
        reportViewerRef.current?.focus({ preventScroll: true });
      });
    });
  }, [scrollAdminMainToTop]);

  useEffect(() => {
    if (activeTab !== "reports") setReportTransitionLoading(false);
  }, [activeTab]);

  const handleReportDetailSettled = useCallback(() => setReportTransitionLoading(false), []);
  const handleInterpretSeedConsumed = useCallback(() => setInterpretSeed(null), []);
  const activeProductTier =
    activeTab === "intro"
      ? REPORT_TIER_DEFINITIONS.intro
      : activeTab === "deepDive"
        ? REPORT_TIER_DEFINITIONS.deep_dive
        : activeTab === "initiate"
          ? REPORT_TIER_DEFINITIONS.initiate
          : null;

  if (loadingClients) return <Loading />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4">
        <h2 className="text-2xl font-bold text-white">Divin8 Engine</h2>
        <p className="mt-1 text-white/50">Generate and interpret multi-layered metaphysical insights.</p>
      </div>

      <div className="shrink-0 flex flex-wrap gap-6 border-b border-white/10 pb-1">
        <div className="flex gap-2">
          {[
            ["generation", "Generation"],
            ["reports", "Reports"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as TabId)}
              className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === id ? "text-accent-violet" : "text-white/60 hover:text-white/80"
              }`}
            >
              {label}
              {activeTab === id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-violet"
                />
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(
            [
              ["intro", "Introductory", "intro"],
              ["deepDive", "Deep Dive", "deep_dive"],
              ["initiate", "Initiate", "initiate"],
            ] as const
          ).map(([id, label, tierKey]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id as TabId)}
              className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === id ? "text-accent-violet" : "text-white/60 hover:text-white/80"
              }`}
            >
              <span className="block">{label}</span>
              <span className="mt-0.5 block text-xs font-normal text-white/40">
                {divin8ReportTierListPrice(tierKey)}
              </span>
              {activeTab === id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-violet"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 pt-6">
        <div className={activeTab === "generation" ? "block" : "hidden"}>
          <GenerationTab clients={clients} onInterpretationSuccess={onInterpretationSuccess} />
        </div>
        {activeProductTier && (
          <ProductTierTab
            clients={clients}
            tierDefinition={activeProductTier}
            onInterpretationSuccess={onInterpretationSuccess}
          />
        )}
        {activeTab === "reports" && (
          <>
            {reportTransitionLoading && (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-accent-violet/25 bg-accent-violet/10 px-4 py-3 text-sm text-white/80">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-accent-violet" />
                Opening report…
              </div>
            )}
            <ReportsTab
              selectedReportId={selectedReportId}
              onSelectReport={setSelectedReportId}
              listRefreshKey={listRefreshKey}
              viewerRef={reportViewerRef}
              interpretSeed={interpretSeed}
              onInterpretSeedConsumed={handleInterpretSeedConsumed}
              onReportDetailSettled={handleReportDetailSettled}
            />
          </>
        )}
      </div>
    </div>
  );
}
