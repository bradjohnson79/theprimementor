import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { trackCtaClick } from "../../lib/analytics";
import type { SessionLandingType } from "../../lib/sessionLandingPaths";

type LandingTheme = SessionLandingType;

interface SessionLandingImage {
  src: string;
  alt: string;
  fit?: "cover" | "contain";
}

interface SessionLandingCallout {
  eyebrow: string;
  title: string;
  description: string;
}

interface SessionLandingCta {
  label: string;
  href: string;
}

export interface SessionLandingSection {
  id: string;
  label: string;
  title: string;
  paragraphs: string[];
  statementLines?: string[];
  bullets?: string[];
  cta?: SessionLandingCta;
  image?: SessionLandingImage;
  imagePosition?: "left" | "right";
  callout?: SessionLandingCallout;
  density?: "tight" | "default" | "spacious";
  alignment?: "left" | "center";
  bulletColumns?: 1 | 2;
}

export interface SessionLandingContent {
  theme: LandingTheme;
  pageTitle: string;
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    supportingLine: string;
    cta: SessionLandingCta;
    callout: SessionLandingCallout;
  };
  sections: SessionLandingSection[];
  finalCta: {
    eyebrow: string;
    title: string;
    description: string;
    cta: SessionLandingCta;
  };
}

const themeStyles = {
  regeneration: {
    eyebrow: "text-cyan-200/62",
    sectionEyebrow: "text-cyan-200/62",
    heroGlowPrimary: "bg-cyan-400/12",
    heroGlowSecondary: "bg-indigo-500/10",
    heroPanel:
      "bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.16),_transparent_48%),linear-gradient(180deg,rgba(8,12,24,0.96),rgba(4,6,15,0.94))]",
    cta:
      "bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 text-slate-950 hover:from-cyan-400 hover:via-sky-400 hover:to-indigo-400",
    statement:
      "border-cyan-300/18 bg-cyan-300/8 text-cyan-50",
    imageFrame:
      "bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.16),_transparent_45%),linear-gradient(180deg,rgba(9,13,24,0.94),rgba(5,7,16,0.94))]",
    ctaPanel:
      "bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_44%),linear-gradient(180deg,rgba(9,13,24,0.96),rgba(5,7,16,0.94))]",
  },
  qa: {
    eyebrow: "text-amber-200/72",
    sectionEyebrow: "text-amber-200/72",
    heroGlowPrimary: "bg-amber-400/14",
    heroGlowSecondary: "bg-fuchsia-500/12",
    heroPanel:
      "bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_transparent_50%),linear-gradient(180deg,rgba(11,8,24,0.98),rgba(6,5,16,0.95))]",
    cta:
      "bg-gradient-to-r from-amber-400 via-orange-400 to-fuchsia-500 text-slate-950 hover:from-amber-300 hover:via-orange-300 hover:to-fuchsia-400",
    statement:
      "border-amber-300/18 bg-amber-300/8 text-amber-50",
    imageFrame:
      "bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_44%),linear-gradient(180deg,rgba(10,8,24,0.98),rgba(5,4,15,0.95))]",
    ctaPanel:
      "bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_46%),linear-gradient(180deg,rgba(10,8,24,0.98),rgba(5,4,15,0.95))]",
  },
  focus: {
    eyebrow: "text-sky-200/68",
    sectionEyebrow: "text-sky-200/68",
    heroGlowPrimary: "bg-sky-400/14",
    heroGlowSecondary: "bg-indigo-500/14",
    heroPanel:
      "bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_48%),linear-gradient(180deg,rgba(7,11,23,0.98),rgba(4,6,14,0.95))]",
    cta:
      "bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 text-white hover:from-sky-400 hover:via-blue-400 hover:to-indigo-400",
    statement:
      "border-sky-300/18 bg-sky-300/8 text-sky-50",
    imageFrame:
      "bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_42%),linear-gradient(180deg,rgba(9,13,24,0.96),rgba(4,6,14,0.94))]",
    ctaPanel:
      "bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_44%),linear-gradient(180deg,rgba(7,11,23,0.98),rgba(4,6,14,0.95))]",
  },
  mentoring: {
    eyebrow: "text-violet-200/68",
    sectionEyebrow: "text-violet-200/68",
    heroGlowPrimary: "bg-violet-500/16",
    heroGlowSecondary: "bg-fuchsia-500/14",
    heroPanel:
      "bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.18),_transparent_50%),linear-gradient(180deg,rgba(10,8,24,0.98),rgba(5,4,15,0.96))]",
    cta:
      "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 text-white hover:from-violet-400 hover:via-fuchsia-400 hover:to-indigo-400",
    statement:
      "border-violet-300/18 bg-violet-300/8 text-violet-50",
    imageFrame:
      "bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.16),_transparent_44%),linear-gradient(180deg,rgba(10,8,24,0.98),rgba(5,4,15,0.95))]",
    ctaPanel:
      "bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.2),_transparent_46%),linear-gradient(180deg,rgba(10,8,24,0.98),rgba(5,4,15,0.95))]",
  },
} as const;

