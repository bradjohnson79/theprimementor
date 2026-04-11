import { Link } from "react-router-dom";

interface CompactCardItem {
  title: string;
  description: string;
  /** Optional image shown between the title and description (e.g. product mockup). */
  imageSrc?: string;
  imageAlt?: string;
  meta?: string;
  href?: string;
  external?: boolean;
  /** Optional button below the description (card stays a block; use instead of wrapping the whole card in `href`). */
  cta?: {
    label: string;
    href: string;
    external?: boolean;
  };
}

interface CompactCardGridProps {
  items: CompactCardItem[];
  columns?: 2 | 3 | 4;
  /** Dense, low-lift cards (e.g. Overview pillars) */
  variant?: "default" | "solid";
}

const CARD_DEFAULT =
  "group rounded-xl border border-white/10 bg-white/[0.055] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.2)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-white/16 hover:bg-white/[0.075] hover:shadow-[0_16px_44px_rgba(0,0,0,0.26),0_0_16px_rgba(120,160,255,0.06)]";

const CARD_SOLID =
  "rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/14 hover:bg-white/[0.045]";

const CTA_CLASS =
  "mt-4 inline-flex w-full items-center justify-center rounded-md bg-white/10 py-2 text-center text-sm font-medium text-white transition hover:bg-white/20";

export default function CompactCardGrid({ items, columns = 3, variant = "default" }: CompactCardGridProps) {
  const columnClass =
    variant === "solid" && columns === 2
      ? "grid-cols-1 sm:grid-cols-2 gap-4 pt-2"
      : columns === 2
        ? "grid-cols-1 md:grid-cols-2 gap-4"
        : columns === 4
          ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";

  const gridClass = variant === "solid" && columns === 2 ? `grid ${columnClass}` : ["grid", columnClass].join(" ");

  return (
    <div className={gridClass}>
      {items.map((item) => {
        const cardClass = variant === "solid" ? CARD_SOLID : CARD_DEFAULT;

        const ctaEl =
          item.cta != null ? (
            item.cta.external ? (
              <a
                href={item.cta.href}
                target="_blank"
                rel="noopener noreferrer"
                className={CTA_CLASS}
              >
                {item.cta.label}
              </a>
            ) : (
              <Link to={item.cta.href} className={CTA_CLASS}>
                {item.cta.label}
              </Link>
            )
          ) : null;

        const imageBlock =
          item.imageSrc != null && item.imageSrc !== "" ? (
            <div
              className={
                variant === "solid"
                  ? "overflow-hidden rounded-lg border border-white/10 bg-black/25"
                  : "mt-3 overflow-hidden rounded-lg border border-white/10 bg-black/25"
              }
            >
              <img
                src={item.imageSrc}
                alt={item.imageAlt ?? item.title}
                className="mx-auto h-auto max-h-48 w-full object-contain object-center"
                loading="lazy"
                decoding="async"
              />
            </div>
          ) : null;

        const defaultBody = (
          <>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-white">{item.title}</h3>
              {item.meta ? <span className="shrink-0 text-xs font-medium text-cyan-100/80">{item.meta}</span> : null}
            </div>
            {imageBlock}
            <p className={`text-sm leading-6 text-white/62 ${item.imageSrc ? "mt-3" : "mt-2"}`}>{item.description}</p>
            {ctaEl}
          </>
        );

        const solidBody = (
          <>
            <h3 className="text-sm font-medium text-white">{item.title}</h3>
            {imageBlock}
            <p className="text-sm leading-relaxed text-white/60">{item.description}</p>
            {ctaEl}
          </>
        );

        const body = variant === "solid" ? solidBody : defaultBody;
        const innerClass = variant === "solid" ? `${cardClass} space-y-2` : cardClass;

        if (item.cta) {
          return (
            <div key={item.title} className={innerClass}>
              {body}
            </div>
          );
        }

        if (!item.href) {
          return (
            <div key={item.title} className={innerClass}>
              {body}
            </div>
          );
        }

        return (
          <a
            key={item.title}
            href={item.href}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noopener noreferrer" : undefined}
            className={innerClass}
          >
            {body}
          </a>
        );
      })}
    </div>
  );
}
