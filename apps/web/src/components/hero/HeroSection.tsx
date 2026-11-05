import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import HeroContent from "./HeroContent";
import HeroEnergyRibbons from "./HeroEnergyRibbons";
import HeroSparkleField from "./HeroSparkleField";
import { HERO_ROTATION_MS, HERO_SLIDES, type HeroSlide } from "./heroSlides";

const SLIDE_COUNT = HERO_SLIDES.length;

export default function HeroSection() {
  const prefersReducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(false);
  const rotationHeld = Boolean(prefersReducedMotion) || hoverPaused || focusPaused || userPaused || documentHidden;
  const activeSlide = HERO_SLIDES[activeIndex] ?? HERO_SLIDES[0];

  useEffect(() => {
    function onVisibility() {
      setDocumentHidden(document.hidden);
    }
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (rotationHeld) return;
    const timeout = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % SLIDE_COUNT);
    }, HERO_ROTATION_MS);
    return () => window.clearTimeout(timeout);
  }, [activeIndex, rotationHeld]);

  function selectSlide(index: number, moveFocus = false) {
    const next = ((index % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT;
    setActiveIndex(next);
    if (!moveFocus) return;
    const id = HERO_SLIDES[next]?.id;
    window.requestAnimationFrame(() => {
      document.getElementById(`hero-tab-${id}`)?.focus();
    });
  }

  function step(direction: -1 | 1, moveFocus = false) {
    selectSlide(activeIndex + direction, moveFocus);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("[data-hero-controls]")) return;
    event.preventDefault();
    if (event.key === "ArrowRight") step(1, true);
    else if (event.key === "ArrowLeft") step(-1, true);
    else if (event.key === "Home") selectSlide(0, true);
    else selectSlide(SLIDE_COUNT - 1, true);
  }

  function onBlurCapture(event: React.FocusEvent<HTMLElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setFocusPaused(false);
  }

  return (
    <section
      id="hero"
      className="relative scroll-mt-24 overflow-hidden"
      aria-roledescription="carousel"
      aria-labelledby="hero-heading"
      data-hero-slide={activeSlide.id}
      data-hero-interval={HERO_ROTATION_MS}
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        setFocusPaused(!target?.closest("[data-hero-controls]"));
      }}
      onBlurCapture={onBlurCapture}
      onKeyDown={onKeyDown}
    >
      {HERO_SLIDES.map((slide, index) => (
        <HeroSlideBackdrop
          key={slide.id}
          slide={slide}
          active={index === activeIndex}
          reducedMotion={Boolean(prefersReducedMotion)}
        />
      ))}

      <div
        className={[
          "transition-opacity ease-out",
          prefersReducedMotion ? "duration-0" : "duration-700",
          activeSlide.id === "brad" ? "opacity-100" : "opacity-0",
        ].join(" ")}
      >
        <HeroEnergyRibbons />
      </div>
      <HeroSparkleField className="z-[2]" />

      <div className="relative z-10 flex min-h-[100svh] flex-col justify-center px-6 py-14 md:px-8 md:py-20 lg:px-10">
        <div className="mx-auto w-full max-w-7xl">
          <HeroContent
            activeIndex={activeIndex}
            userPaused={userPaused}
            onSelect={(index) => selectSlide(index)}
            onStep={(direction) => step(direction)}
            onTogglePause={() => setUserPaused((current) => !current)}
          />
        </div>
      </div>
    </section>
  );
}

function HeroSlideBackdrop({
  slide,
  active,
  reducedMotion,
}: {
  slide: HeroSlide;
  active: boolean;
  reducedMotion: boolean;
}) {
  return (
    <div
      className={[
        "absolute inset-0 transition-opacity ease-out",
        reducedMotion ? "duration-0" : "duration-700",
        active ? "opacity-100" : "opacity-0",
      ].join(" ")}
      aria-hidden="true"
    >
      {slide.visual.kind === "brad" ? (
        <BradBackdrop desktopSrc={slide.visual.desktopSrc} mobileSrc={slide.visual.mobileSrc} eager={active} />
      ) : null}
      {slide.visual.kind === "model" ? <ModelBackdrop src={slide.visual.src} /> : null}
      {slide.visual.kind === "scene" ? <SceneBackdrop src={slide.visual.src} /> : null}
    </div>
  );
}

function BradBackdrop({
  desktopSrc,
  mobileSrc,
  eager,
}: {
  desktopSrc: string;
  mobileSrc: string;
  eager: boolean;
}) {
  return (
    <>
      <img
        src={mobileSrc}
        alt=""
        className="h-full min-h-[100svh] w-full object-cover object-center sm:hidden"
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : "low"}
      />
      <img
        src={desktopSrc}
        alt=""
        className="hidden h-full min-h-[100svh] w-full object-cover object-[52%_center] sm:block sm:object-center"
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : "low"}
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-[#04050f]/94 via-[#0a0d18]/45 to-transparent md:from-[#04050f]/88 md:via-[#080c18]/32"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#04050f]/70 via-transparent to-[#04050f]/25" />
    </>
  );
}

function ModelBackdrop({ src }: { src: string }) {
  return (
    <>
      <div className="absolute inset-0 bg-[#04050f]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_48%,rgba(251,191,36,0.2),transparent_34%),radial-gradient(circle_at_16%_28%,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_88%_82%,rgba(124,92,255,0.16),transparent_30%)]" />
      <img
        src={src}
        alt=""
        className="absolute bottom-0 right-[1%] hidden h-[96%] w-auto max-w-[54%] object-contain object-bottom sm:block"
      />
      <img
        src={src}
        alt=""
        className="absolute bottom-0 right-[-22%] h-[86%] w-auto max-w-none object-contain object-bottom sm:hidden"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#04050f] via-[#04050f]/80 to-transparent sm:via-[#04050f]/22" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#04050f]/75 via-transparent to-[#04050f]/28" />
    </>
  );
}

function SceneBackdrop({ src }: { src: string }) {
  return (
    <>
      <div className="absolute inset-0 bg-[#04050f]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(34,211,238,0.14),transparent_32%),radial-gradient(circle_at_78%_40%,rgba(251,191,36,0.16),transparent_34%),radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.16),transparent_32%)]" />
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_20%] opacity-55 sm:hidden"
      />
      <div className="absolute inset-y-0 right-0 hidden w-[min(58%,54rem)] overflow-hidden sm:block">
        <img
          src={src}
          alt=""
          className="absolute inset-x-0 top-0 h-[168%] w-full object-cover object-[center_8%]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#04050f] via-[#04050f]/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#04050f] to-transparent" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-[#04050f]/94 via-[#04050f]/72 to-transparent sm:via-[#04050f]/25" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#04050f]/75 via-transparent to-[#04050f]/30 sm:hidden" />
    </>
  );
}
