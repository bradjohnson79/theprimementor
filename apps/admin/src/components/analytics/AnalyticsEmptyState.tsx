interface AnalyticsEmptyStateProps {
  message?: string;
  isLightTheme: boolean;
  children?: React.ReactNode;
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function AnalyticsEmptyState({
  message = "No data available for this period.",
  isLightTheme,
  children,
}: AnalyticsEmptyStateProps) {
  return (
    <div
      className={classNames(
        "rounded-2xl border px-4 py-4 text-sm",
        isLightTheme ? "border-slate-200 bg-slate-50 text-slate-600" : "border-white/10 bg-white/5 text-white/60",
      )}
    >
      <p>{message}</p>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
