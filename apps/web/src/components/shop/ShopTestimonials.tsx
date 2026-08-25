import { useEffect, useId, useRef, useState } from "react";
import type { ShopPublicTestimonial } from "../../lib/shop";

const PREVIEW_CHARS = 320;

function TestimonialCard({ testimonial }: { testimonial: ShopPublicTestimonial }) {
  const [expanded, setExpanded] = useState(false);
  const long = testimonial.testimonialText.length > PREVIEW_CHARS;
  const text = !long || expanded
    ? testimonial.testimonialText
    : `${testimonial.testimonialText.slice(0, PREVIEW_CHARS).trimEnd()}…`;

  return (
    <article className="glass-card flex h-full min-h-[22rem] flex-col rounded-3xl p-6 md:p-8">
      {testimonial.title ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">{testimonial.title}</p>
      ) : null}
      <blockquote className="mt-4 flex-1 text-base leading-8 text-white/78">
        “{text}”
      </blockquote>
      {long ? (
        <button
          type="button"
          className="mt-3 self-start text-sm font-semibold text-amber-100 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
      <footer className="mt-6">
        <p className="text-sm font-semibold text-white">{testimonial.customerName}</p>
        {testimonial.location ? <p className="mt-1 text-sm text-white/55">{testimonial.location}</p> : null}
        {testimonial.contextLabel ? <p className="mt-3 text-xs uppercase tracking-[0.16em] text-white/40">{testimonial.contextLabel}</p> : null}
      </footer>
    </article>
  );
}

export default function ShopTestimonials({
  heading,
  subtitle,
  disclaimer,
  testimonials,
}: {
  heading: string;
  subtitle?: string | null;
  disclaimer: string;
  testimonials: ShopPublicTestimonial[];
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const sync = () => {
      const width = scroller.clientWidth || 1;
      const pages = Math.max(1, Math.ceil(scroller.scrollWidth / width));
      setPageCount(pages);
      setPage(Math.round(scroller.scrollLeft / width));
    };

    sync();
    scroller.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      scroller.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [testimonials.length]);

  function scrollByPage(direction: -1 | 1) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const width = scroller.clientWidth;
    const maxLeft = scroller.scrollWidth - width;
    let next = scroller.scrollLeft + direction * width;
    if (next > maxLeft + 8) next = 0;
    if (next < -8) next = maxLeft;
    scroller.scrollTo({ left: next, behavior: reduced ? "auto" : "smooth" });
  }

  if (testimonials.length === 0) return null;

  return (
    <section
      className="mx-auto mt-16 max-w-6xl border-t border-white/10 pt-12"
      aria-labelledby={headingId}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          scrollByPage(1);
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          scrollByPage(-1);
        }
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">Customer testimonials</p>
      <h2 id={headingId} className="mt-3 text-3xl font-semibold">{heading}</h2>
      {subtitle ? <p className="mt-3 max-w-3xl text-sm text-white/55">{subtitle}</p> : null}

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          className="hidden h-11 w-11 shrink-0 rounded-full border border-white/15 bg-white/5 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 md:inline-flex md:items-center md:justify-center"
          aria-label="Previous testimonial"
          onClick={() => scrollByPage(-1)}
        >
          ‹
        </button>
        <div
          ref={scrollerRef}
          className="flex min-w-0 flex-1 snap-x snap-mandatory gap-6 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          tabIndex={0}
          role="region"
          aria-label="Testimonial gallery"
        >
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="w-full shrink-0 snap-start md:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
            >
              <TestimonialCard testimonial={testimonial} />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="hidden h-11 w-11 shrink-0 rounded-full border border-white/15 bg-white/5 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 md:inline-flex md:items-center md:justify-center"
          aria-label="Next testimonial"
          onClick={() => scrollByPage(1)}
        >
          ›
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3 md:hidden">
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
          aria-label="Previous testimonial"
          onClick={() => scrollByPage(-1)}
        >
          ‹
        </button>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
          aria-label="Next testimonial"
          onClick={() => scrollByPage(1)}
        >
          ›
        </button>
      </div>

      {pageCount > 1 ? (
        <div className="mt-4 flex justify-center gap-2" aria-hidden="true">
          {Array.from({ length: pageCount }, (_, index) => (
            <span
              key={index}
              className={`h-2 w-2 rounded-full ${index === page ? "bg-amber-200" : "bg-white/25"}`}
            />
          ))}
        </div>
      ) : null}

      <p className="mt-8 max-w-4xl text-sm leading-7 text-white/55">{disclaimer}</p>
    </section>
  );
}
