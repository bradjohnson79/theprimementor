import { useAuth } from "@clerk/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminSettings } from "../../context/AdminSettingsContext";
import { api } from "../../lib/api";
import { unwrapData } from "./adsApi";
import { adsCardClass, adsMutedClass, adsTitleClass } from "./adsTheme";

type Proposal = {
  id: string;
  status: string;
  objective: string | null;
  landingPage: string | null;
  strategyNotes: string | null;
  experimentHypothesis: string | null;
  payload: {
    name?: string;
    adGroups?: Array<{ name: string; rationale: string; keywords: string[] }>;
    exactKeywords?: string[];
    phraseKeywords?: string[];
    expansionKeywords?: string[];
    negatives?: string[];
    headlines?: string[];
    descriptions?: string[];
    congruenceNotes?: string;
    priority?: { impact?: string; confidence?: string; effort?: string; risk?: string };
    experiment?: { hypothesis: string; primaryMetric: string };
  };
};

export default function AdsCampaignLab() {
  const { getToken } = useAuth();
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getToken()
      .then((token) => api.get("/admin/ads/pma/campaigns", token))
      .then((response) => setProposals(unwrapData<{ proposals: Proposal[] }>(response).proposals))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load proposals"));
  }, [getToken]);

  return (
    <div data-ads-campaign-lab className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent-cyan">Ads</p>
        <h1 className={`mt-2 text-3xl font-semibold ${adsTitleClass(isLightTheme)}`}>Campaign Lab</h1>
        <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>
          Proposal workspace only. No Google Ads writes.
        </p>
      </div>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {!proposals.length ? (
        <section className={adsCardClass(isLightTheme)}>
          <p className={adsMutedClass(isLightTheme)}>
            No proposals yet. Build one from Keyword Strategy.
          </p>
          <Link to="/admin/ads/keyword-strategy" className="mt-3 inline-block text-sm text-accent-cyan">
            Open Keyword Strategy
          </Link>
        </section>
      ) : proposals.map((proposal) => (
        <section key={proposal.id} className={adsCardClass(isLightTheme)}>
          <h2 className={`text-xl font-semibold ${adsTitleClass(isLightTheme)}`}>
            {proposal.payload.name || "Untitled proposal"} · {proposal.status}
          </h2>
          <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>{proposal.objective}</p>
          <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>Landing page: {proposal.landingPage}</p>
          <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>{proposal.strategyNotes}</p>
          <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>
            Experiment: {proposal.experimentHypothesis || proposal.payload.experiment?.hypothesis}
          </p>
          {proposal.payload.exactKeywords?.length ? (
            <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>
              Exact: {proposal.payload.exactKeywords.join(", ")}
            </p>
          ) : null}
          {proposal.payload.phraseKeywords?.length ? (
            <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>
              Phrase: {proposal.payload.phraseKeywords.join(", ")}
            </p>
          ) : null}
          {proposal.payload.negatives?.length ? (
            <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>
              Proposed negatives: {proposal.payload.negatives.join(", ")}
            </p>
          ) : null}
          {proposal.payload.headlines?.length ? (
            <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>
              Headlines: {proposal.payload.headlines.join(" · ")}
            </p>
          ) : null}
          {proposal.payload.descriptions?.length ? (
            <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>
              Descriptions: {proposal.payload.descriptions.join(" ")}
            </p>
          ) : null}
          {proposal.payload.congruenceNotes ? (
            <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>{proposal.payload.congruenceNotes}</p>
          ) : null}
          {proposal.payload.adGroups?.map((group) => (
            <p key={group.name} className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>
              Ad group {group.name}: {group.rationale}
            </p>
          ))}
          {proposal.payload.priority ? (
            <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>
              Priority · impact {proposal.payload.priority.impact} · confidence {proposal.payload.priority.confidence} · effort {proposal.payload.priority.effort} · risk {proposal.payload.priority.risk}
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
