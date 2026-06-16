import { Link } from "react-router-dom";
import type { GuideSection } from "./guideContent";

interface ContactGuideCardProps {
  section: GuideSection;
}

export default function ContactGuideCard({ section }: ContactGuideCardProps) {
  return (
    <article className="rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.07] p-4 shadow-[0_18px_50px_rgba(2,6,23,0.22)] lg:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-accent-cyan">{section.title}</h4>
          {section.body ? (
            <p className="mt-1.5 text-sm leading-6 text-white/65">{section.body}</p>
          ) : null}
        </div>
        <Link
          to="/member/contact"
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-accent-cyan px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Contact Us
        </Link>
      </div>
    </article>
  );
}
