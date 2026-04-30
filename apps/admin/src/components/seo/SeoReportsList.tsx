import SeoSectionCard from "./SeoSectionCard";
import type { SeoReport } from "./types";
import { classNames, formatDate } from "./utils";

export default function SeoReportsList({
  isLightTheme,
  reports,
  onDownloadPdf,
}: {
  isLightTheme: boolean;
  reports: SeoReport[];
  onDownloadPdf: (report: SeoReport) => void;
}) {
  return (
    <SeoSectionCard title="SEO Reports" eyebrow="Historical Summaries" isLightTheme={isLightTheme}>
      <div className="space-y-3">
        {reports.length ? reports.map((report) => (
          <div
            key={report.id}
            className={classNames(
              "flex flex-col gap-4 rounded-2xl border p-4 lg:flex-row lg:items-center lg:justify-between",
              isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
            )}
          >
            <div className="grid gap-3 sm:grid-cols-4 sm:gap-5">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] opacity-60">Date</p>
                <p className="mt-1 text-sm font-semibold">{formatDate(report.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] opacity-60">Score</p>
                <p className="mt-1 text-sm font-semibold">{report.report?.overview.healthScore ?? report.reportJson?.overview.healthScore ?? "--"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] opacity-60">Pages Scanned</p>
                <p className="mt-1 text-sm font-semibold">{report.report?.overview.pagesScanned ?? report.reportJson?.overview.pagesScanned ?? "--"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] opacity-60">Issues</p>
                <p className="mt-1 text-sm font-semibold">{report.report?.overview.totalIssues ?? report.reportJson?.overview.totalIssues ?? "--"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDownloadPdf(report)}
              className="rounded-2xl bg-accent-cyan px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
            >
              Download PDF
            </button>
          </div>
        )) : (
          <p className="text-sm opacity-70">No reports available yet.</p>
        )}
      </div>
    </SeoSectionCard>
  );
}
