import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  PREMIUM_REPORT_PRODUCT_KEYS,
  REPORT_PRODUCTS,
  type ReportProductKey,
} from "@wisdom/utils";
import HeroSection from "../components/hero/HeroSection";
import OverviewSection from "../components/sections/OverviewSection";
import CompactCardGrid from "../components/public/CompactCardGrid";
import TestimonialsSlider from "../components/public/TestimonialsSlider";
import SectionContentBlock from "../components/public/SectionContentBlock";
import SectionMediaPanel from "../components/public/SectionMediaPanel";
import deepDiveReportImage from "../assets/deep-dive-report.webp";
import initiatesReportImage from "../assets/initiates-report.webp";
import introductoryReportImage from "../assets/introductory-report.webp";
import mentoringCircleImage from "../assets/mentoring-circle.webp";
import thePrimeMentorLogoGold from "../assets/the-prime-mentor-logo-gold.png";
import traumaTranscendenceBookCover from "../assets/trauma-transcendence-technique-book.png";
import rayd8WellnessImage from "../assets/rayd8-bio-scalar-wellness.png";
import aetherxImage from "../assets/aetherx-3x3.png";
import regenerationMonthlyPackageImage from "../../../../images/regeneration-monthly-package.png";
import { HOME_TESTIMONIALS } from "../data/homeTestimonials";
import { trackCtaClick } from "../lib/analytics";
import {
  GUIDED_SESSION_OPTIONS,
  buildGuidedSessionBookingPath,
  formatGuidedSessionDisplayPrice,
  type GuidedSessionDurationOption,
  type GuidedSessionOption,
} from "../lib/sessionCatalog";
import {
  REGENERATION_LANDING_PATH,
} from "../lib/sessionLandingPaths";
import { ContactPublicContent } from "./ContactPublic";

interface SessionCardData {
  sessionKey: "regeneration";
  title: string;
  priceLabel: string;
  durationLabel: string;
  description: string;
  href: string;
  imageSrc: string;
  imageFit?: "cover" | "contain";
  imageClassName?: string;
}

const REGENERATION_CARD: SessionCardData = {
  sessionKey: "regeneration",
  title: "Regeneration Monthly Package",
  priceLabel: "$99.00 CAD",
  durationLabel: "Offline",
  description:
    "The Regeneration Monthly Package is a remote energy facilitation service designed to support your system over a full 30-day cycle.\n\n$99 / month recurring. Cancel anytime. This is not a one-time session. It is continuous monthly work focused on deeper integration, stabilization, and measurable internal change over time.\n\nIncludes advanced support options such as Timeline Rewriting and Manifestation Holding for deeper transformation and directed outcomes.",
  href: REGENERATION_LANDING_PATH,
  imageSrc: regenerationMonthlyPackageImage,
  imageFit: "contain",
};

interface ReportCardData {
  title: string;
  meta?: string;
  description: string;
  imageSrc: string;
  href: string;
  ctaLabel: string;
  badge?: string;
  variant?: "casual" | "premium";
}

interface SocialWidgetCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  subtext?: string;
  href: string;
  buttonLabel: string;
  children?: React.ReactNode;
}

const SERVICE_PURCHASE_NOTE = "Free account created before purchase.";

const REPORT_CARD_IMAGES: Record<ReportProductKey, string> = {
  three_questions: introductoryReportImage,
  compatibility: deepDiveReportImage,
  annual_12_month: initiatesReportImage,
  intro: introductoryReportImage,
  deep_dive: deepDiveReportImage,
  initiate: initiatesReportImage,
};

const CASUAL_REPORT_CARDS: ReportCardData[] = [
  {
    title: "Divin8 3 Questions Report",
    description:
      "Ask three meaningful questions and receive clear, focused insight through Divin8’s multi-system synthesis. Ideal for decision-making, life direction, or resolving specific concerns without committing to a full report.",
    imageSrc: "/images/Divin8 3 Questions Report.png",
    href: "/dashboard/reports/three-questions",
    ctaLabel: "Ask Your 3 Questions",
    badge: "Quick Insight",
    variant: "casual",
  },
  {
    title: "Divin8 Partner Compatibility Report",
    description:
      "Explore the deeper dynamic between you and another person. This report reveals strengths, challenges, communication patterns, and long-term compatibility across romantic, business, or personal relationships.",
    imageSrc: "/images/Divin8 Partner Compatibility Report.png",
    href: "/dashboard/reports/compatibility",
    ctaLabel: "Check Compatibility",
    badge: "Quick Insight",
    variant: "casual",
  },
  {
    title: "Divin8 12 Month Annual Report",
    description:
      "See what the next 12 months have in store. This report maps out your upcoming cycles, opportunities, and challenges so you can move forward with clarity and timing on your side.",
    imageSrc: "/images/Divin8 12 Month Annual Report.png",
    href: "/dashboard/reports/annual-12-month",
    ctaLabel: "View Your Year Ahead",
    badge: "Quick Insight",
    variant: "casual",
  },
];

