import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

interface HeroContentProps {
  onExploreReports?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

type HeroCta = {
  label: string;
  to: string;
  variant: "primary" | "secondary";
  onExploreReports?: boolean;
};

type HeroSlide = {
  eyebrow: string;
  headline: string[];
  body: string;
  benefits: string[];
  ctas: HeroCta[];
  priceNote?: string;
};

const CTA_CLASS_NAME = [
  "inline-flex items-center justify-center",
  "rounded-xl border px-5 py-3 text-sm shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md transition",
  "sm:min-w-[10.5rem]",
].join(" ");

const PRIMARY_CTA_CLASS_NAME = [
  CTA_CLASS_NAME,
  "border-cyan-200/40 bg-gradient-to-r from-cyan-300 to-teal-300 font-semibold text-slate-950",
  "hover:border-cyan-100/70 hover:brightness-110 hover:shadow-[0_0_28px_rgba(34,211,238,0.22)]",
].join(" ");

const SECONDARY_CTA_CLASS_NAME = [
  CTA_CLASS_NAME,
  "border-white/22 bg-black/35 text-white/88",
  "hover:border-white/30 hover:bg-black/45 hover:text-white hover:shadow-[0_0_24px_rgba(255,255,255,0.12)]",
].join(" ");

const ROTATION_INTERVAL_MS = 15_000;
const ROTATION_TRANSITION_MS = 700;

const MEMBERSHIP_CTAS: HeroCta[] = [
  { label: "Join Premium", to: "/subscriptions/seeker", variant: "primary" },
  { label: "Explore Sessions", to: "/#sessions", variant: "secondary" },
  { label: "Explore Reports", to: "/#reports", variant: "secondary", onExploreReports: true },
];

const MEMBERSHIP_PRICE_NOTE = "Only $14.99/month or $144/year";

const HERO_TEXT_SLIDES: HeroSlide[] = [
  {
    eyebrow: "18+ YEARS OF METAPHYSICAL EXPERIENCE",
    headline: ["Guidance Built on", "Experience, Insight &", "Practical Wisdom"],
    body:
      "For more than 18 years, Brad Johnson has worked with people around the world through intuitive guidance, private sessions, consciousness research, metaphysical study, and transformational teaching — helping people gain clarity, understand themselves more deeply, and move forward with greater direction.",
    benefits: [
      "18+ Years of Metaphysical Knowledge & Practice",
      "Intuitive Guidance & Private Mentoring",
      "Practical Insight for Personal Transformation",
    ],
    ctas: [
      { label: "Meet Brad", to: "/about", variant: "primary" },
      { label: "Explore Sessions", to: "/#sessions", variant: "secondary" },
    ],
  },
  {
    eyebrow: "THE PRIME MENTOR MEMBERSHIP",
    headline: ["Unlock Your Premium", "Path to Guidance,", "Insight & Growth"],
    body:
      "Get full access to Divin8 Chat, member savings, webinar discounts, and exclusive course pricing — designed to help you move forward with greater clarity and direction.",
    benefits: [
      "Full Access to Divin8 Chat (200 prompts/month)",
      "20% Off Monthly Mentoring Circle Webinars",
      "Exclusive Discounts on Upcoming Prime Mentor E-Courses",
    ],
    ctas: MEMBERSHIP_CTAS,
    priceNote: MEMBERSHIP_PRICE_NOTE,
  },
  {
    eyebrow: "PRIVATE SESSIONS & REPORTS",
    headline: ["Gain Clarity Through", "Private Sessions &", "Advanced Reports"],
    body:
      "Book a one-on-one Q&A or Mentoring Session, or explore personalized reports designed to bring insight, direction, and practical understanding to your path.",
    benefits: [
      "Q&A & Mentoring Sessions",
      "Divin8 Synthesis Reports",
      "Personalized Guidance & Direction",
    ],
    ctas: MEMBERSHIP_CTAS,
    priceNote: MEMBERSHIP_PRICE_NOTE,
  },
];

export default function HeroContent({ onExploreReports }: HeroContentProps) {
  const prefersReducedMotion = useReducedMotion();
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [previousSlideIndex, setPreviousSlideIndex] = useState<number | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.65, ease: "easeOut" as const };
  const activeSlide = HERO_TEXT_SLIDES[activeSlideIndex] ?? HERO_TEXT_SLIDES[0];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveSlideIndex((current) => {
        setPreviousSlideIndex(current);
        return (current + 1) % HERO_TEXT_SLIDES.length;
      });
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (previousSlideIndex == null) {
      return;
    }

