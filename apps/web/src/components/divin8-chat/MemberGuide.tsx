import { classNames } from "@wisdom/ui/divin8-chat";

const GUIDE_CARDS = [
  {
    title: "Astrology Input Guide",
    body: "Give birth date, exact birth time, and birth location together when you want a chart-backed astrology or Human Design reading.",
  },
  {
    title: "Systems Overview",
    body: "Divin8 routes one primary system by default and only combines systems when you explicitly ask for comparison or synthesis.",
  },
  {
    title: "Insight Timeline",
    body: "Confirmed profile facts and meaningful thread events are carried forward so Divin8 can reuse memory without asking twice.",
  },
  {
    title: "Image Interpretation",
    body: "Uploaded images are handled as symbolic physiognomy only. Responses stay energetic, reflective, and non-diagnostic.",
  },
  {
    title: "Synthesis Mode",
    body: "Ask explicitly for synthesis when you want Divin8 to compare systems or weave multiple signals into one integrated reading.",
  },
];

interface MemberGuideProps {
  isLightTheme?: boolean;
}

export default function MemberGuide({ isLightTheme = false }: MemberGuideProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-accent-cyan">Divin8 Guide</p>
        <p className={classNames("mt-1 text-xs leading-5", isLightTheme ? "text-slate-500" : "text-white/55")}>
          Swipe across the cards to see how Divin8 collects input, routes systems, and keeps continuity alive.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {GUIDE_CARDS.map((card) => (
          <article
            key={card.title}
            className={classNames(
              "rounded-xl border p-3",
              isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/[0.04]",
            )}
          >
            <p className="text-sm font-semibold">{card.title}</p>
            <p className={classNames("mt-1.5 text-sm leading-5", isLightTheme ? "text-slate-600" : "text-white/65")}>
              {card.body}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
