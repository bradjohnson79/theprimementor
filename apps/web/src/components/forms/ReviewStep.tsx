import type { ReactNode } from "react";

interface ReviewItem {
  label: string;
  value: ReactNode;
}

interface ReviewSection {
  id: string;
  title: string;
  items: ReviewItem[];
  onEdit: () => void;
}

interface ReviewStepProps {
  sections: ReviewSection[];
  message?: string;
}

export default function ReviewStep({
  sections,
  message = "Everything looks good. You're ready to proceed.",
}: ReviewStepProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/5 px-4 py-4 text-sm text-white/72">
        {message}
      </div>

      <div className="grid gap-4">
        {sections.map((section) => (
          <div
            key={section.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-white">{section.title}</h3>
              <button
                type="button"
                onClick={section.onEdit}
                className="rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-white/75 transition hover:bg-white/5"
              >
                Edit
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {section.items.map((item) => (
                <div key={`${section.id}-${item.label}`} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/40">{item.label}</p>
                  <div className="mt-2 text-sm leading-6 text-white/78">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
