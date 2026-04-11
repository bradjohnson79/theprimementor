import { useCallback, useEffect, useRef, useState } from "react";

export interface TestimonialItem {
  id: string;
  quote: string;
  name: string;
  role?: string;
}

interface TestimonialsSliderProps {
  items: TestimonialItem[];
  className?: string;
}

export default function TestimonialsSlider({ items, className = "" }: TestimonialsSliderProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    setCanPrev(scrollLeft > 4);
    setCanNext(scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows, items.length]);

  const scrollStep = useCallback((direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const firstCard = el.querySelector<HTMLElement>("[data-testimonial-card]");
    const gap = 16;
    const step = (firstCard?.offsetWidth ?? Math.min(400, el.clientWidth * 0.88)) + gap;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }, []);

  return (
    <div className={["relative px-10 sm:px-12 md:px-14", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        aria-label="Previous testimonials"
        disabled={!canPrev}
        onClick={() => scrollStep(-1)}
        className="absolute left-0 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-[#090d19]/90 text-lg text-white/90 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:border-white/22 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25 sm:-left-2 sm:h-12 sm:w-12"
      >
        <span aria-hidden className="block translate-x-[-1px]">
          ‹
        </span>
      </button>
      <button
        type="button"
        aria-label="Next testimonials"
        disabled={!canNext}
        onClick={() => scrollStep(1)}
        className="absolute right-0 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-[#090d19]/90 text-lg text-white/90 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:border-white/22 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25 sm:-right-2 sm:h-12 sm:w-12"
      >
        <span aria-hidden className="block translate-x-[1px]">
          ›
        </span>
      </button>

      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-1 py-2 [scrollbar-width:none] sm:gap-5 [&::-webkit-scrollbar]:hidden"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            scrollStep(-1);
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            scrollStep(1);
          }
        }}
      >
        {items.map((item) => (
          <article
            key={item.id}
            data-testimonial-card
            className="w-[min(100%,22rem)] shrink-0 snap-center rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_16px_48px_rgba(0,0,0,0.28)] backdrop-blur-md sm:w-[min(100%,26rem)] sm:p-6 md:w-[min(100%,28rem)]"
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-cyan-200/55">Client story</p>
            <blockquote className="mt-3 text-sm leading-relaxed text-white/78 sm:text-[0.95rem]">
              <span className="text-cyan-200/45">&ldquo;</span>
              {item.quote}
              <span className="text-cyan-200/45">&rdquo;</span>
            </blockquote>
            <footer className="mt-5 border-t border-white/8 pt-4">
              <p className="font-medium text-white">{item.name}</p>
              {item.role ? <p className="mt-0.5 text-xs text-white/48">{item.role}</p> : null}
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
