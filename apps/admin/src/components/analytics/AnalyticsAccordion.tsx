interface AnalyticsAccordionProps {
  title: string;
  helperText?: string;
  warning?: string;
  defaultOpen?: boolean;
  isLightTheme: boolean;
  children: React.ReactNode;
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function AnalyticsAccordion({
  title,
  helperText,
  warning,
  defaultOpen = false,
  isLightTheme,
  children,
}: AnalyticsAccordionProps) {
  return (
    <details
      open={defaultOpen}
      className={classNames(
        "group rounded-3xl border shadow-sm backdrop-blur-sm",
        isLightTheme
          ? "border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
          : "border-white/10 bg-white/5 shadow-[0_16px_40px_rgba(2,6,23,0.24)]",
      )}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">Analytics Insight</p>
          <h2 className={classNames("mt-2 text-xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>{title}</h2>
          {helperText ? (
            <p className={classNames("mt-2 max-w-4xl text-sm leading-6", isLightTheme ? "text-slate-600" : "text-white/60")}>
              {helperText}
            </p>
          ) : null}
          {warning ? (
            <p className={classNames("mt-2 text-sm", isLightTheme ? "text-amber-700" : "text-amber-100")}>{warning}</p>
          ) : null}
        </div>
        <span
          aria-hidden="true"
          className={classNames(
            "mt-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-lg transition group-open:rotate-180",
            isLightTheme ? "border-slate-200 bg-slate-50 text-slate-600" : "border-white/10 bg-white/5 text-white/70",
          )}
        >
          v
        </span>
      </summary>
      <div className="px-6 pb-6">{children}</div>
    </details>
  );
}
