import { classNames } from "@wisdom/ui/divin8-chat";
import type { GuideSection } from "./guideContent";

interface GuideSectionCardProps {
  section: GuideSection;
}

function PromptExample({ value }: { value: string }) {
  return (
    <div className="whitespace-normal break-words rounded-xl border border-cyan-300/25 bg-cyan-400/[0.08] px-3 py-2.5 text-xs leading-5 text-cyan-50/90" style={{ overflowWrap: "anywhere" }}>
      {value}
    </div>
  );
}

function GuideList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">{title}</p>
      <ul className="space-y-1.5 text-sm leading-6 text-white/65">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-cyan/70" aria-hidden />
            <span className="min-w-0 break-words" style={{ overflowWrap: "anywhere" }}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function GuideSectionCard({ section }: GuideSectionCardProps) {
  return (
    <article
      className={classNames(
        "rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_50px_rgba(2,6,23,0.22)]",
        section.span === "full" ? "lg:col-span-2" : "",
      )}
    >
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-accent-cyan">{section.title}</h4>
          {section.body ? (
            <p className="mt-1.5 text-sm leading-6 text-white/65">{section.body}</p>
          ) : null}
        </div>

        {section.formula ? (
          <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2.5 text-sm font-semibold text-amber-100" style={{ overflowWrap: "anywhere" }}>
            {section.formula}
          </div>
        ) : null}

        {section.examples && section.examples.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Examples</p>
            <div className="grid gap-2">
              {section.examples.map((example) => (
                <PromptExample key={example} value={example} />
              ))}
            </div>
          </div>
        ) : null}

        <GuideList title="Tips" items={section.tips ?? []} />
        <GuideList title="Supported Uses" items={section.useCases ?? []} />

        {section.notes?.map((note) => (
          <p key={note} className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-xs leading-5 text-white/55">
            {note}
          </p>
        ))}

        {section.safetyNote ? (
          <p className="rounded-xl border border-rose-300/20 bg-rose-400/[0.08] px-3 py-2 text-xs leading-5 text-rose-100/85">
            {section.safetyNote}
          </p>
        ) : null}
      </div>
    </article>
  );
}
