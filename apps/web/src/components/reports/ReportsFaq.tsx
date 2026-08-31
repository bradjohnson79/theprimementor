import { useId, useState } from "react";
import { REPORT_LANDING_FAQS } from "../../data/reportLanding";

export default function ReportsFaq() {
  const baseId = useId();
  const [openId, setOpenId] = useState<string | null>(REPORT_LANDING_FAQS[0]?.id ?? null);

  return (
    <div className="space-y-3">
      {REPORT_LANDING_FAQS.map((item) => {
        const expanded = openId === item.id;
        const panelId = `${baseId}-${item.id}-panel`;
        const buttonId = `${baseId}-${item.id}-button`;
        return (
          <div key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <h3 className="m-0">
              <button
                type="button"
                id={buttonId}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpenId(expanded ? null : item.id)}
                className="flex min-h-11 w-full items-center justify-between gap-4 px-5 py-4 text-left text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
              >
                <span>{item.question}</span>
                <span aria-hidden="true" className="text-amber-200/80">{expanded ? "−" : "+"}</span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!expanded}
              className="px-5 pb-5 text-sm leading-7 text-white/72"
            >
              {item.answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}
