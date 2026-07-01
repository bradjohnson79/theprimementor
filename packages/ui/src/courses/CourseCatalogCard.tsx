import type { CourseCatalogCardProps } from "./types";

function badgeClasses(tone: CourseCatalogCardProps["badgeTone"]) {
  if (tone === "owned") {
    return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100/85";
  }
  if (tone === "paid") {
    return "border-amber-200/20 bg-amber-200/10 text-amber-100/85";
  }
  return "border-cyan-200/20 bg-cyan-200/10 text-cyan-100/85";
}

export default function CourseCatalogCard({
  title,
  description,
  badge,
  badgeTone = "free",
  ctaLabel,
  thumbnailUrl,
  href,
  onAction,
  disabled = false,
  meta,
}: CourseCatalogCardProps) {
  const actionClass = `dashboard-action-primary ${disabled ? "pointer-events-none opacity-55" : ""}`;
  const content = (
    <>
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40">
        <img
          src={thumbnailUrl}
          alt=""
          className="aspect-video h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${badgeClasses(badgeTone)}`}>
            {badge}
          </span>
          {meta ? <p className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/45">{meta}</p> : null}
        </div>
      </div>
      <h2 className="mt-4 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-white/70">{description}</p>
      <div className="mt-6">
        {href ? (
          <a href={href} className={actionClass} aria-disabled={disabled}>
            {ctaLabel}
          </a>
        ) : (
          <button type="button" onClick={onAction} disabled={disabled} className={actionClass}>
            {ctaLabel}
          </button>
        )}
      </div>
    </>
  );

  return (
    <article className="dashboard-panel cosmic-motion flex h-full flex-col overflow-hidden border border-white/10">
      {content}
    </article>
  );
}