const EVENT_ITEMS = [
  {
    title: "Mentoring Circle Monthly",
    description:
      "Register for our Mentoring Circle Webinar for the opportunity to have your blueprint explored and receive deeper teachings through Prime Mentoring.",
    cta: { label: "Register", href: "/events/mentoring-circle", external: false },
    ctaNote: SERVICE_PURCHASE_NOTE,
  },
  {
    title: "Prime Mentor Podcast",
    description:
      "Join our free weekly podcast where Brad Johnson takes personal questions by donation and addresses a broad range of spiritual topics.",
    cta: {
      label: "View Channel",
      href: "https://www.youtube.com/channel/UCQeHcVNo6CPWpgJaqEObrqA",
      external: true,
    },
  },
];

const LINK_ITEMS = [
  {
    title: "Trauma Transcendence Technique Book",
    description: "A comprehensive guide to moving beyond stored trauma using precision breathwork and somatic practices.",
    imageSrc: traumaTranscendenceBookCover,
    imageAlt: "Trauma Transcendence Technique book cover",
    cta: {
      label: "View on Amazon",
      href: "https://a.co/d/0962vuVE",
      external: true,
    },
  },
  {
    title: "RAYD8",
    description:
      "RAYD8, created by Brad Johnson, is the world's first Bio-Scalar Digital Wellness system that is designed to charge your cells delivering full body rejuvenation.",
    imageSrc: rayd8WellnessImage,
    imageAlt: "RAYD8 Bio-Scalar Digital Wellness system",
    cta: {
      label: "Visit Website",
      href: "https://www.rayd8app.com",
      external: true,
    },
  },
  {
    title: "AetherX",
    description:
      "AetherX offers a variety of imbued bio-scalar and radiantly charged technologies ideal for personal and environmental rejuvenation.",
    imageSrc: aetherxImage,
    imageAlt: "AetherX logo with multicolor circular arcs",
    cta: {
      label: "Visit Website",
      href: "https://www.aetherx.co",
      external: true,
    },
  },
];

const ABOUT_ITEMS = [
  {
    title: "Integrated Disciplines",
    description: "Built on decades of study across Vedic astrology, numerology, Human Design, Chinese astrology, Kabbalah, and runic systems.",
  },
  {
    title: "Practical Guidance",
    description: "Every session, report, and feature is designed to convert insight into grounded direction, timing, and next steps.",
  },
];

const PRIME_MENTOR_FACEBOOK_URL = "https://www.facebook.com/primementorfacebook";
const PRIME_MENTOR_YOUTUBE_URL = "https://www.youtube.com/channel/UCQeHcVNo6CPWpgJaqEObrqA";
const PRIME_MENTOR_YOUTUBE_FEATURED_VIDEO_URL = "https://www.youtube.com/embed/Gs_LDlzSwEw?rel=0&modestbranding=1";
const TRAUMA_TRANSCENDENCE_COURSE_BANNER_SRC = "/images/Trauma-Transcendence-Technique-banner.png";

interface LandingSectionProps {
  id: string;
  children: React.ReactNode;
}

function LandingSection({ id, children }: LandingSectionProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.section
      id={id}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.55, ease: "easeOut" }}
      className="relative scroll-mt-28 border-t border-white/8 py-12 sm:py-16"
    >
      <div className="mx-auto max-w-6xl space-y-8 px-6">
        {children}
        <InlineBackToTop />
      </div>
    </motion.section>
  );
}

