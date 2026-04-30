import SeoSectionCard from "./SeoSectionCard";
import type { SeoAudit } from "./types";
import { classNames, formatDate } from "./utils";

export default function SeoHealthHeader({
  isLightTheme,
  latestAudit,
  auditMode,
  onAuditModeChange,
  onRunAudit,
  running,
}: {
  isLightTheme: boolean;
  latestAudit: SeoAudit | null;
  auditMode: "quick" | "full";
  onAuditModeChange: (value: "quick" | "full") => void;
  onRunAudit: () => void;
  running: boolean;
}) {
  const score = latestAudit?.summaryJson?.healthScore ?? null;

  return (
    <SeoSectionCard title="SEO Intelligence" eyebrow="Health Score" isLightTheme={isLightTheme}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-4 sm:grid-cols-3">
          <div
            className={classNames(
              "rounded-2xl border px-5 py-4",
              isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
            )}
          >
            <p className="text-xs uppercase tracking-[0.22em] opacity-70">Global Score</p>
            <p className="mt-3 text-4xl font-semibold">{score ?? "--"}</p>
          </div>
          <div
            className={classNames(
              "rounded-2xl border px-5 py-4",
              isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
            )}
          >
            <p className="text-xs uppercase tracking-[0.22em] opacity-70">Latest Audit</p>
            <p className="mt-3 text-lg font-semibold capitalize">{latestAudit?.status ?? "none"}</p>
            <p className="mt-2 text-xs opacity-70">{formatDate(latestAudit?.createdAt)}</p>
          </div>
          <div
            className={classNames(
              "rounded-2xl border px-5 py-4",
              isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
            )}
          >
            <p className="text-xs uppercase tracking-[0.22em] opacity-70">Score Delta</p>
            <p className="mt-3 text-lg font-semibold">
              {latestAudit?.summaryJson?.delta == null
                ? "--"
                : `${latestAudit.summaryJson.delta >= 0 ? "+" : ""}${latestAudit.summaryJson.delta}`}
            </p>
            <p className="mt-2 text-xs opacity-70">
              Previous: {latestAudit?.summaryJson?.previousScore ?? "--"}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] opacity-70">Audit Mode</span>
            <select
              value={auditMode}
              onChange={(event) => onAuditModeChange(event.target.value as "quick" | "full")}
              className={classNames(
                "rounded-2xl border px-4 py-3 text-sm outline-none transition-colors",
                isLightTheme ? "border-slate-200 bg-white text-slate-900" : "border-white/10 bg-white/5 text-white",
              )}
            >
              <option value="quick">Quick</option>
              <option value="full">Full</option>
            </select>
          </label>
          <button
            type="button"
            onClick={onRunAudit}
            disabled={running}
            className={classNames(
              "rounded-2xl px-5 py-3 text-sm font-semibold transition-colors",
              running
                ? "cursor-not-allowed bg-slate-400/40 text-white/60"
                : "bg-accent-cyan text-slate-950 hover:brightness-110",
            )}
          >
            {running ? "Running Audit..." : "Run Full SEO Audit"}
          </button>
        </div>
      </div>
    </SeoSectionCard>
  );
}
