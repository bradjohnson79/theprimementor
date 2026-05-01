import regenerationMonthlyPackageImage from "../../../../images/regeneration service.jpg";
import { type SessionLandingContent } from "../components/public/SessionLandingPage";
import { REGENERATION_BOOKING_PATH } from "../lib/sessionLandingPaths";

export const regenerationSessionLandingContent: SessionLandingContent = {
  theme: "regeneration",
  pageTitle: "regeneration_monthly_package",
  hero: {
    eyebrow: "Regeneration Monthly Package",
    title: "A 30-day guided regeneration process with direct priority support.",
    subtitle:
      "The Regeneration Monthly Package is a remote energy facilitation service designed to support your system over a full 30-day cycle.",
    supportingLine:
      "$99 / month recurring. Cancel anytime. This is not a one-time session. It is continuous monthly work focused on deeper integration, stabilization, and measurable internal change over time.",
    cta: {
      label: "Begin Your Regeneration Cycle",
      href: REGENERATION_BOOKING_PATH,
    },
    callout: {
      eyebrow: "What You Are Starting",
      title: "You are no longer buying a session. You are entering a guided monthly process.",
      description:
        "Throughout the cycle, regeneration work is conducted offline while priority support stays available so you can report your experiences, receive guidance, and stay aligned as the process unfolds.",
    },
  },
  sections: [
    {
      id: "the-shift",
      label: "The Process",
      title: "A full 30-day cycle built for continuity instead of a single moment.",
      paragraphs: [
        "Throughout this period, you receive ongoing regeneration work conducted offline, focused on aligning your system to a renewed and stabilized state across all layers of being.",
        "The deeper value comes from continuity. Rather than treating regeneration like a one-time intervention, the monthly package creates room for ongoing support, observation, and refinement over the full cycle.",
        "This helps the process feel grounded, trackable, and easier to integrate into daily life.",
      ],
      statementLines: [
        "You are selling a process, not a session.",
        "You are entering ongoing support, not one-time delivery.",
      ],
      density: "default",
    },
    {
      id: "what-it-includes",
      label: "What It Includes",
      title: "Offline energy facilitation paired with direct priority guidance.",
      paragraphs: [
        "As part of the package, you have priority email access to Brad Johnson so you can report what you are noticing, receive grounded guidance, and stay aligned with the monthly work as it unfolds.",
        "There is no live session required. The work is conducted remotely and begins within a designated time window following submission.",
        "The focus is full-system alignment and regeneration, with ongoing continuity month to month when deeper support is needed.",
      ],
      image: {
        src: regenerationMonthlyPackageImage,
        alt: "Regeneration Monthly Package artwork",
      },
      callout: {
        eyebrow: "Priority Support",
        title: "Direct communication stays available while the cycle is active.",
        description:
          "This keeps the experience structured and responsive, rather than leaving you to interpret changes on your own.",
      },
    },
    {
      id: "why-continuity-matters",
      label: "Why Continuity Matters",
      title: "Monthly continuity creates better retention, support, and observable change.",
      paragraphs: [
        "This is not positioned as a one-time correction. It is a continuous monthly progression designed to support deeper integration, stabilization, and measurable internal change over time.",
        "That shift in framing matters because regeneration often lands more clearly when support remains active long enough for the process to be observed, refined, and reinforced.",
        "If the cycle remains aligned, you can continue month to month without resetting the relationship or losing support visibility.",
      ],
      cta: {
        label: "Start Monthly Regeneration",
        href: REGENERATION_BOOKING_PATH,
      },
      density: "tight",
    },
    {
      id: "benefits",
      label: "Key Features",
      title: "Everything in the package is designed around consistency and support.",
      paragraphs: [
        "The monthly package keeps the experience simple, structured, and supportive from start to finish.",
      ],
      bullets: [
        "30 days of continuous regeneration support",
        "Priority email access for direct communication and guidance",
        "Offline energy facilitation with no live session required",
        "Focus on full-system alignment and regeneration",
        "Monthly continuity for ongoing progress",
      ],
    },
    {
      id: "delivery",
      label: "Delivery",
      title: "The work is conducted remotely and begins within a designated time window following submission.",
      paragraphs: [
        "You do not need to schedule a live call for the monthly package to begin. The regeneration work is performed offline while your support channel remains open during the active cycle.",
        "That makes the experience easier to continue, easier to track, and easier to return to without rebuilding the process from scratch.",
      ],
      density: "tight",
    },
    {
      id: "integration",
      label: "Support + Integration",
      title: "Priority guidance stays close while the cycle unfolds.",
      paragraphs: [
        "You can use the active cycle to document experiences, note internal changes, and surface challenges while they are still relevant.",
        "That ongoing contact is what turns regeneration into a supported monthly process instead of a disconnected one-time purchase.",
      ],
      density: "spacious",
    },
  ],
  finalCta: {
    eyebrow: "Begin The Cycle",
    title: "Begin Your Regeneration Cycle",
    description:
      "Start monthly regeneration work with direct priority support, recurring continuity, and the freedom to cancel anytime.",
    cta: {
      label: "Begin Your Regeneration Cycle",
      href: REGENERATION_BOOKING_PATH,
    },
  },
};
