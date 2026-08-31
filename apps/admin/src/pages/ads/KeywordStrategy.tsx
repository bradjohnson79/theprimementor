import { useAuth } from "@clerk/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdsAgent } from "../../context/AdsAgentProvider";
import { useAdminSettings } from "../../context/AdminSettingsContext";
import { api } from "../../lib/api";
import { unwrapData } from "./adsApi";
import { adsCardClass, adsMutedClass, adsTitleClass } from "./adsTheme";
import { setPmaAgentFilters } from "./pmaAgentContext";

type PmaWorkspace = {
  project: { id: string; slug: string; name: string };
  analysis: {
    id: string;
    status: string;
    stage: string | null;
    seeds: string[];
    payload: {
      clusters: Array<{
        id: string;
        name: string;
        termCount: number;
        terms: string[];
        intent: string;
        relevanceLabel: string;
        opportunityScore: number;
        behaviorLabel: string;
        treatment: string;
        treatmentReason: string;
      }>;
      candidates: Array<{
        term: string;
        intent: string;
        intentReason: string;
        intentScore: number;
        relevanceLabel: string;
        relevanceReason: string;
        opportunityScore: number;
        opportunityReason: string;
      }>;
      negatives: Array<{
        term: string;
        reason: string;
        confidence: string;
        evidence: string;
        action: string;
      }>;
      behavior: {
        status: string;
        warning: string | null;
        ctaClicks: number | null;
        purchases: number | null;
        bounceRate: number | null;
        reportsPath: { path: string; visitors: number; bounceRate: number } | null;
        note: string;
      };
      campaignIdeas: Array<{ name: string; strategy: string; landingPage: string }>;
      scoringWeights: { note: string };
      providers: { googleAds: string; umami: string };
    };
    error: string | null;
  } | null;
};

const TABS = ["Discover", "Clusters", "Buyer Intent", "Opportunities", "Negatives", "Campaign Builder", "Behavior"] as const;

