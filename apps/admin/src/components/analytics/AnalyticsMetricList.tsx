export interface AnalyticsMetricListItem {
  id: string;
  title: string;
  detail: string;
  metric?: string;
  note?: string | null;
}

interface AnalyticsMetricListProps {
  items: AnalyticsMetricListItem[];
  isLightTheme: boolean;
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function AnalyticsMetricList({ items, isLightTheme }: AnalyticsMetricListProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className={classNames(
            "rounded-2xl border px-4 py-3",
            isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={classNames("font-medium", isLightTheme ? "text-slate-900" : "text-white")}>{item.title}</p>
              <p className={classNames("mt-1 text-xs", isLightTheme ? "text-slate-500" : "text-white/50")}>{item.detail}</p>
              {item.note ? (
                <p className={classNames("mt-2 text-sm leading-6", isLightTheme ? "text-slate-600" : "text-white/60")}>{item.note}</p>
              ) : null}
            </div>
            {item.metric ? (
              <span className={classNames("text-xs font-medium", isLightTheme ? "text-slate-600" : "text-white/70")}>
                {item.metric}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
