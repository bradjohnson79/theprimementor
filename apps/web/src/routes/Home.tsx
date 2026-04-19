import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  REPORT_TIER_DEFINITIONS,
  REPORT_TIER_ORDER,
  divin8ReportTierListPrice,
  MEMBER_PRICING,
} from "@wisdom/utils";
import HeroSection from "../components/hero/HeroSection";
import OverviewSection from "../components/sections/OverviewSection";
import CompactCardGrid from "../components/public/CompactCardGrid";
import TestimonialsSlider from "../components/public/TestimonialsSlider";
import SectionContentBlock from "../components/public/SectionContentBlock";
import SectionMediaPanel from "../components/public/SectionMediaPanel";
import focusSessionImage from "../assets/focus-session.webp";
import deepDiveReportImage from "../assets/deep-dive-report.webp";
import initiateMembershipImage from "../assets/initiate-membership.webp";
import initiatesReportImage from "../assets/initiates-report.webp";
import introductoryReportImage from "../assets/introductory-report.webp";
import mentoringCircleImage from "../assets/mentoring-circle.webp";
import mentoringSessionImage from "../assets/mentoring-session.webp";
import regenerationSessionImage from "../assets/regeneration-session.webp";
import seekerMembershipImage from "../assets/seeker-membership.webp";
import thePrimeMentorLogoGold from "../assets/the-prime-mentor-logo-gold.png";
import traumaTranscendenceBookCover from "../assets/trauma-transcendence-technique-book.png";
import rayd8WellnessImage from "../assets/rayd8-bio-scalar-wellness.png";
import aetherxImage from "../assets/aetherx-3x3.png";
import { HOME_TESTIMONIALS } from "../data/homeTestimonials";
import { trackCtaClick } from "../lib/analytics";
import {
  FOCUS_LANDING_PATH,
  MENTORING_LANDING_PATH,
  REGENERATION_LANDING_PATH,
} from "../lib/sessionLandingPaths";
import { ContactPublicContent } from "./ContactPublic";

interface SessionCardData {
  title: string;
  priceLabel: string;
  description: string;
  href: string;
  imageSrc: string;
}

const SESSION_CARDS: SessionCardData[] = [
  {
    title: "Regeneration Session",
    priceLabel: "$99.00 CAD",
    description:
      "This is an offline session that aligns you into a state of wellness where you feel the effects of previous ailments become released. The Regeneration Session offers a 7 day span of priority email support that helps you to maintain an aligned 'prime' state of being. Custom-made exercises are created based on natal charts through our Divin8 engine designed to help you hold a particular feeling in alignment. Through this feeling and familiarity of it, you remain in a wellness state while shifting yourself into a Delta Brainwave phase. The Regeneration Session transcends healing and moves you into alignment removing old habits and behavioral patterns from your system as you enter a prime state of wellness.",
    href: REGENERATION_LANDING_PATH,
    imageSrc: regenerationSessionImage,
  },
  {
    title: "Focus Session",
    priceLabel: "$199.00 CAD",
    description:
      "A 45 minute interaction where Brad will prepare you for your intended state through a Divin8 Synthesis report. Brad will share insights on your current alignment in life, and how to align your mind's state of being. Whether you're navigating a decision, facing a challenge, or seeking direction, this session isolates the core pattern and brings it into sharp focus. You'll leave with clear, actionable insight and a grounded understanding of your next steps—cutting through confusion and helping you move forward with confidence and intention. The session works to clear stagnation, restore balance, and reconnect you to your natural state of flow—leaving you feeling lighter, clearer, and more internally supported.",
    href: FOCUS_LANDING_PATH,
    imageSrc: focusSessionImage,
  },
  {
    title: "Mentoring Session",
    priceLabel: "$299.00 CAD",
    description:
      "A comprehensive session that works across multiple layers of your blueprint to support deeper transformation and long-term growth. This is the most complete session of the 3 as Brad works with you 1 to 1 exploring your natal charts and metaphysical information overview through the Divin8 system. This is where patterns are not just identified—but understood, integrated, and evolved. This session focuses on setting a goal, neutralizing all setbacks towards that goal, and teaching you how to enter Prime Mind: Harmony with your preferred state of being. The Mentoring session is an interaction designed for those ready to go further; this session provides structured guidance, expanded awareness, and aligned direction—supporting real, sustained movement forward on your path.",
    href: MENTORING_LANDING_PATH,
    imageSrc: mentoringSessionImage,
  },
];

interface MembershipCardData {
  title: string;
  meta: string;
  description: string;
  imageSrc: string;
  href: string;
}

interface ReportCardData {
  title: string;
  meta: string;
  description: string;
  imageSrc: string;
  href: string;
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

const MEMBERSHIP_CARDS: MembershipCardData[] = [
  {
    title: "Seeker Membership",
    meta: MEMBER_PRICING.seeker.monthly.label,
    description:
      "Explore our starter membership subscription as you access our Divin8 Universal Knowledge System with a 150 prompt monthly limit.",
    imageSrc: seekerMembershipImage,
    href: "/subscriptions/seeker",
  },
  {
    title: "Initiate Membership",
    meta: MEMBER_PRICING.initiate.monthly.label,
    description:
      "Dive into our complete membership subscription as you access the Divin8 Universal Knowledge System with unlimited prompt usage, free access to our monthly Mentoring Circle, and eligibility for our Mentoring Packages after completing a single Mentoring Session.",
    imageSrc: initiateMembershipImage,
    href: "/subscriptions/initiate",
  },
];

const REPORT_CARD_IMAGES: Record<"intro" | "deep_dive" | "initiate", string> = {
  intro: introductoryReportImage,
  deep_dive: deepDiveReportImage,
  initiate: initiatesReportImage,
};

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
      className="relative scroll-mt-28 border-t border-white/8 py-16"
    >
      <div className="mx-auto max-w-6xl space-y-8 px-6">
        {children}
        <InlineBackToTop />
      </div>
    </motion.section>
  );
}

