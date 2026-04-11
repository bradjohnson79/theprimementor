import { motion, useReducedMotion } from "framer-motion";
import CompactCardGrid from "../public/CompactCardGrid";

const PILLARS = [
  {
    title: "Structured Sessions",
    description:
      "Powerful one-on-one sessions that interpret your full energetic blueprint through a unified system—delivering clear direction for your path, decisions, and next steps.",
  },
  {
    title: "Detailed Life Reports",
    description:
      "In-depth written interpretations that reveal your life structure and purpose with precision—eliminating guesswork and surface-level insight.",
  },
  {
    title: "Ongoing Knowledge",
    description:
      "Through subscription access, engage with the Divin8 system—offering calculated insights and structured wisdom to support your continued inner evolution.",
  },
  {
    title: "Long-Term Mentoring",
    description:
      "For those committed to real transformation, long-term mentorship provides deeper instruction, advanced teachings, and guided progression into higher levels of understanding.",
  },
];

export default function OverviewSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.section
      id="overview"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.55, ease: "easeOut" }}
      className="relative scroll-mt-28 border-t border-white/8 py-16"
      aria-labelledby="overview-heading"
    >
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[380px_1fr]">
          <div className="relative w-full max-w-[380px] justify-self-center lg:justify-self-start">
            <div className="aspect-[9/16] overflow-hidden rounded-xl border border-white/10 bg-black/30">
              <img
                src="/images/mentoring-lantern.webp"
                alt="Brad Johnson holding a lantern in a misty forest at twilight"
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>

          <div className="min-w-0 space-y-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">Overview</p>
            <h2
              id="overview-heading"
              className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.03em] text-white"
            >
              Real soul-level mentoring diving deeply into your own living blueprint delivering clarity through
              calculated precision and integration.
            </h2>
            <p className="max-w-lg text-sm leading-relaxed text-white/70 sm:text-base">
              Prime Mentor works with a powerful synthesis system to reveal facets of your life helping you to reflect on
              your strengths, act with clarity over personal challenges, and progress past confusion.
            </p>
            <CompactCardGrid items={PILLARS} columns={2} variant="solid" />
            <p className="text-sm text-white/55">Start with clarity. Go deeper with structure. Stay aligned through integration.</p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