export default function AdsKeywordStrategy() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const agent = useAdsAgent();
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const [workspace, setWorkspace] = useState<PmaWorkspace | null>(null);
  const [seeds, setSeeds] = useState("detailed birth chart report");
  const [csvText, setCsvText] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Discover");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  async function load() {
    const token = await getToken();
    const next = unwrapData<PmaWorkspace>(await api.get("/admin/ads/pma/workspace?project=divin8-reports", token));
    setWorkspace(next);
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load PMA"));
  }, [getToken]);

  useEffect(() => {
    if (!workspace) return;
    setPmaAgentFilters({
      pmaProjectId: workspace.project.id,
      ...(selectedClusterId ? { pmaClusterId: selectedClusterId } : {}),
    });
  }, [workspace, selectedClusterId]);

  async function discover() {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const next = unwrapData<PmaWorkspace>(await api.post("/admin/ads/pma/analyze", {
        project: "divin8-reports",
        seedsText: seeds,
        csvText: csvText || undefined,
        includeCatalog: true,
      }, token));
      setWorkspace(next);
      setTab("Clusters");
      const top = next.analysis?.payload.clusters[0]?.id;
      if (top) {
        setSelectedClusterId(top);
        setPmaAgentFilters({ pmaProjectId: next.project.id, pmaClusterId: top });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  async function buildFromCluster(clusterId: string) {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      await api.post("/admin/ads/pma/campaigns", { project: "divin8-reports", clusterId }, token);
      navigate("/admin/ads/campaign-lab");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create proposal");
    } finally {
      setBusy(false);
    }
  }

  const payload = workspace?.analysis?.payload;
  const selected = payload?.clusters.find((cluster) => cluster.id === selectedClusterId) ?? payload?.clusters[0];
  const topIntent = useMemo(() => payload?.candidates.slice().sort((a, b) => b.intentScore - a.intentScore)[0], [payload]);

  return (
    <div data-ads-keyword-strategy className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent-cyan">PMA Keyword Strategy</p>
        <h1 className={`mt-2 text-3xl font-semibold ${adsTitleClass(isLightTheme)}`}>Keyword Strategy</h1>
        <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>
          What are you advertising? <span className="text-accent-cyan">Divin8 Reports</span>
        </p>
      </div>

      <section className={adsCardClass(isLightTheme)}>
        <label className={`text-sm ${adsMutedClass(isLightTheme)}`} htmlFor="pma-seeds">Seeds — one per line</label>
        <textarea
          id="pma-seeds"
          value={seeds}
          onChange={(event) => setSeeds(event.target.value)}
          rows={4}
          className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm ${isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-white/5"}`}
        />
        <label className={`mt-3 block text-sm ${adsMutedClass(isLightTheme)}`} htmlFor="pma-csv">Optional CSV with a keyword column</label>
        <textarea
          id="pma-csv"
          value={csvText}
          onChange={(event) => setCsvText(event.target.value)}
          rows={3}
          placeholder="keyword,impressions,clicks"
          className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm ${isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-white/5"}`}
        />
        <button
          type="button"
          onClick={() => void discover()}
          disabled={busy}
          className="mt-4 rounded-lg bg-accent-cyan/20 px-4 py-2 text-sm font-medium text-accent-cyan disabled:opacity-40"
        >
          {busy ? workspace?.analysis?.stage || "Discovering terms" : "Discover Opportunities"}
        </button>
        {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InsightCard theme={isLightTheme} title="Top Opportunity Clusters" body={payload?.clusters.slice(0, 3).map((cluster) => cluster.name).join(" · ") || "Run discovery to see clusters."} />
        <InsightCard theme={isLightTheme} title="Highest Buyer Intent" body={topIntent ? `${topIntent.term} · ${topIntent.intent.replaceAll("_", " ")}` : "Unknown until analysis."} />
        <InsightCard theme={isLightTheme} title="Negative Candidates" body={payload?.negatives.filter((item) => item.action === "Test exclude").map((item) => item.term).join(", ") || "None recommended yet."} />
        <InsightCard theme={isLightTheme} title="Behavior Signals" body={payload?.behavior.reportsPath ? `${payload.behavior.reportsPath.path} · bounce ${payload.behavior.reportsPath.bounceRate}% · CTA ${payload.behavior.ctaClicks ?? 0}` : payload?.behavior.warning || "Umani has no matching /reports signal yet."} />
        <InsightCard theme={isLightTheme} title="Campaign Ideas" body={payload?.campaignIdeas[0]?.name || "Build from a strong cluster."} />
        <InsightCard theme={isLightTheme} title="Data honesty" body={payload?.scoringWeights.note || "Search volume and CPC stay unknown without an authoritative source."} />
      </section>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-full border px-3 py-1 text-xs ${tab === item ? "border-accent-cyan text-accent-cyan" : isLightTheme ? "border-slate-200 text-slate-600" : "border-white/10 text-white/70"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Clusters" || tab === "Opportunities" || tab === "Campaign Builder" ? (
        <section className={adsCardClass(isLightTheme)}>
          {(payload?.clusters ?? []).map((cluster) => (
            <div key={cluster.id} className="mb-4 border-b border-white/10 pb-4 last:mb-0 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className={`text-lg font-semibold ${adsTitleClass(isLightTheme)}`}>{cluster.name}</h3>
                  <p className={`text-sm ${adsMutedClass(isLightTheme)}`}>
                    {cluster.termCount} terms · {cluster.intent.replaceAll("_", " ")} · Divin8 {cluster.relevanceLabel} · Opportunity {cluster.opportunityScore} · {cluster.behaviorLabel}
                  </p>
                  <p className={`mt-1 text-sm ${adsMutedClass(isLightTheme)}`}>{cluster.treatment}: {cluster.treatmentReason}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClusterId(cluster.id);
                    setPmaAgentFilters({ pmaProjectId: workspace?.project.id ?? "", pmaClusterId: cluster.id });
                    void buildFromCluster(cluster.id);
                  }}
                  className="rounded-lg border border-accent-cyan/30 px-3 py-1.5 text-sm text-accent-cyan"
                >
                  Build Campaign from Cluster
                </button>
              </div>
            </div>
          ))}
          {!payload?.clusters.length ? <p className={adsMutedClass(isLightTheme)}>No clusters yet.</p> : null}
        </section>
      ) : null}

      {tab === "Buyer Intent" || tab === "Discover" ? (
        <section className={adsCardClass(isLightTheme)}>
          {(payload?.candidates ?? []).slice(0, 20).map((candidate) => (
            <p key={candidate.term} className={`mb-2 text-sm ${adsMutedClass(isLightTheme)}`}>
              <span className={adsTitleClass(isLightTheme)}>{candidate.term}</span>
              {" · "}{candidate.intent.replaceAll("_", " ")} ({candidate.intentScore}) · {candidate.relevanceLabel} · {candidate.opportunityScore}
              <span className="block">{candidate.intentReason} {candidate.opportunityReason}</span>
            </p>
          ))}
          {!payload ? <p className={adsMutedClass(isLightTheme)}>Discover opportunities to classify intent.</p> : null}
        </section>
      ) : null}

      {tab === "Negatives" ? (
        <section className={adsCardClass(isLightTheme)}>
          {(payload?.negatives ?? []).map((item) => (
            <p key={item.term} className={`mb-3 text-sm ${adsMutedClass(isLightTheme)}`}>
              <span className={adsTitleClass(isLightTheme)}>{item.term}</span> · {item.action} · {item.confidence}
              <span className="block">{item.reason} {item.evidence}</span>
            </p>
          ))}
        </section>
      ) : null}

      {tab === "Behavior" ? (
        <section className={adsCardClass(isLightTheme)}>
          <p className={adsMutedClass(isLightTheme)}>{payload?.behavior.note}</p>
          <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>
            Status {payload?.behavior.status || "unavailable"} · CTA {payload?.behavior.ctaClicks ?? "unknown"} · Purchases {payload?.behavior.purchases ?? "unknown"}
          </p>
          {payload?.behavior.warning ? <p className="mt-2 text-sm text-rose-400">{payload.behavior.warning}</p> : null}
          {selected ? (
            <button type="button" className="mt-4 text-sm text-accent-cyan" onClick={() => void agent.sendMessage(`Why is the ${selected.name} cluster strategically valuable for Divin8?`)}>
              Ask Ads Agent about this cluster
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function InsightCard({ theme, title, body }: { theme: boolean; title: string; body: string }) {
  return (
    <div className={adsCardClass(theme)}>
      <p className="text-xs uppercase tracking-[0.18em] text-accent-cyan">{title}</p>
      <p className={`mt-2 text-sm ${adsMutedClass(theme)}`}>{body}</p>
    </div>
  );
}