function InfoTooltip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onBlur={() => setOpen(false)}
        className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-cyan-200/25 bg-cyan-300/10 text-[0.7rem] font-semibold text-cyan-100 transition hover:border-cyan-200/45 hover:bg-cyan-300/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/45"
      >
        ?
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 top-full z-20 mt-3 w-72 -translate-x-1/2 rounded-2xl border border-white/12 bg-slate-950/95 p-4 text-left text-xs leading-6 text-white/78 shadow-2xl backdrop-blur-xl transition duration-150 ${
          open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
        } sm:group-hover:translate-y-0 sm:group-hover:opacity-100`}
      >
        {text}
      </span>
    </span>
  );
}

function GuidedSessionTypeRadio({
  option,
  active,
  onSelect,
}: {
  option: GuidedSessionOption;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`group relative flex cursor-pointer gap-4 rounded-2xl border p-4 transition duration-200 ${
        active
          ? "border-cyan-200/45 bg-cyan-300/10 shadow-[0_0_34px_rgba(34,211,238,0.12)]"
          : "border-white/10 bg-white/[0.04] hover:border-white/22 hover:bg-white/[0.06]"
      }`}
    >
      <input
        type="radio"
        name="guided-session-type"
        checked={active}
        onChange={onSelect}
        className="mt-1 h-5 w-5 border-white/30 bg-transparent text-cyan-300 focus:ring-cyan-300/40"
      />
      <span className="min-w-0">
        <span className="flex items-center text-base font-semibold text-white">
          {option.label}
          <InfoTooltip label={option.label} text={option.tooltip} />
        </span>
        <span className="mt-2 block text-sm leading-6 text-white/60">{option.description}</span>
      </span>
    </label>
  );
}

function GuidedDurationRadio({
  duration,
  active,
  onSelect,
}: {
  duration: GuidedSessionDurationOption;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition duration-200 ${
        active
          ? "border-amber-200/55 bg-amber-200/10 text-white"
          : "border-white/10 bg-white/[0.04] text-white/72 hover:border-white/22 hover:text-white"
      }`}
    >
      <span className="flex items-center gap-3">
        <input
          type="radio"
          name="guided-session-duration"
          checked={active}
          onChange={onSelect}
          className="h-5 w-5 border-white/30 bg-transparent text-amber-200 focus:ring-amber-200/40"
        />
        <span className="font-medium">{duration.minutes} Minutes</span>
      </span>
      <span className="text-sm font-semibold tabular-nums text-amber-100/90">
        {formatGuidedSessionDisplayPrice(duration)}
      </span>
    </label>
  );
}

function GuidedSessionSummary({
  option,
  duration,
}: {
  option: GuidedSessionOption;
  duration: GuidedSessionDurationOption;
}) {
  return (
    <aside className="rounded-3xl border border-white/12 bg-white/[0.055] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition duration-200">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/62">Your Session</p>
      <dl className="mt-5 space-y-4 text-sm">
        <div>
          <dt className="text-white/45">Session Type:</dt>
          <dd className="mt-1 text-base font-semibold text-white">{option.label}</dd>
        </div>
        <div>
          <dt className="text-white/45">Duration:</dt>
          <dd className="mt-1 text-base font-semibold text-white">{duration.minutes} Minutes</dd>
        </div>
        <div>
          <dt className="text-white/45">Price:</dt>
          <dd className="mt-1 text-base font-semibold text-amber-100">{formatGuidedSessionDisplayPrice(duration)}</dd>
        </div>
      </dl>
    </aside>
  );
}

