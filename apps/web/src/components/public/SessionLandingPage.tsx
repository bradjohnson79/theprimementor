import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
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
    bullets?: string[];
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
  prime_body_healing: {
    eyebrow: "text-amber-200/72",
    sectionEyebrow: "text-violet-200/68",
    heroGlowPrimary: "bg-amber-400/14",
    heroGlowSecondary: "bg-violet-500/16",
    heroPanel:
      "bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_48%),linear-gradient(180deg,rgba(10,8,24,0.98),rgba(5,4,15,0.96))]",
    cta:
      "bg-gradient-to-r from-amber-400 via-violet-500 to-cyan-400 text-slate-950 hover:from-amber-300 hover:via-violet-400 hover:to-cyan-300",
    statement:
      "border-amber-300/18 bg-amber-300/8 text-amber-50",
    imageFrame:
      "bg-[radial-gradient(circle_at_top,_rgba(167,139,250,0.16),_transparent_44%),linear-gradient(180deg,rgba(10,8,24,0.98),rgba(5,4,15,0.95))]",
    ctaPanel:
      "bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_transparent_46%),linear-gradient(180deg,rgba(10,8,24,0.98),rgba(5,4,15,0.95))]",
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

function AdvancedSupportServices({
  theme,
}: {
  theme: LandingTheme;
}) {
  if (theme !== "regeneration" && theme !== "qa") {
    return null;
  }

  const pageSpecificLine = theme === "regeneration"
    ? "These advanced focus areas may be supported inside your monthly regeneration process where appropriate."
    : "These advanced services can be explored as an additional focus during your session if relevant.";
  const advancedSupportIntro = theme === "regeneration"
    ? "Optional focused work for stabilizing desired outcomes and clearing interference"
    : "Optional focused work for resolving conflict and accelerating intentional outcomes";
  const timelineDescription = theme === "regeneration"
    ? "A focused support process designed to help stabilize your intended direction and clear interference around the personal-life area you want regenerated."
    : "A focused intervention designed to help shift you out of recurring conflict patterns and into a more stable and coherent life path.";
  const timelineDetail = theme === "regeneration"
    ? "Through guided cooperation with your practitioner, disruptive cycles can be addressed so a new direction can be supported with greater clarity."
    : "Through guided cooperation with your practitioner, disruptive cycles can be neutralized and cleared, allowing a new direction to take hold with greater clarity and support.";
  const timelineIdeal = theme === "regeneration"
    ? "Ideal for stabilizing a preferred state, supporting life-area improvement, or refining your desired direction."
    : "Ideal for recurring conflicts, emotional loops, or persistent instability in key areas of life.";

  return (
    <section className="mt-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-2 text-2xl font-semibold text-white md:text-3xl">
          Advanced Support Services
        </h2>

        <p className="mb-8 text-sm text-white opacity-80">
          {advancedSupportIntro}
        </p>

        <p className="mb-6 text-xs text-white opacity-60">
          {pageSpecificLine}
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="glass-card p-6">
            <span className="text-xs uppercase tracking-wide text-white opacity-60">
              Optional Focus Area
            </span>

            <h3 className="mb-3 mt-2 text-xl font-semibold text-white">
              Timeline Rewriting
            </h3>

            <p className="text-sm text-white opacity-90">
              {timelineDescription}
            </p>

            <p className="mt-3 text-sm text-white opacity-90">
              {timelineDetail}
            </p>

            <p className="mt-3 text-sm text-white opacity-70">
              {timelineIdeal}
            </p>
          </div>

          <div className="glass-card p-6">
            <span className="text-xs uppercase tracking-wide text-white opacity-60">
              Optional Focus Area
            </span>

            <h3 className="mb-3 mt-2 text-xl font-semibold text-white">
              Manifestation Holding
            </h3>

            <p className="text-sm text-white opacity-90">
              A directed support process where your intention is stabilized and reinforced to reduce internal resistance and increase follow-through.
            </p>

            <p className="mt-3 text-sm text-white opacity-90">
              Your chosen outcome is held in a more consistent and coherent state, helping to minimize doubt cycles, emotional interference, and self-sabotage patterns.
            </p>

            <p className="mt-3 text-sm text-white opacity-70">
              Ideal for strengthening goals, maintaining focus, and aligning fully with your intended results.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function OptionalManifestationEnhancement({
  theme,
}: {
  theme: LandingTheme;
}) {
  if (theme !== "regeneration") {
    return null;
  }

  return (
    <section className="relative border-b border-white/8 py-14">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-8">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">
            Client Experiences
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-[2.15rem]">
            Regeneration and Manifestation Results
          </h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {[
              {
                quote:
                  "After my consultation, my knees dont hurt anymore walking up the stairs to our house. my work with my contemplation on my feelings have come to an end, and i feel great!",
                author: "Alice R.",
              },
              {
                quote:
                  "Within less than a week after Brad safeguarded my Manifestation, 5-figure income came to me. I'll be back for more manifestation safeguarding!",
                author: "Jess S.",
              },
              {
                quote:
                  "Ever since day one of doing the manifestation with Brad, I felt my entire body alive. Meaning, I sensed improved circulation and sensations in places where I haven't felt in an long time, such as joints and muscles. I started working out doing HIIT and I felt great. I continue to do it with no pain, just the normal muscle soreness but even that, doesn't last long. My body feels recovered for the next day and ready to do another workout.",
                author: "Yvan.",
              },
              {
                quote:
                  "I wanted to let you know that I received a check from my father's lawsuit, I have not received a check in years. I only had 27$ in my checking before that.",
                author: "Judith C.",
              },
            ].map((testimonial) => (
              <figure
                key={testimonial.author}
                className="rounded-2xl border border-cyan-200/14 bg-white/[0.045] p-5 shadow-[0_16px_42px_rgba(0,0,0,0.18)]"
              >
                <blockquote className="text-sm leading-7 text-white/72">
                  "{testimonial.quote}"
                </blockquote>
                <figcaption className="mt-4 text-sm font-semibold text-cyan-100">
                  ~ {testimonial.author}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-[1.5rem] border border-cyan-200/16 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] p-6 shadow-[0_22px_58px_rgba(0,0,0,0.24)] sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-center">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">
                Optional First-Month Add-On
              </p>
              <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-[2.15rem]">
                Additional Manifestation Request
              </h2>
              <div className="mt-5 max-w-3xl space-y-4 text-sm leading-7 text-white/66 sm:text-base">
                <p>
                  Add one additional manifestation request during your first month and include another desired outcome within the same monthly cycle.
                </p>
                <p>
                  Brad works with the extra request to help safeguard and amplify the desired manifestation while clearing anti-goals and inner interference connected to that outcome.
                </p>
                <p>
                  This optional add-on is available for the first month for +$29 CAD.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-sm font-semibold text-cyan-100">+$29 CAD for the first month</p>
              <ul className="mt-5 space-y-3">
                {[
                  "One additional manifestation request within the first monthly cycle",
                  "Safeguarding and amplification support for the extra desired outcome",
                  "Offline anti-goal clearing connected to the additional request",
                ].map((benefit) => (
                  <li key={benefit} className="flex gap-3 text-sm leading-6 text-white/72">
                    <span className="mt-1 text-cyan-100">+</span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SessionLandingPage({
  content,
  ctaHrefOverride,
  heroCtaAdjacentContent,
}: {
  content: SessionLandingContent;
  ctaHrefOverride?: string;
  heroCtaAdjacentContent?: ReactNode;
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
              {content.hero.bullets?.length ? (
                <ul className="mt-5 max-w-3xl space-y-3 text-sm leading-7 text-white/72 sm:text-base">
                  {content.hero.bullets.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-200/70" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/58 sm:text-base">
                {content.hero.supportingLine}
              </p>
              {content.theme === "regeneration" ? (
                <p className="mt-3 text-sm opacity-80">
                  $99 CAD / month. Cancel anytime. Optional first-month add-on: one additional manifestation request for +$29 CAD.
                </p>
              ) : content.theme === "qa" ? (
                <p className="mt-3 text-sm opacity-80">
                  Includes advanced support options such as Timeline Rewriting and Manifestation Holding for deeper transformation and directed outcomes.
                </p>
              ) : null}
              {heroCtaAdjacentContent ? (
                <div className="mt-8">
                  {heroCtaAdjacentContent}
                </div>
              ) : null}

              <div className={heroCtaAdjacentContent ? "mt-5" : "mt-8"}>
                <LandingCta
                  href={ctaHrefOverride ?? content.hero.cta.href}
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

      <OptionalManifestationEnhancement theme={content.theme} />

      <AdvancedSupportServices theme={content.theme} />

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
                        href={ctaHrefOverride ?? section.cta.href}
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
                href={ctaHrefOverride ?? content.finalCta.cta.href}
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
