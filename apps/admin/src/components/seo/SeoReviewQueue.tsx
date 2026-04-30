import { useMemo, useState } from "react";
import SeoSectionCard from "./SeoSectionCard";
import type { SeoKeywordBuckets, SeoRecommendation } from "./types";
import { classNames, displaySeoValue } from "./utils";

function parseKeywordLines(value: string) {
  return Array.from(new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  ));
}

function confidenceWidth(score: number) {
  return `${Math.max(0, Math.min(100, score))}%`;
}

export default function SeoReviewQueue({
  isLightTheme,
  recommendations,
  actingRecommendationId,
  onApprove,
  onReject,
  onEdit,
}: {
  isLightTheme: boolean;
  recommendations: SeoRecommendation[];
  actingRecommendationId: string | null;
  onApprove: (recommendation: SeoRecommendation) => void;
  onReject: (recommendation: SeoRecommendation) => void;
  onEdit: (recommendation: SeoRecommendation, value: unknown) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftBoolean, setDraftBoolean] = useState(true);
  const [draftKeywords, setDraftKeywords] = useState<SeoKeywordBuckets>({ primary: [], secondary: [] });

  const grouped = useMemo(() => {
    return recommendations.reduce<Record<string, SeoRecommendation[]>>((acc, recommendation) => {
      acc[recommendation.pageKey] = [...(acc[recommendation.pageKey] ?? []), recommendation];
      return acc;
    }, {});
  }, [recommendations]);

  function startEditing(recommendation: SeoRecommendation) {
    setEditingId(recommendation.id);
    if (recommendation.field === "indexing") {
      setDraftBoolean(Boolean(recommendation.suggestedValue));
      return;
    }
    if (recommendation.field === "keywords") {
      const next = recommendation.suggestedValue as SeoKeywordBuckets | null;
      setDraftKeywords(next ?? { primary: [], secondary: [] });
      return;
    }
    setDraftText(typeof recommendation.suggestedValue === "string" ? recommendation.suggestedValue : "");
  }

  function submitEdit(recommendation: SeoRecommendation) {
    if (recommendation.field === "indexing") {
      onEdit(recommendation, draftBoolean);
    } else if (recommendation.field === "keywords") {
      onEdit(recommendation, draftKeywords);
    } else {
      onEdit(recommendation, draftText);
    }
    setEditingId(null);
  }

  return (
    <SeoSectionCard title="SEO Opportunities" eyebrow="AI Review Queue" isLightTheme={isLightTheme}>
      <div className="space-y-5">
        {Object.keys(grouped).length === 0 ? (
          <p className="text-sm opacity-70">No queued recommendations yet. Run an audit to generate reviewable AI output.</p>
        ) : Object.entries(grouped).map(([pageKey, pageRecommendations]) => (
          <div key={pageKey} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold capitalize">{pageKey.replaceAll("_", " ")}</h3>
              <span className="text-xs uppercase tracking-[0.18em] opacity-60">{pageRecommendations.length} items</span>
            </div>
            {pageRecommendations.map((recommendation) => {
              const isEditing = editingId === recommendation.id;
              const isActing = actingRecommendationId === recommendation.id;
              return (
                <div
                  key={recommendation.id}
                  className={classNames(
                    "rounded-3xl border p-5",
                    isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold uppercase tracking-[0.16em] opacity-70">{recommendation.field ?? "metadata"}</span>
                    <span
                      className={classNames(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                        recommendation.impact === "high"
                          ? "bg-rose-500/15 text-rose-300"
                          : recommendation.impact === "medium"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-cyan-500/15 text-cyan-300",
                      )}
                    >
                      {recommendation.impact ?? "low"}
                    </span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
                      {recommendation.expectedImpact ?? "impact pending"}
                    </span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
                      {recommendation.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] opacity-70">Current Value</p>
                      <pre className="whitespace-pre-wrap rounded-2xl border border-inherit bg-black/10 p-3 text-sm">{displaySeoValue(recommendation.currentValue)}</pre>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] opacity-70">Suggested Value</p>
                      <pre className="whitespace-pre-wrap rounded-2xl border border-inherit bg-black/10 p-3 text-sm">{displaySeoValue(recommendation.suggestedValue)}</pre>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-70">Reasoning</p>
                      <p className="mt-2 text-sm opacity-85">{recommendation.reasoning ?? "No reasoning provided."}</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] opacity-70">
                        <span>Confidence</span>
                        <span>{recommendation.confidenceScore}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white/10">
                        <div className="h-2 rounded-full bg-accent-cyan" style={{ width: confidenceWidth(recommendation.confidenceScore) }} />
                      </div>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="mt-4 rounded-2xl border border-inherit bg-black/10 p-4">
                      {recommendation.field === "indexing" ? (
                        <label className="flex items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            checked={draftBoolean}
                            onChange={(event) => setDraftBoolean(event.target.checked)}
                          />
                          Allow indexing
                        </label>
                      ) : recommendation.field === "keywords" ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="block">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] opacity-70">Primary Keywords</span>
                            <textarea
                              value={draftKeywords.primary.join(", ")}
                              onChange={(event) => setDraftKeywords((current) => ({
                                ...current,
                                primary: parseKeywordLines(event.target.value),
                              }))}
                              rows={4}
                              className={classNames(
                                "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors",
                                isLightTheme ? "border-slate-200 bg-white text-slate-900" : "border-white/10 bg-slate-950/40 text-white",
                              )}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] opacity-70">Secondary Keywords</span>
                            <textarea
                              value={draftKeywords.secondary.join(", ")}
                              onChange={(event) => setDraftKeywords((current) => ({
                                ...current,
                                secondary: parseKeywordLines(event.target.value),
                              }))}
                              rows={4}
                              className={classNames(
                                "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors",
                                isLightTheme ? "border-slate-200 bg-white text-slate-900" : "border-white/10 bg-slate-950/40 text-white",
                              )}
                            />
                          </label>
                        </div>
                      ) : (
                        <textarea
                          value={draftText}
                          onChange={(event) => setDraftText(event.target.value)}
                          rows={recommendation.field === "meta_description" ? 4 : 2}
                          className={classNames(
                            "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors",
                            isLightTheme ? "border-slate-200 bg-white text-slate-900" : "border-white/10 bg-slate-950/40 text-white",
                          )}
                        />
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => submitEdit(recommendation)}
                          disabled={isActing}
                          className="rounded-2xl bg-accent-cyan px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Apply Edited Value
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-2xl border border-inherit px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {recommendation.status === "pending" ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onApprove(recommendation)}
                        disabled={isActing}
                        className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditing(recommendation)}
                        disabled={isActing}
                        className="rounded-2xl border border-inherit px-4 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(recommendation)}
                        disabled={isActing}
                        className="rounded-2xl bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </SeoSectionCard>
  );
}
