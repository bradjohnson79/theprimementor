import {
  BRAND_PROMISE,
  HERO_SUBLINE_SUPPORTING,
} from "../../lib/brandCopy";
import heroHeaderFull from "../../assets/hero-header-full.webp";
import mobileHeroHeader from "../../assets/mobile-hero-header.webp";
import mentoringSession from "../../assets/mentoring-session.webp";
import initiateReport from "../../assets/reports/divin8-initiate-report.webp";
import sparkleStarMandala from "../../assets/heroes/sparkle-star-mandala-hero.webp";

/** Time each slide stays up before advancing. Pauses while hovered, focused, or explicitly paused. */
export const HERO_ROTATION_MS = 12_000;

export type HeroCta = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

export type HeroSlideVisual =
  | { kind: "brad"; desktopSrc: string; mobileSrc: string }
  | { kind: "model"; src: string }
  | { kind: "scene"; src: string }
  | { kind: "mandala"; src: string };

export type HeroSlide = {
  id: "brad" | "shop" | "services" | "reports";
  /** Short name for the dot control and screenshots. */
  label: string;
  eyebrow: string;
  headline: string[];
  body: string;
  benefits: string[];
  ctas: HeroCta[];
  visual: HeroSlideVisual;
};

/**
 * Four homepage heroes.
 *
 * Brad keeps the existing cosmic photograph and the current primary copy.
 * Shop displays the sparkle star sacred geometry mandala design on a transparent
 * background. Services and Reports use the mentoring session piece and the
 * Divin8 Initiate report. They are not new photographs of Brad.
 */
export const HERO_SLIDES: HeroSlide[] = [
  {
    id: "brad",
    label: "Brad",
    eyebrow: BRAND_PROMISE,
    headline: ["Stuck at a crossroads?", "Get a clear read on your", "path, and your next move."],
    body: HERO_SUBLINE_SUPPORTING,
    benefits: [
      "A free account to start, no payment needed to look around",
      "Reports delivered within 24 hours, Monday–Friday",
      "Every live session includes a recording",
    ],
    ctas: [
      { label: "Find your starting point", href: "#start-here", variant: "primary" },
      { label: "See a sample report", href: "#reports", variant: "secondary" },
    ],
    visual: {
      kind: "brad",
      desktopSrc: heroHeaderFull,
      mobileSrc: mobileHeroHeader,
    },
  },
  {
    id: "shop",
    label: "Shop",
    eyebrow: "The Prime Mentor Shop",
    headline: ["Sacred apparel", "and digital tools", "for the work."],
    body: "Original mandala designs on premium tees, plus digital editions for personal spiritual practice — Healing Code Cards, safeguard sets, and printable kits.",
    benefits: [
      "Best-selling sacred geometry apparel",
      "Digital editions from the Prime Mentor Shop",
      "Apparel printed on demand and shipped by Spreadshirt",
    ],
    ctas: [
      { label: "Explore the Shop", href: "#shop", variant: "primary" },
    ],
    visual: {
      kind: "mandala",
      src: sparkleStarMandala,
    },
  },
  {
    id: "services",
    label: "Services",
    eyebrow: "Sessions & services",
    headline: ["Bring your question.", "Leave with a clear", "next step."],
    body: "Live Q&A, mentoring, healing, email sessions, and Manifestation Monthly. Direct work with Brad — or a channeled exchange with Adronis — and a recording when you meet live.",
    benefits: [
      "Manifestation Monthly, Brad's best seller",
      "Live Q&A on Zoom from $139 CAD",
      "Healing, email sessions, and mentoring",
    ],
    ctas: [
      { label: "Explore services", href: "#sessions", variant: "primary" },
    ],
    visual: {
      kind: "scene",
      src: mentoringSession,
    },
  },
  {
    id: "reports",
    label: "Reports",
    eyebrow: "Divin8 written reports",
    headline: ["See your patterns", "in one written", "report, not one sign"],
    body: "Divin8 reports bring astrology, numerology and other traditions together into one picture of why the same situations keep showing up — delivered as a written report.",
    benefits: [
      "From $39 CAD for a focused 3-question report",
      "Up to $199 CAD for the full Initiate synthesis",
      "Written guidance, delivered to your dashboard",
    ],
    ctas: [
      { label: "Explore reports", href: "#reports", variant: "primary" },
    ],
    visual: {
      kind: "scene",
      src: initiateReport,
    },
  },
];