function GuidedPrivateSessionsCard() {
  const { isSignedIn } = useAuth();
  const [selectedIntakeType, setSelectedIntakeType] = useState<GuidedSessionOption["intakeType"]>("qa");
  const [selectedBookingTypeId, setSelectedBookingTypeId] = useState("qa-session-30");
  const selectedOption = GUIDED_SESSION_OPTIONS.find((option) => option.intakeType === selectedIntakeType)
    ?? GUIDED_SESSION_OPTIONS[0];
  const selectedDuration = selectedOption.durations.find((duration) => duration.bookingTypeId === selectedBookingTypeId)
    ?? selectedOption.durations[0];
  const bookingPath = buildGuidedSessionBookingPath({
    intakeType: selectedOption.intakeType,
    minutes: selectedDuration.minutes,
    bookingTypeId: selectedDuration.bookingTypeId,
  });
  const proceedHref = isSignedIn ? bookingPath : `/sign-up?redirect_url=${encodeURIComponent(bookingPath)}`;
  const helperText = useMemo(
    () => (isSignedIn ? "Next step: Session Intake" : "Next step: Sign-up or Login"),
    [isSignedIn],
  );

  function selectOption(option: GuidedSessionOption) {
    setSelectedIntakeType(option.intakeType);
    setSelectedBookingTypeId(option.durations[0].bookingTypeId);
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.13),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_40%)]" />
      <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <div className="space-y-7">
          <div className="space-y-3">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.34em] text-cyan-100/62">Guided Sessions</p>
            <h3 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Guided Private Sessions</h3>
            <p className="max-w-2xl text-sm leading-7 text-white/62 sm:text-base">
              Choose the session path that best supports your current needs.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-white/80">Step 1 — Choose Session Type</p>
              <p className="mt-1 text-xs text-white/45">Door one or door two. We will guide the rest.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {GUIDED_SESSION_OPTIONS.map((option) => (
                <GuidedSessionTypeRadio
                  key={option.intakeType}
                  option={option}
                  active={selectedOption.intakeType === option.intakeType}
                  onSelect={() => selectOption(option)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-white/80">Step 2 — Choose Duration</p>
              <p className="mt-1 text-xs text-white/45">Pricing updates with the selected session length.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {selectedOption.durations.map((duration) => (
                <GuidedDurationRadio
                  key={duration.bookingTypeId}
                  duration={duration}
                  active={selectedDuration.bookingTypeId === duration.bookingTypeId}
                  onSelect={() => setSelectedBookingTypeId(duration.bookingTypeId)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <Link
              to={proceedHref}
              onClick={() => trackCtaClick("proceed_guided_session", "home_sessions", {
                session: selectedOption.label,
                bookingTypeId: selectedDuration.bookingTypeId,
                minutes: selectedDuration.minutes,
                href: proceedHref,
              })}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_45px_rgba(34,211,238,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-cyan-200 sm:w-auto sm:min-w-48"
            >
              Proceed
            </Link>
            <p className="text-sm text-white/45">{helperText}</p>
          </div>
        </div>

        <GuidedSessionSummary option={selectedOption} duration={selectedDuration} />
      </div>
    </div>
  );
}

function SessionCard({
  sessionKey,
  title,
  priceLabel,
  durationLabel,
  description,
  href,
  imageSrc,
  imageFit,
  imageClassName,
}: SessionCardData) {
  const bookingHref = `${href}/book`;
  const primaryCtaLabel = sessionKey === "regeneration" ? "Begin Cycle" : "Book Session";

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:grid sm:grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)] sm:items-center sm:gap-5 sm:p-5 lg:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)]">
      <div className="aspect-square w-full shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5 sm:max-w-[20rem]">
        <img
          src={imageSrc}
          alt={title}
          className={`h-full w-full ${imageFit === "contain" ? "object-contain p-1" : "object-cover"} ${imageClassName ?? ""}`}
          loading="lazy"
          decoding="async"
        />
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 sm:mt-0">
        <div className="space-y-1.5">
          <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug tracking-tight text-white">
            {title}
          </h3>
          <p className="text-xs font-medium tabular-nums tracking-wide text-cyan-100/85">
            {[priceLabel, durationLabel].filter(Boolean).join(" · ")}
          </p>
        </div>

        <p className="flex-1 whitespace-pre-line text-sm leading-relaxed text-white/60">{description}</p>

        <div className="mt-auto flex flex-col gap-2 sm:flex-row">
          <Link
            to={bookingHref}
            onClick={() => trackCtaClick("book_session", "home_sessions", {
              session: title,
              href: bookingHref,
            })}
            className="flex-1 rounded-md bg-white/10 py-2.5 text-center text-sm font-medium text-white transition hover:bg-white/20"
          >
            {primaryCtaLabel}
          </Link>
          <Link
            to={href}
            onClick={() => trackCtaClick("learn_more", "home_sessions", {
              session: title,
              href,
            })}
            className="flex-1 rounded-md border border-white/10 bg-transparent py-2.5 text-center text-sm font-medium text-white/80 transition hover:bg-white/8 hover:text-white"
          >
            Learn More
          </Link>
        </div>
        <p className="mt-2 text-center text-xs text-white/55">{SERVICE_PURCHASE_NOTE}</p>
      </div>
    </div>
  );
}

function ReportCard({ title, meta, description, imageSrc, href, ctaLabel, badge, variant = "premium" }: ReportCardData) {
  const variantClasses = variant === "casual"
    ? "border-cyan-200/18 shadow-[0_18px_48px_rgba(34,211,238,0.08)] hover:border-cyan-200/28 hover:shadow-[0_22px_56px_rgba(34,211,238,0.13)]"
    : "border-amber-200/16 shadow-[0_18px_48px_rgba(251,191,36,0.08)] hover:border-amber-200/28 hover:shadow-[0_22px_56px_rgba(251,191,36,0.14)]";
  return (
    <div className={`flex h-full flex-col rounded-xl border bg-white/[0.03] p-4 transition duration-300 ${variantClasses}`}>
      <div className="mx-auto shrink-0 aspect-square w-full max-w-[10.08rem] overflow-hidden rounded-lg border border-white/10 bg-white/5 sm:max-w-[10.8rem]">
        <img
          src={imageSrc}
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 text-left">
        <div className="space-y-1">
          {badge ? (
            <span className="inline-flex rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
              {badge}
            </span>
          ) : null}
          <h3 className="text-base font-semibold leading-snug tracking-tight text-white">{title}</h3>
          {meta ? <p className="text-xs font-medium tabular-nums text-cyan-100/85">{meta}</p> : null}
        </div>
        <p className="flex-1 text-sm leading-relaxed text-white/60 whitespace-pre-line">{description}</p>
      </div>

      <Link
        to={href}
        onClick={() => trackCtaClick("buy_report", "home_reports", { href, title })}
        className="mt-4 shrink-0 rounded-md bg-white/10 py-2 text-center text-sm text-white transition hover:bg-white/20"
      >
        {ctaLabel}
      </Link>
      <p className="mt-2 text-center text-xs text-white/55">{SERVICE_PURCHASE_NOTE}</p>
    </div>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M13.5 21v-7h2.3l.4-3h-2.7V9.1c0-.9.3-1.5 1.6-1.5H16V4.9c-.5-.1-1.4-.2-2.4-.2-2.4 0-4 1.5-4 4.2V11H7v3h2.5v7h4Z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M23 12s0-3.2-.4-4.7a3 3 0 0 0-2.1-2.1C19 4.8 12 4.8 12 4.8s-7 0-8.5.4a3 3 0 0 0-2.1 2.1C1 8.8 1 12 1 12s0 3.2.4 4.7a3 3 0 0 0 2.1 2.1c1.5.4 8.5.4 8.5.4s7 0 8.5-.4a3 3 0 0 0 2.1-2.1C23 15.2 23 12 23 12Zm-14 3.9V8.1l6.2 3.9L9 15.9Z" />
    </svg>
  );
}

function SocialWidgetCard({
  icon,
  title,
  description,
  subtext,
  href,
  buttonLabel,
  children,
}: SocialWidgetCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.26)] backdrop-blur-xl transition duration-300 hover:scale-[1.02] hover:border-cyan-300/22 hover:shadow-[0_22px_58px_rgba(0,0,0,0.32),0_0_32px_rgba(99,102,241,0.14)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.14),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-px rounded-[calc(1rem-1px)] border border-white/7 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))]" />
      <div className="pointer-events-none absolute -inset-px rounded-2xl bg-[linear-gradient(135deg,rgba(56,189,248,0.3),rgba(168,85,247,0.24),rgba(56,189,248,0.18))] opacity-20 blur-xl transition duration-300 group-hover:opacity-45" />

      <div className="relative flex h-full flex-col gap-5">
        <div className="space-y-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-cyan-100 shadow-[0_0_24px_rgba(56,189,248,0.12)]">
            {icon}
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">{title}</h3>
            <p className="max-w-xl text-sm leading-7 text-white/60">{description}</p>
            {subtext ? <p className="text-sm font-medium text-cyan-100/72">{subtext}</p> : null}
          </div>
        </div>

        {children ? <div className="relative">{children}</div> : null}

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="relative mt-auto inline-flex w-full items-center justify-center overflow-hidden rounded-xl border border-cyan-200/18 bg-[linear-gradient(135deg,rgba(56,189,248,0.18),rgba(168,85,247,0.18))] px-4 py-3 text-sm font-medium text-white shadow-[0_0_24px_rgba(99,102,241,0.16)] transition duration-300 hover:border-cyan-200/28 hover:shadow-[0_0_32px_rgba(99,102,241,0.28)]"
        >
          <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(56,189,248,0.18),rgba(168,85,247,0.22),rgba(56,189,248,0.12))] opacity-90" />
          <span className="relative">{buttonLabel}</span>
        </a>
      </div>
    </div>
  );
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function InlineBackToTop() {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={scrollToTop}
        className="inline-flex items-center gap-2 text-sm text-white/60 opacity-80 transition hover:text-white hover:opacity-100"
      >
        <span aria-hidden="true">↑</span>
        <span>Back to Top</span>
      </button>
    </div>
  );
}

