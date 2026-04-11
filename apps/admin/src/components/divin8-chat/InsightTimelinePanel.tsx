import { useState } from "react";
import { formatPacificTimeCompact } from "@wisdom/utils";
import { useI18n } from "../../i18n";
import type { Divin8TimelineEvent } from "@wisdom/ui/divin8-chat";
import { classNames } from "@wisdom/ui/divin8-chat";

function eventTone(type: Divin8TimelineEvent["type"]) {
  switch (type) {
    case "engine":
      return "text-accent-cyan";
    case "insight":
      return "text-emerald-400";
    default:
      return "text-amber-400";
  }
}

function formatEventDate(createdAt: string) {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return "Recent";
  }
  return formatPacificTimeCompact(createdAt);
}

interface InsightTimelinePanelProps {
  isLightTheme: boolean;
  events: Divin8TimelineEvent[];
}

export default function InsightTimelinePanel({ isLightTheme, events }: InsightTimelinePanelProps) {
  const { t } = useI18n();
  const safeEvents = Array.isArray(events) ? events : [];
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-accent-cyan">{t("divin8.timeline.title")}</p>
        <p className={classNames("mt-1 text-xs leading-5", isLightTheme ? "text-slate-500" : "text-white/55")}>
          {t("divin8.timeline.subtitle")}
        </p>
      </div>

      {safeEvents.length === 0 ? (
        <p className={classNames("text-sm", isLightTheme ? "text-slate-500" : "text-white/55")}>
          {t("divin8.timeline.empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {safeEvents.map((event) => {
            const systemsUsed = Array.isArray(event.systemsUsed) ? event.systemsUsed : [];
            const tags = Array.isArray(event.tags) ? event.tags : [];
            const isExpanded = expandedEventId === event.id;
            const summary = event.summary.length > 120 && !isExpanded
              ? `${event.summary.slice(0, 117)}...`
              : event.summary;
            return (
              <div
                key={event.id}
                className={classNames(
                  "rounded-xl border p-3",
                  isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/[0.04]",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={classNames("text-[10px] font-semibold uppercase tracking-[0.18em]", eventTone(event.type))}>
                    {t(`divin8.timeline.type.${event.type}`)}
                  </span>
                  <span className={classNames("text-[10px]", isLightTheme ? "text-slate-400" : "text-white/35")}>
                    {formatEventDate(event.createdAt)}
                  </span>
                </div>

                <p className={classNames("mt-1.5 text-sm leading-5", isLightTheme ? "text-slate-700" : "text-white/70")}>
                  {summary}
                </p>

                {event.summary.length > 120 ? (
                  <button
                    type="button"
                    onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                    className={classNames(
                      "mt-1.5 text-[11px] font-medium",
                      isLightTheme ? "text-slate-500" : "text-white/55",
                    )}
                  >
                    {isExpanded ? "Show less" : "Show more"}
                  </button>
                ) : null}

                {systemsUsed.length > 0 || tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                    {systemsUsed.map((system) => (
                      <span
                        key={`${event.id}-${system}`}
                        className={classNames(
                          "rounded-full px-1.5 py-0.5",
                          isLightTheme ? "bg-white text-slate-600" : "bg-white/10 text-white/70",
                        )}
                      >
                        {system}
                      </span>
                    ))}
                    {tags.map((tag) => (
                      <span
                        key={`${event.id}-${tag}`}
                        className={classNames(
                          "rounded-full px-1.5 py-0.5",
                          isLightTheme ? "bg-slate-200 text-slate-600" : "bg-white/5 text-white/55",
                        )}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