function densityClass(theme: LandingTheme, density: SessionLandingSection["density"]) {
  if (density === "tight") return theme === "focus" ? "py-12" : "py-14";
  if (density === "spacious") return theme === "mentoring" ? "py-24" : "py-[4.5rem]";
  if (theme === "focus") return "py-14";
  if (theme === "mentoring") return "py-20";
  return "py-16";
}

function LandingCta({
  href,
  label,
  theme,
  location,
  title,
}: {
  href: string;
  label: string;
  theme: LandingTheme;
  location: string;
  title: string;
}) {
  return (
    <Link
      to={href}
      onClick={() => trackCtaClick("session_landing_cta", location, { href, label, title })}
      className={[
        "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
        themeStyles[theme].cta,
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function LandingImageCard({
  image,
  theme,
}: {
  image: SessionLandingImage;
  theme: LandingTheme;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border border-white/10 p-3 shadow-[0_24px_64px_rgba(0,0,0,0.3)]",
        themeStyles[theme].imageFrame,
      ].join(" ")}
    >
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
        <img
          src={image.src}
          alt={image.alt}
          className={`aspect-[4/3] h-full w-full ${image.fit === "contain" ? "object-contain" : "object-cover"}`}
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}

export default function SessionLandingPage({
  content,
}: {
  content: SessionLandingContent;
}) {
  const prefersReducedMotion = useReducedMotion();
  const styles = themeStyles[content.theme];

  return (
    <div className="relative">
      <section className="relative overflow-hidden border-b border-white/8">
        <div className="absolute inset-0">
          <div className={`absolute -left-24 top-16 h-80 w-80 rounded-full blur-3xl ${styles.heroGlowPrimary}`} />
          <div className={`absolute right-0 top-0 h-[28rem] w-[28rem] rounded-full blur-3xl ${styles.heroGlowSecondary}`} />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,5,15,0.18),rgba(4,5,15,0.58))]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 py-16 sm:py-20 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div className="max-w-3xl">
              <p className={`text-[0.72rem] font-semibold uppercase tracking-[0.34em] ${styles.eyebrow}`}>
                {content.hero.eyebrow}
              </p>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
                {content.hero.title}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-white/72 sm:text-lg">
                {content.hero.subtitle}
              </p>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/58 sm:text-base">
                {content.hero.supportingLine}
              </p>
              <div className="mt-8">
                <LandingCta
                  href={content.hero.cta.href}
                  label={content.hero.cta.label}
                  theme={content.theme}
                  location={content.pageTitle}
                  title={content.hero.title}
                />
              </div>
            </div>

            <div className={["rounded-2xl border border-white/10 p-6 shadow-2xl", styles.heroPanel].join(" ")}>
              <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.3em] ${styles.eyebrow}`}>
                {content.hero.callout.eyebrow}
              </p>
              <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-white">
                {content.hero.callout.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/65">
                {content.hero.callout.description}
              </p>
            </div>
          </div>
        </div>
      </section>

      {content.sections.map((section) => {
        const imageFirst = section.imagePosition === "left";
        const hasSplit = Boolean(section.image);
        const isCentered = section.alignment === "center";
        const contentWidthClass = isCentered ? "mx-auto max-w-3xl text-center" : "min-w-0";
        const paragraphWidthClass = isCentered ? "mx-auto max-w-3xl" : "max-w-3xl";
        const bulletGridClass = section.bulletColumns === 2
          ? "mt-6 grid gap-3 sm:grid-cols-2"
          : "mt-6 space-y-3";

        return (
          <motion.section
            key={section.id}
            id={section.id}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.18 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.55, ease: "easeOut" }}
            className={`relative scroll-mt-28 border-t border-white/8 ${densityClass(content.theme, section.density)}`}
          >
            <div className="mx-auto max-w-6xl px-6">
              <div className={hasSplit ? "grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center" : ""}>
                {hasSplit && imageFirst ? <LandingImageCard image={section.image!} theme={content.theme} /> : null}

                <div className={contentWidthClass}>
                  <p className={`text-[0.72rem] font-semibold uppercase tracking-[0.34em] ${styles.sectionEyebrow}`}>
                    {section.label}
                  </p>
                  <h2 className={`mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-[2.15rem] ${isCentered ? "mx-auto" : ""}`}>
                    {section.title}
                  </h2>

                  <div className="mt-5 space-y-4">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph} className={`${paragraphWidthClass} text-sm leading-7 text-white/66 sm:text-base`}>
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  {section.statementLines?.length ? (
                    <div className={["mt-6 rounded-2xl border px-5 py-4", styles.statement, isCentered ? "mx-auto max-w-3xl" : ""].join(" ")}>
                      {section.statementLines.map((line) => (
                        <p key={line} className="text-lg font-medium tracking-[-0.03em] sm:text-xl">
                          {line}
                        </p>
                      ))}
                    </div>
                  ) : null}

                  {section.bullets?.length ? (
                    <ul className={bulletGridClass}>
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-3 text-sm leading-7 text-white/68 sm:text-base">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/70" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {section.callout ? (
                    <div className={`mt-6 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-5 ${isCentered ? "mx-auto" : ""}`}>
                      <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.3em] ${styles.eyebrow}`}>
                        {section.callout.eyebrow}
                      </p>
                      <h3 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-white">
                        {section.callout.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-white/64">
                        {section.callout.description}
                      </p>
                    </div>
                  ) : null}

                  {section.cta ? (
                    <div className={`mt-8 ${isCentered ? "flex justify-center" : ""}`}>
                      <LandingCta
                        href={section.cta.href}
                        label={section.cta.label}
                        theme={content.theme}
                        location={`${content.pageTitle}:${section.id}`}
                        title={section.title}
                      />
                    </div>
                  ) : null}
                </div>

                {hasSplit && !imageFirst ? <LandingImageCard image={section.image!} theme={content.theme} /> : null}
              </div>
            </div>
          </motion.section>
        );
      })}

      <motion.section
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.18 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.55, ease: "easeOut" }}
        className="relative border-t border-white/8 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className={["rounded-[1.75rem] border border-white/10 px-6 py-8 sm:px-8 sm:py-10", styles.ctaPanel].join(" ")}>
            <p className={`text-[0.72rem] font-semibold uppercase tracking-[0.34em] ${styles.eyebrow}`}>
              {content.finalCta.eyebrow}
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-[2.25rem]">
              {content.finalCta.title}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/66 sm:text-base">
              {content.finalCta.description}
            </p>
            <div className="mt-8">
              <LandingCta
                href={content.finalCta.cta.href}
                label={content.finalCta.cta.label}
                theme={content.theme}
                location={`${content.pageTitle}:final-cta`}
                title={content.finalCta.title}
              />
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
