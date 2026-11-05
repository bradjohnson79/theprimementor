import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { trackCtaClick } from "../../lib/analytics";
import { HERO_SLIDES, type HeroSlide } from "./heroSlides";

interface HeroContentProps {
  activeIndex: number;
  userPaused: boolean;
  onSelect: (index: number) => void;
  onStep: (direction: -1 | 1) => void;
  onTogglePause: () => void;
}

const CTA_CLASS_NAME = [
  "inline-flex items-center justify-center",
  "rounded-xl border px-5 py-3 text-sm shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md transition",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200",
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

const CONTROL_BUTTON_CLASS_NAME = [
  "inline-flex h-10 w-10 items-center justify-center rounded-full",
  "border border-white/20 bg-black/40 text-white/88 backdrop-blur-md transition",
  "hover:border-cyan-200/45 hover:text-cyan-100",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

export default function HeroContent({
  activeIndex,
  userPaused,
  onSelect,
  onStep,
  onTogglePause,
}: HeroContentProps) {
  const prefersReducedMotion = useReducedMotion();
  const lastIndexRef = useRef(activeIndex);
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
  const activeSlide = HERO_SLIDES[activeIndex] ?? HERO_SLIDES[0];
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.65, ease: "easeOut" as const };

  useEffect(() => {
    const previous = lastIndexRef.current;
    lastIndexRef.current = activeIndex;
    if (previous === activeIndex) return;
    setLeavingIndex(previous);
    const timeout = window.setTimeout(() => {
      setLeavingIndex((current) => (current === previous ? null : current));
    }, prefersReducedMotion ? 0 : 700);
    return () => window.clearTimeout(timeout);
  }, [activeIndex, prefersReducedMotion]);

  return (
    <div className="relative z-20 max-w-[39rem] text-left">
      <div
        id="hero-panel"
        role="tabpanel"
        aria-labelledby={`hero-tab-${activeSlide.id}`}
        className="relative"
      >
        {HERO_SLIDES.map((slide, index) => (
          <HeroSlideCopy
            key={slide.id}
            slide={slide}
            index={index}
            isActive={activeIndex === index}
            isPrevious={leavingIndex === index}
            prefersReducedMotion={Boolean(prefersReducedMotion)}
            transition={transition}
          />
        ))}
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {activeSlide.ctas.map((cta) => (
          <a
            key={`${activeSlide.id}-${cta.label}`}
            href={cta.href}
            onClick={() => trackCtaClick(cta.label, "home_hero", {
              href: cta.href,
              slide: activeSlide.id,
              title: activeSlide.label,
            })}
            className={`${cta.variant === "primary" ? PRIMARY_CTA_CLASS_NAME : SECONDARY_CTA_CLASS_NAME} w-full sm:w-auto`}
          >
            {cta.label}
          </a>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2" data-hero-controls>
        <button
          type="button"
          className={CONTROL_BUTTON_CLASS_NAME}
          aria-label="Previous slide"
          onClick={() => onStep(-1)}
        >
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
        </button>

        <div
          role="tablist"
          aria-label="Hero slides"
          data-hero-indicators
          className="flex items-center gap-1"
        >
          {HERO_SLIDES.map((slide, index) => {
            const selected = index === activeIndex;
            return (
              <button
                key={slide.id}
                id={`hero-tab-${slide.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="hero-panel"
                aria-label={`${slide.label} slide`}
                tabIndex={selected ? 0 : -1}
                onClick={() => onSelect(index)}
                className={[
                  "inline-flex h-10 items-center justify-center rounded-full px-1.5",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200",
                  selected ? "w-10" : "w-8",
                ].join(" ")}
              >
                <span
                  className={[
                    "block h-1.5 rounded-full transition-all duration-500",
                    selected
                      ? "w-6 bg-cyan-200 shadow-[0_0_12px_rgba(165,243,252,0.45)]"
                      : "w-1.5 bg-white/40",
                  ].join(" ")}
                />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className={CONTROL_BUTTON_CLASS_NAME}
          aria-label="Next slide"
          onClick={() => onStep(1)}
        >
          <ChevronRight aria-hidden="true" className="h-5 w-5" />
        </button>

        {prefersReducedMotion ? (
          <button
            type="button"
            className={CONTROL_BUTTON_CLASS_NAME}
            aria-pressed="true"
            disabled
            aria-label="Hero rotation is off because reduced motion is on"
          >
            <Pause aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            className={CONTROL_BUTTON_CLASS_NAME}
            aria-pressed={userPaused}
            aria-label={userPaused ? "Play hero rotation" : "Pause hero rotation"}
            onClick={onTogglePause}
          >
            {userPaused ? (
              <Play aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Pause aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function HeroSlideCopy({
  slide,
  index,
  isActive,
  isPrevious,
  prefersReducedMotion,
  transition,
}: {
  slide: HeroSlide;
  index: number;
  isActive: boolean;
  isPrevious: boolean;
  prefersReducedMotion: boolean;
  transition: { duration: number; ease?: "easeOut" };
}) {
  const Headline = index === 0 ? motion.h1 : motion.h2;
  return (
    <div
      aria-hidden={!isActive}
      inert={!isActive ? true : undefined}
      className={[
        "transition-[opacity,transform] ease-out",
        prefersReducedMotion ? "duration-0" : "duration-700",
        isActive
          ? "relative z-10 translate-x-0 opacity-100"
          : `pointer-events-none absolute inset-x-0 top-0 opacity-0 ${isPrevious ? "-translate-x-3" : "translate-x-3"}`,
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

      <Headline
        id={isActive ? "hero-heading" : undefined}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: prefersReducedMotion ? 0 : 0.08 }}
        className="hero-headline mt-5 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-[3.85rem] lg:leading-[0.98]"
      >
        {slide.headline.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </Headline>

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
}
