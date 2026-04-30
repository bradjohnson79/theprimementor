import SeoSectionCard from "./SeoSectionCard";
import type { SeoAudit, SeoAuditItem } from "./types";
import { classNames, displaySeoValue, formatDate } from "./utils";

export default function SeoAuditResults({
  isLightTheme,
  latestAudit,
  items,
}: {
  isLightTheme: boolean;
  latestAudit: SeoAudit | null;
  items: SeoAuditItem[];
}) {
  return (
    <SeoSectionCard title="Audit Results" eyebrow="Deterministic Findings" isLightTheme={isLightTheme}>
      {latestAudit ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className={classNames("rounded-2xl border px-4 py-3", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
              <p className="text-xs uppercase tracking-[0.18em] opacity-70">Pages Scanned</p>
              <p className="mt-2 text-2xl font-semibold">{latestAudit.summaryJson?.pagesScanned ?? 0}</p>
            </div>
            <div className={classNames("rounded-2xl border px-4 py-3", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
              <p className="text-xs uppercase tracking-[0.18em] opacity-70">Total Issues</p>
              <p className="mt-2 text-2xl font-semibold">{latestAudit.summaryJson?.totalIssues ?? items.length}</p>
            </div>
            <div className={classNames("rounded-2xl border px-4 py-3", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
              <p className="text-xs uppercase tracking-[0.18em] opacity-70">High Severity</p>
              <p className="mt-2 text-2xl font-semibold">{latestAudit.summaryJson?.issuesBySeverity.high ?? 0}</p>
            </div>
            <div className={classNames("rounded-2xl border px-4 py-3", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
              <p className="text-xs uppercase tracking-[0.18em] opacity-70">Completed</p>
              <p className="mt-2 text-sm font-semibold">{formatDate(latestAudit.completedAt ?? latestAudit.updatedAt)}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
              <h3 className="text-sm font-semibold">Pages Affected</h3>
              <div className="mt-4 space-y-2">
                {latestAudit.summaryJson?.pagesAffected?.length ? latestAudit.summaryJson.pagesAffected.map((page) => (
                  <div key={page.pageKey} className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{page.pageKey.replaceAll("_", " ")}</span>
                    <span className="opacity-70">{page.issueCount} issues</span>
                  </div>
                )) : <p className="text-sm opacity-70">No affected pages recorded.</p>}
              </div>
            </div>

            <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
              <h3 className="text-sm font-semibold">Findings</h3>
              <div className="mt-4 max-h-[24rem] space-y-3 overflow-auto pr-2">
                {items.length ? items.map((item) => (
                  <div
                    key={item.id}
                    className={classNames(
                      "rounded-2xl border p-4",
                      isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-slate-950/30",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold capitalize">{item.pageKey.replaceAll("_", " ")}</span>
                      <span
                        className={classNames(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                          item.severity === "high"
                            ? "bg-rose-500/15 text-rose-300"
                            : item.severity === "medium"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-cyan-500/15 text-cyan-300",
                        )}
                      >
                        {item.severity}
                      </span>
                      <span className="text-xs opacity-60">{item.issueType}</span>
                    </div>
                    <p className="mt-3 text-sm opacity-85">{item.description}</p>
                    <div className="mt-3 grid gap-3 text-xs md:grid-cols-2">
                      <div>
                        <p className="mb-1 font-semibold opacity-70">Detected</p>
                        <pre className="whitespace-pre-wrap rounded-xl border border-inherit bg-black/10 p-3">{displaySeoValue(item.detectedValue)}</pre>
                      </div>
                      <div>
                        <p className="mb-1 font-semibold opacity-70">Recommended</p>
                        <pre className="whitespace-pre-wrap rounded-xl border border-inherit bg-black/10 p-3">{displaySeoValue(item.recommendedValue)}</pre>
                      </div>
                    </div>
                  </div>
                )) : <p className="text-sm opacity-70">No audit findings yet.</p>}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm opacity-70">Run an audit to populate deterministic SEO findings.</p>
      )}
    </SeoSectionCard>
  );
}
