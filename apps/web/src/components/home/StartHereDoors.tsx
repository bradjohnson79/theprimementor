import { Link } from "react-router-dom";
import CompactCardGrid from "../public/CompactCardGrid";
import { trackCtaClick } from "../../lib/analytics";
import {
  EMAIL_SESSION_LANDING_PATH,
  MENTORING_LANDING_PATH,
  PAST_LIFE_AKASHIC_LANDING_PATH,
  PRIME_BODY_HEALING_LANDING_PATH,
  QA_LANDING_PATH,
  REGENERATION_LANDING_PATH,
} from "../../lib/sessionLandingPaths";

/**
 * Featured offers per Brad's answers
 * (/Users/bradjohnson/Documents/primementor-revamp/BRAD-ANSWERS.md, #1 and #7a):
 * Manifestation Monthly (his best seller — the single "Most Popular" offer,
 * shown first), Q&A, Email Sessions, Prime Body Healing, Past Life Akashic
 * Readings, and Mentoring — an even 3x2 grid.
 */
const FEATURED_ITEMS = [
  {
    title: "Manifestation Monthly",
    meta: "$99 CAD / month",
    badge: "Most Popular",
    description: "Two 15-minute consultations, manifestation tools, and 30 days of email support each month. Brad's best seller.",
    cta: { label: "Begin Your Journey", href: REGENERATION_LANDING_PATH },
  },
  {
    title: "Q&A Session",
    meta: "From $139 CAD",
    description: "Bring your biggest question. Ask Brad, or Adronis, live on Zoom. Recording included.",
    cta: { label: "Book a Q&A", href: QA_LANDING_PATH },
  },
  {
    title: "Email Session",
    meta: "$59 CAD",
    description: "Up to 3 questions, answered by Brad or Adronis and sent back to you as an MP3. No video, no appointment.",
    cta: { label: "Start Email Session", href: EMAIL_SESSION_LANDING_PATH },
  },
  {
    title: "Prime Body Healing",
    meta: "From $79 CAD",
    description: "Energy healing across up to five chosen areas, live or by recording.",
    cta: { label: "Explore Healing", href: PRIME_BODY_HEALING_LANDING_PATH },
  },
  {
    title: "Past Life Akashic Reading",
    meta: "$79 CAD",
    description: "One past life explored and interpreted by Brad, delivered as a private MP3.",
    cta: { label: "Request a Reading", href: PAST_LIFE_AKASHIC_LANDING_PATH },
  },
  {
    title: "Mentoring Session",
    meta: "From $199 CAD",
    description: "A deeper guided session for blueprint insight, goal alignment, and longer-form support. 45 min ($199 CAD) or 90 min ($299 CAD).",
    cta: { label: "Book a Consultation", href: MENTORING_LANDING_PATH },
  },
] as const;

export default function StartHereDoors({
  showChooserLink = true,
  heading = "Where most people start",
}: {
  showChooserLink?: boolean;
  heading?: string;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">Start here</p>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-white">
          {heading}
        </h2>
        <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
          Brad's most-booked offers. Manifestation Monthly is his best seller; everything here is a sensible first step.
        </p>
      </div>

      <CompactCardGrid
        columns={3}
        items={FEATURED_ITEMS.map((item) => ({
          ...item,
          cta: {
            ...item.cta,
            onClick: () => trackCtaClick("start_here_featured", "start_here", {
              href: item.cta.href,
              title: item.title,
            }),
          },
        }))}
      />

      {showChooserLink ? (
        <p className="text-sm text-white/55">
          Prefer a written report instead?{" "}
          <Link to="/reports" className="text-cyan-100 underline-offset-4 hover:underline">
            See Divin8 Reports from $39 CAD
          </Link>
          , or{" "}
          <Link to="/start-here" className="text-cyan-100 underline-offset-4 hover:underline">
            open the full Start here guide
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
