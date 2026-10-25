import { useId, useState } from "react";

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
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const headingId = useId();

  return (
    <section
      className={classNames(
        "rounded-2xl border",
        isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-white/[0.04]",
      )}
    >
      <h2 id={headingId} className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
          className={classNames(
            "flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left",
            isLightTheme ? "hover:bg-slate-50" : "hover:bg-white/[0.03]",
          )}
        >
          <span className="min-w-0">
            <span className={classNames("block truncate text-sm font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>
              {title}
            </span>
            {warning ? (
              <span className={classNames("mt-1 block truncate text-xs", isLightTheme ? "text-amber-700" : "text-amber-100")}>
                {warning}
              </span>
            ) : null}
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className={classNames(
              "h-4 w-4 shrink-0 text-accent-cyan transition-transform duration-200 motion-reduce:transition-none",
              open ? "rotate-180" : "rotate-0",
            )}
          >
            <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h2>
      <div
        className={classNames(
          "grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div
            id={panelId}
            role="region"
            aria-labelledby={headingId}
            aria-hidden={!open}
            inert={!open}
          >
            <div className="space-y-4 px-4 pb-4">
              {helperText ? (
                <p className={classNames("text-xs leading-5", isLightTheme ? "text-slate-500" : "text-white/50")}>{helperText}</p>
              ) : null}
              {children}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
