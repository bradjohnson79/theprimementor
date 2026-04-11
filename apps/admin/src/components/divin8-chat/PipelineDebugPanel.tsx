import type { Divin8ChatMeta } from "@wisdom/ui/divin8-chat";
import { classNames } from "@wisdom/ui/divin8-chat";

type StageValue = boolean | "SKIPPED" | "SUCCESS" | "FAIL" | "ASTROLOGY" | "GENERAL" | "RUNNING" | undefined;

function stagePillTone(value: StageValue, isLightTheme: boolean) {
  if (value === true || value === "SUCCESS" || value === "ASTROLOGY") {
    return isLightTheme ? "bg-emerald-100 text-emerald-700" : "bg-emerald-500/15 text-emerald-200";
  }
  if (value === false || value === "FAIL") {
    return isLightTheme ? "bg-rose-100 text-rose-700" : "bg-rose-500/15 text-rose-200";
  }
  if (value === "SKIPPED" || value === "GENERAL") {
    return isLightTheme ? "bg-slate-100 text-slate-700" : "bg-white/10 text-white/70";
  }
  if (value === "RUNNING") {
    return isLightTheme ? "bg-amber-100 text-amber-700" : "bg-amber-500/15 text-amber-200";
  }
  return isLightTheme ? "bg-slate-100 text-slate-500" : "bg-white/5 text-white/50";
}

function formatConfidence(confidence: number | undefined) {
  if (typeof confidence !== "number") {
    return null;
  }
  return `${Math.round(confidence * 100)}%`;
}

function stageLabel(
  value: StageValue,
  pendingLabel: string,
  isRunning: boolean,
): string {
  if (value === undefined || value === null) {
    return isRunning ? "RUNNING" : pendingLabel;
  }
  if (value === true) return "YES";
  if (value === false) return "NO";
  return String(value);
}

interface PipelineDebugPanelProps {
  meta: Divin8ChatMeta | null;
  isLightTheme: boolean;
  title?: string;
}

export default function PipelineDebugPanel({
  meta,
  isLightTheme,
  title = "Pipeline Debug",
}: PipelineDebugPanelProps) {
  const isRunning = meta?.pipelineStatus === "running";
  const noData = !meta;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-accent-cyan">{title}</p>
          <p className={classNames("mt-1 text-xs", isLightTheme ? "text-slate-500" : "text-white/50")}>
            {meta?.systemDecision ?? (noData ? "No pipeline data yet" : "System: Pending / Engine: Pending")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className={classNames(
              "inline-block h-2 w-2 rounded-full animate-pulse",
              isLightTheme ? "bg-amber-500" : "bg-amber-400",
            )} />
          )}
          {formatConfidence(meta?.routeConfidence) ? (
            <span
              className={classNames(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                isLightTheme ? "bg-slate-100 text-slate-600" : "bg-white/10 text-white/70",
              )}
            >
              {formatConfidence(meta?.routeConfidence)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        {([
          ["Input Received", meta?.stages?.inputReceived, "WAITING"],
          ["Routed", meta?.stages?.routed, "WAITING"],
          ["Engine Required", meta?.stages?.engineRequired, "WAITING"],
          ["Engine Run", meta?.stages?.engineRun, "WAITING"],
          ["Response Sent", meta?.stages?.responseSent, "WAITING"],
        ] as [string, StageValue, string][]).map(([label, value, pending]) => {
          const display = stageLabel(value, noData ? "—" : pending, isRunning);
          const toneValue: StageValue = display === "RUNNING" ? "RUNNING" : value;
          return (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className={isLightTheme ? "text-slate-600" : "text-white/65"}>{label}</span>
              <span className={classNames(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                stagePillTone(toneValue, isLightTheme),
              )}>
                {display}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