export default function Home() {
  const [showFloatingBackToTop, setShowFloatingBackToTop] = useState(false);
  const premiumReportItems: ReportCardData[] = PREMIUM_REPORT_PRODUCT_KEYS.map((key) => ({
    title: REPORT_PRODUCTS[key].displayName,
    meta: "Premium Report",
    description: REPORT_PRODUCTS[key].shortDescription,
    imageSrc: REPORT_CARD_IMAGES[key],
    href: REPORT_PRODUCTS[key].orderPath,
    ctaLabel: REPORT_PRODUCTS[key].ctaLabel,
    badge: "Full Analysis",
    variant: "premium",
  }));

  useEffect(() => {
    function handleScroll() {
      setShowFloatingBackToTop(window.scrollY > 640);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="home-front-page relative text-white">
      <HeroSection />

      <section id="sessions" className="relative scroll-mt-28 border-t border-white/8 py-12 sm:py-16">
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="space-y-8 text-left">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-white/40">Sessions</p>

              <h2 className="max-w-3xl text-3xl font-semibold text-white">Guided sessions and processes for grounded transformation</h2>

              <p className="max-w-2xl text-white/60">
                Each session is designed to meet you where you are—whether you need clarity, recalibration, or deeper
                integration across your life path.
              </p>
            </div>

            <div className="space-y-6">
              <GuidedPrivateSessionsCard />
              <SessionCard {...REGENERATION_CARD} />
            </div>
            <InlineBackToTop />
          </div>
        </div>
      </section>

      <LandingSection id="reports">
        <div className="space-y-8 text-left">
          <div className="space-y-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">Reports</p>
            <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-white">
              Detailed life reports that remove guesswork
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
              Divin8 Reports bring astrology, numerology, compatibility, forecasts, and metaphysical systems into clear
              written guidance for timing, relationships, and personal direction.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Divin8 Reports", "Astrology Reports", "Numerology Reports", "Compatibility Reports", "Forecast Reports", "Metaphysical Reports"].map((label) => (
                <span key={label} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                  {label}
                </span>
              ))}
            </div>
            <Link
              to="/reports"
              onClick={() => trackCtaClick("view_reports", "home_reports", { href: "/reports", title: "Divin8 Reports" })}
              className="inline-flex rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5"
            >
              View All Reports
            </Link>
          </div>

          <div className="space-y-10">
            <div className="space-y-4">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-cyan-200/62">Casual Reports</p>
                <p className="mt-1 text-sm text-white/50">Focused insights for immediate clarity</p>
              </div>
              <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {CASUAL_REPORT_CARDS.map((report) => (
                  <ReportCard key={report.title} {...report} />
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 pt-8">
              <div className="mb-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-amber-100/62">Premium Reports</p>
                <p className="mt-1 text-sm text-white/50">Deep, comprehensive life synthesis</p>
              </div>
              <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {premiumReportItems.map((report) => (
                  <ReportCard key={report.title} {...report} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </LandingSection>

      <OverviewSection />

      <LandingSection id="courses">
        <div className="grid items-center gap-6 text-left lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <SectionMediaPanel
            eyebrow="Courses"
            title="Trauma Transcendence Technique"
            description="A guided 10-day e-course for release, realignment, and inner transformation."
            imageSrc={TRAUMA_TRANSCENDENCE_COURSE_BANNER_SRC}
            imageAlt="Trauma Transcendence Technique e-course banner"
            imageHd169Frame
            className="min-h-[19rem]"
          />

          <SectionContentBlock
            label="Courses"
            title="Begin Your Transformation — Free Access"
            description="Create your free Prime Mentor account and unlock the Trauma Transcendence Technique — a powerful 10-day e-course designed to help you release, realign, and rise into a new state of being."
          >
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/62">With your free dashboard, you can:</p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-white/68 sm:text-base">
                  <li><strong className="font-semibold text-white">Access the full 10-day Trauma Transcendence Technique E-Course</strong></li>
                  <li>Book personalized mentoring sessions and begin regeneration cycles</li>
                  <li>Order advanced Divin8 reports and insights</li>
                  <li>Register for exclusive events like the Mentoring Circle</li>
                  <li>View and manage your session recordings anytime</li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="max-w-2xl text-sm leading-7 text-white/68 sm:text-base">
                  This is your starting point. Your gateway into clarity, expansion, and true internal freedom.
                </p>
                <p className="max-w-2xl text-sm leading-7 text-white/68 sm:text-base">
                  Create your free account and step into your next level.
                </p>
              </div>

              <div className="pt-1">
                <Link
                  to="/sign-up"
                  onClick={() => trackCtaClick("create_free_account", "home_courses", {
                    href: "/sign-up",
                    title: "Trauma Transcendence Technique",
                  })}
                  className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Create Your Free Account
                </Link>
              </div>
            </div>
          </SectionContentBlock>
        </div>
      </LandingSection>

      <LandingSection id="events">
        <div className="grid items-center gap-6 text-left lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
          <SectionMediaPanel
            eyebrow="Events"
            title="Live Field"
            description="Ongoing touchpoints that keep the ecosystem relational, current, and alive."
            imageSrc={mentoringCircleImage}
            imageAlt="The Mentoring Circle, last Sunday of each month — The Prime Mentor, Brad Johnson"
            imageHd169Frame
            className="min-h-[19rem]"
          />

          <SectionContentBlock
            label="Events"
            title="Monthly Webinar & Live Weekly Podcast"
            description="Join us every Wednesday on YouTube live for the Prime Mentor Podcast. Register for our monthly Mentoring Circle held on the last Sunday of every month."
          >
            <CompactCardGrid
              items={EVENT_ITEMS.map((item) => item.cta ? {
                ...item,
                cta: {
                  ...item.cta,
                  onClick: () => trackCtaClick(item.cta?.label ?? "cta_click", "home_events", {
                    href: item.cta?.href,
                    title: item.title,
                  }),
                },
              } : item)}
              columns={2}
            />
          </SectionContentBlock>
        </div>
      </LandingSection>

      <section className="w-full border-t border-white/8 px-6 py-16">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mb-6 text-2xl font-semibold text-white md:text-3xl">Stay Informed through our Newsletter</h2>

          <form
            method="post"
            action="https://www.aweber.com/scripts/addlead.pl"
            className="flex flex-col items-center justify-center gap-4 md:flex-row"
          >
            <input type="hidden" name="meta_web_form_id" value="621412772" />
            <input type="hidden" name="listname" value="awlist6949357" />
            <input
              type="hidden"
              name="redirect"
              value="https://www.aweber.com/thankyou-coi.htm?m=text"
            />
            <input type="hidden" name="meta_required" value="name,email" />
            <input type="hidden" name="meta_adtracking" value="Prime_Mentor_Subscription" />

            <input
              type="text"
              name="name"
              placeholder="Your Name"
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 transition focus:border-cyan-400 focus:outline-none md:w-1/3"
            />

            <input
              type="email"
              name="email"
              placeholder="Your Email"
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 transition focus:border-cyan-400 focus:outline-none md:w-1/3"
            />

            <button
              type="submit"
              className="w-full rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-black transition hover:bg-cyan-400 md:w-auto"
            >
              Subscribe
            </button>
          </form>

          <p className="mt-4 text-sm text-white/50">We respect your email privacy.</p>
          <div className="mt-8 flex justify-end">
            <InlineBackToTop />
          </div>
        </div>
      </section>

      <section id="testimonials" className="relative scroll-mt-28 border-t border-white/8 py-16">
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="space-y-8 text-left">
            <div className="space-y-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">Testimonials</p>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-white">
                Feedback from our Clients
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Real reflections from people who have stepped into the work—exploring blueprint insight, Divin8, sessions,
                and the wider Prime Mentor ecosystem.
              </p>
            </div>

            <TestimonialsSlider items={HOME_TESTIMONIALS} className="pt-1" />
            <InlineBackToTop />
          </div>
        </div>
      </section>

      <LandingSection id="links">
        <div className="space-y-8 text-left">
          <div className="space-y-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">Links</p>
            <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-white">
              Explore more of Brad&apos;s Projects...
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
              These projects deepen the system from different angles: trauma work, live astrological intelligence, and
              future-forward platforms for consciousness and application.
            </p>
          </div>

          <CompactCardGrid items={LINK_ITEMS} columns={3} />
        </div>
      </LandingSection>

      <LandingSection id="about">
        <div className="grid items-center gap-6 text-left lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
          <SectionMediaPanel
            eyebrow="About"
            title="The Prime Mentor"
            description="Ancient systems synthesized into one coherent and actionable framework."
            imageSrc={thePrimeMentorLogoGold}
            imageAlt="The Prime Mentor Brad Johnson gold logo"
            imageFrameClassName="flex items-center justify-center"
            imageClassName="!object-contain p-3"
            className="min-h-[19rem]"
          >
            <div className="absolute bottom-6 right-6 z-20 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.28em] text-white/62 backdrop-blur-md">
              Brad Johnson
            </div>
          </SectionMediaPanel>

          <SectionContentBlock
            label="About"
            title="Precise Mentoring with Full Circle Knowledge"
            description="The Prime Mentor works with calculation, precision and practicality. The methods used by its founder, Brad Johnson, offer a profound complete system that aids you in helping you to not only discover vital life themes, but how to develop your mind into profound states that have been kept from modern spiritual integration."
          >
            <CompactCardGrid items={ABOUT_ITEMS} columns={2} />
          </SectionContentBlock>
        </div>
      </LandingSection>

      <section id="social" className="relative scroll-mt-28 border-t border-white/8 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="space-y-8">
            <div className="space-y-3 text-left">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">Social</p>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-white">
                Follow the live stream of the work
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Stay connected through social channels for ongoing transmissions, fresh teachings, and real-time updates
                from the Prime Mentor field.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SocialWidgetCard
                icon={<FacebookIcon />}
                title="Prime Mentor on Facebook"
                description="Conscious insight, mentorship, and live transmissions"
                subtext="Join hundreds following the Prime Mentor journey"
                href={PRIME_MENTOR_FACEBOOK_URL}
                buttonLabel="Follow on Facebook"
              >
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4">
                  <img
                    src={thePrimeMentorLogoGold}
                    alt="The Prime Mentor logo"
                    className="mx-auto h-auto max-h-56 w-full object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </SocialWidgetCard>

              <SocialWidgetCard
                icon={<YouTubeIcon />}
                title="Prime Mentor on YouTube"
                description="Latest transmissions, live conversations, and archived teachings from the channel."
                href={PRIME_MENTOR_YOUTUBE_URL}
                buttonLabel="Subscribe on YouTube"
              >
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="aspect-video">
                    <iframe
                      className="h-full w-full"
                      src={PRIME_MENTOR_YOUTUBE_FEATURED_VIDEO_URL}
                      title="The Prime Mentor featured YouTube video"
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                </div>
              </SocialWidgetCard>
            </div>
            <InlineBackToTop />
          </div>
        </div>
      </section>

      <section id="contact" className="relative scroll-mt-28 border-t border-white/8 py-16 text-white">
        <div className="mx-auto max-w-2xl space-y-8">
          <ContactPublicContent headingAs="h2" />
          <div className="px-6">
            <InlineBackToTop />
          </div>
        </div>
      </section>

      <footer className="relative border-t border-white/8 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-5 px-6 text-left sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-white/80">The Prime Mentor</p>
            <p className="mt-1 text-xs text-white/42">&copy; {new Date().getFullYear()} Brad Johnson. All rights reserved.</p>
          </div>
          <div className="flex items-center gap-5 text-xs text-white/52">
            <Link to="/privacy" className="transition hover:text-white/82">Privacy</Link>
            <Link to="/terms" className="transition hover:text-white/82">Terms</Link>
            <Link to="/contact" className="transition hover:text-white/82">Contact</Link>
          </div>
        </div>
      </footer>
      {showFloatingBackToTop ? (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            type="button"
            onClick={scrollToTop}
            className="rounded-full border border-white/15 bg-white/10 p-3 text-white/80 shadow-[0_12px_36px_rgba(0,0,0,0.28)] backdrop-blur transition hover:bg-white/20 hover:text-white"
            aria-label="Back to top"
          >
            ↑
          </button>
        </div>
      ) : null}
    </div>
  );
}