function SessionCard({ title, priceLabel, description, href, imageSrc }: SessionCardData) {
  const bookingHref = `${href}/book`;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <div className="aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <img
          src={imageSrc}
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
        <div className="space-y-1.5">
          <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug tracking-tight text-white">
            {title}
          </h3>
          <p className="text-xs font-medium tabular-nums tracking-wide text-cyan-100/85">{priceLabel}</p>
        </div>

        <p className="flex-1 text-sm leading-relaxed text-white/60">{description}</p>

        <div className="mt-auto flex flex-col gap-2 sm:flex-row">
          <Link
            to={bookingHref}
            onClick={() => trackCtaClick("book_session", "home_sessions", {
              session: title,
              href: bookingHref,
            })}
            className="flex-1 rounded-md bg-white/10 py-2.5 text-center text-sm font-medium text-white transition hover:bg-white/20"
          >
            Book Session
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

function MembershipCard({ title, meta, description, imageSrc, href }: MembershipCardData) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mx-auto w-1/2 max-w-[12rem] shrink-0 aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/5">
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
          <h3 className="text-base font-semibold leading-snug tracking-tight text-white">{title}</h3>
          <p className="text-xs font-medium tabular-nums text-cyan-100/85">{meta}</p>
        </div>
        <p className="flex-1 text-sm leading-relaxed text-white/60">{description}</p>
      </div>

      <Link
        to={href}
        onClick={() => trackCtaClick("sign_up", "home_subscriptions", { href, title })}
        className="mt-4 shrink-0 rounded-md bg-white/10 py-2 text-center text-sm text-white transition hover:bg-white/20"
      >
        Sign Up
      </Link>
      <p className="mt-2 text-center text-xs text-white/55">{SERVICE_PURCHASE_NOTE}</p>
    </div>
  );
}

function ReportCard({ title, meta, description, imageSrc, href }: ReportCardData) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-white/10 bg-white/[0.03] p-4">
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
          <h3 className="text-base font-semibold leading-snug tracking-tight text-white">{title}</h3>
          <p className="text-xs font-medium tabular-nums text-cyan-100/85">{meta}</p>
        </div>
        <p className="flex-1 text-sm leading-relaxed text-white/60 whitespace-pre-line">{description}</p>
      </div>

      <Link
        to={href}
        onClick={() => trackCtaClick("buy_report", "home_reports", { href, title })}
        className="mt-4 shrink-0 rounded-md bg-white/10 py-2 text-center text-sm text-white transition hover:bg-white/20"
      >
        Buy Report
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
  const reportItems: ReportCardData[] = REPORT_TIER_ORDER.map((tier) => ({
    title: REPORT_TIER_DEFINITIONS[tier].label,
    meta: divin8ReportTierListPrice(tier),
    description: REPORT_TIER_DEFINITIONS[tier].description,
    imageSrc: REPORT_CARD_IMAGES[tier],
    href:
      tier === "deep_dive"
        ? "/reports/deep-dive"
        : tier === "initiate"
          ? "/reports/initiate"
          : "/reports/intro",
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
      <OverviewSection />

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

      <section id="sessions" className="relative scroll-mt-28 border-t border-white/8 py-16">
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="space-y-8 text-left">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-white/40">Sessions</p>

              <h2 className="max-w-3xl text-3xl font-semibold text-white">One-on-one sessions for grounded transformation</h2>

              <p className="max-w-2xl text-white/60">
                Each session is designed to meet you where you are—whether you need clarity, recalibration, or deeper
                integration across your life path.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-4 lg:gap-6">
              {SESSION_CARDS.map((session) => (
                <SessionCard key={session.title} {...session} />
              ))}
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
              Structured written synthesis with precision, hierarchy, and enough depth to reveal your underlying life
              architecture without collapsing into generic spiritual language.
            </p>
          </div>

          <div className="grid items-stretch gap-4 lg:grid-cols-3">
            {reportItems.map((report) => (
              <ReportCard key={report.title} {...report} />
            ))}
          </div>
        </div>
      </LandingSection>

      <LandingSection id="subscriptions">
        <div className="space-y-8 text-left">
          <div className="space-y-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">Subscriptions</p>
            <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.035em] text-white">
              Membership tiers for sustained momentum
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
              Designed for people who want more than a single insight hit. Membership keeps the system active in your
              life with continuity, access, and deeper integration.
            </p>
          </div>

          <div className="grid items-stretch gap-4 sm:grid-cols-2">
            {MEMBERSHIP_CARDS.map((membership) => (
              <MembershipCard key={membership.title} {...membership} />
            ))}
          </div>
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