    if (transitionTimeoutRef.current != null) {
      window.clearTimeout(transitionTimeoutRef.current);
    }

    transitionTimeoutRef.current = window.setTimeout(() => {
      setPreviousSlideIndex(null);
    }, ROTATION_TRANSITION_MS);

    return () => {
      if (transitionTimeoutRef.current != null) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [previousSlideIndex]);

  return (
    <div className="relative z-20 max-w-[39rem] text-left">
      <div className="relative min-h-[34rem] sm:min-h-[32rem] lg:min-h-[30rem] xl:min-h-[29rem]">
        {HERO_TEXT_SLIDES.map((slide, index) => {
          const isActive = activeSlideIndex === index;
          const isPrevious = previousSlideIndex === index;
          return (
            <div
              key={slide.eyebrow}
              aria-hidden={!isActive}
              className={[
                "absolute inset-x-0 top-0 transition-[opacity,transform] ease-out",
                prefersReducedMotion ? "duration-0" : "duration-700",
                isActive
                  ? "pointer-events-auto translate-x-0 opacity-100"
                  : `pointer-events-none opacity-0 ${isPrevious ? "-translate-x-3" : "translate-x-3"}`,
              ].join(" ")}
            >
              <motion.p
                initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={transition}
                className="text-[0.74rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/85"
              >
                {slide.eyebrow}
              </motion.p>

              <motion.h1
                id={isActive ? "hero-heading" : undefined}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...transition, delay: prefersReducedMotion ? 0 : 0.08 }}
                className="hero-headline mt-5 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-[4.05rem] lg:leading-[0.96]"
              >
                {slide.headline.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </motion.h1>

              <motion.p
                initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...transition, delay: prefersReducedMotion ? 0 : 0.18 }}
                className="mt-5 max-w-[31rem] text-sm leading-7 text-white/88 sm:text-base [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]"
              >
                {slide.body}
              </motion.p>

              <motion.ul
                initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...transition, delay: prefersReducedMotion ? 0 : 0.24 }}
                className="mt-5 max-w-[34rem] space-y-2 text-sm text-white/82"
              >
                {slide.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2.5 leading-snug">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-200/10 text-xs font-semibold text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.12)]">
                      ✓
                    </span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </motion.ul>
            </div>
          );
        })}
      </div>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: prefersReducedMotion ? 0 : 0.3 }}
        className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
      >
        {activeSlide.ctas.map((cta) => (
          <Link
            key={`${activeSlide.eyebrow}-${cta.label}`}
            to={cta.to}
            onClick={cta.onExploreReports ? onExploreReports : undefined}
            className={`${cta.variant === "primary" ? PRIMARY_CTA_CLASS_NAME : SECONDARY_CTA_CLASS_NAME} w-full sm:w-auto`}
          >
            {cta.label}
          </Link>
        ))}
      </motion.div>

      {activeSlide.priceNote ? (
        <motion.p
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transition, delay: prefersReducedMotion ? 0 : 0.38 }}
          className="mt-3 text-sm font-medium text-cyan-100/76 [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]"
        >
          {activeSlide.priceNote}
        </motion.p>
      ) : (
        <div className="mt-3 h-5" aria-hidden="true" />
      )}

      <div className="mt-4 flex items-center gap-2" aria-hidden="true" data-hero-indicators>
        {HERO_TEXT_SLIDES.map((slide, index) => (
          <span
            key={slide.eyebrow}
            className={[
              "h-1.5 rounded-full transition-all duration-500",
              activeSlideIndex === index
                ? "w-6 bg-cyan-200/80 shadow-[0_0_12px_rgba(165,243,252,0.34)]"
                : "w-1.5 bg-white/24",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}
