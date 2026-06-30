import regenerationMonthlyPackageImage from "../../../../images/regeneration service.jpg";
import { type SessionLandingContent } from "../components/public/SessionLandingPage";
import { REGENERATION_BOOKING_PATH } from "../lib/sessionLandingPaths";

export const regenerationSessionLandingContent: SessionLandingContent = {
  theme: "regeneration",
  pageTitle: "regeneration_monthly_package",
  hero: {
    eyebrow: "Regeneration Monthly Package",
    title: "Regenerate Your Personal Life Every Month",
    subtitle:
      "A monthly 1-to-1 manifestation and regeneration service with Brad Johnson to safeguard your desired outcomes, amplify preferred assumptions, clear anti-goals, and support your personal transformation.",
    bullets: [
      "15 minute ZOOM consultation with Brad Johnson",
      "Desired manifestation(s) safeguarded indefinitely free from doubt/sabotage.",
      "Video recording of consultation and 2 free MP3 exercises to remove conflict and empower additional manifestations.",
      "30 day priority email support with Brad Johnson",
    ],
    supportingLine:
      "$99 CAD / month · Cancel anytime",
    cta: {
      label: "Begin Monthly Cycle",
      href: REGENERATION_BOOKING_PATH,
    },
    callout: {
      eyebrow: "Optional First-Month Add-On",
      title: "Optional: Add an additional manifestation request for the first month +$29 CAD",
      description:
        "Add one extra desired outcome during your first monthly cycle so Brad can safeguard and amplify another personal manifestation request.",
    },
  },
  sections: [
    {
      id: "what-this-package-is",
      label: "What This Package Is",
      title: "A monthly subscription for regenerating your personal life from the inside out.",
      paragraphs: [
        "The Regeneration Monthly Package is a monthly subscription service designed to help regenerate your personal life from the inside out.",
        "This is not limited to physical regeneration. Brad works with your desired manifestation, personal state, or life improvement goal by safeguarding the assumption, amplifying the preferred outcome, and clearing anti-goals that may interfere with the result.",
        "The Regeneration Monthly Package includes a 15 minute ZOOM consultation with Brad Johnson. Brad interacts with you teaching you a simple and powerful breathwork exercise and guides you through your desired manifestation with a meditation. This leads to Manifestation safeguarding securing your manifestation from personal doubt/sabotage increasing it to accelerate itself to you.",
      ],
      density: "default",
    },
    {
      id: "what-you-can-use-it-for",
      label: "What You Can Use It For",
      title: "Use the monthly cycle for the personal-life area you want regenerated, safeguarded, and amplified.",
      paragraphs: [
        "If your desired change involves regenerating your personal life, state, circumstances, or direction, this package can be used to support that intention.",
      ],
      bullets: [
        "Health and Wellness",
        "Personal Debt Elimination",
        "Financial Abundance",
        "Career Improvement",
        "Relationship Improvement",
        "Household Improvement",
        "Personal Development Improvement",
        "Selling Homes & Assets",
        "Custom Personal Manifestation Requests",
      ],
      image: {
        src: regenerationMonthlyPackageImage,
        alt: "Regeneration Monthly Package artwork",
      },
      callout: {
        eyebrow: "Monthly Support",
        title: "$99 CAD / month · Cancel anytime",
        description:
          "Each cycle includes 1-to-1 guidance, safeguarded manifestation work, offline clearing, personal MP3 clearing exercises, and priority email support.",
      },
    },
    {
      id: "whats-included",
      label: "What's Included",
      title: "Everything in the monthly package supports the desired manifestation and your personal state.",
      paragraphs: [
        "Monthly 15-Minute Zoom Consultation: Meet 1-to-1 with Brad Johnson to clarify the desired manifestation or personal state you want safeguarded and amplified.",
        "Safeguarded Manifestation Work: Brad works with the desired assumption to help contain, stabilize, and amplify the intended outcome.",
        "Offline Anti-Goal Clearing: Brad works offline to help clear anti-goals, resistance patterns, and inner interference connected to the manifestation.",
        "Personal MP3 Clearing Exercises: Receive customized MP3-based exercises so you can participate in the clearing process and support the regeneration work personally.",
        "30-Day Priority Email Support: Check in with Brad anytime during the 30-day cycle for additional guidance, refinement, or offline enhancement if needed.",
        "Automatic Monthly Continuation: Your next 15-minute consultation is automatically scheduled approximately 30 days after your initial consultation.",
      ],
      cta: {
        label: "Begin Monthly Cycle",
        href: REGENERATION_BOOKING_PATH,
      },
      density: "default",
    },
    {
      id: "how-the-monthly-cycle-works",
      label: "How the Monthly Cycle Works",
      title: "A simple monthly rhythm for 1-to-1 support, offline clearing, and personal integration.",
      paragraphs: [
        "The monthly cycle is designed to keep the intention clear, the support active, and the next consultation already moving toward continuity.",
      ],
      bullets: [
        "1. Subscribe to the Regeneration Monthly Package.",
        "2. Book your first 15-minute Zoom consultation with Brad.",
        "3. Share the personal state, manifestation, or life area you want regenerated.",
        "4. Brad safeguards and amplifies the desired manifestation and begins offline anti-goal clearing.",
        "5. You receive personalized MP3 clearing exercises to support your side of the process.",
        "6. Use 30-day priority email support for check-ins, updates, and refinement.",
        "7. Your next monthly consultation is automatically scheduled approximately 30 days later.",
      ],
      bulletColumns: 1,
    },
    {
      id: "optional-first-month-add-on",
      label: "Optional First-Month Add-On",
      title: "Additional Manifestation Request",
      paragraphs: [
        "Optional First-Month Add-On: Additional Manifestation Request",
        "For +$29 CAD, you may add one additional manifestation request during your first month. This allows Brad to safeguard and amplify an extra desired outcome within the same monthly cycle.",
      ],
      density: "tight",
    },
    {
      id: "cancellation-no-obligation",
      label: "Cancellation / No Obligation",
      title: "Monthly support without a long-term obligation.",
      paragraphs: [
        "The Regeneration Monthly Package is a monthly subscription at $99 CAD/month. There is no long-term obligation, and you may cancel your subscription anytime.",
      ],
      density: "spacious",
    },
  ],
  finalCta: {
    eyebrow: "Begin Monthly Support",
    title: "Begin Your Regeneration Monthly Package",
    description:
      "Start monthly 1-to-1 manifestation and regeneration support with Brad Johnson for $99 CAD / month. Cancel anytime.",
    cta: {
      label: "Begin Monthly Cycle",
      href: REGENERATION_BOOKING_PATH,
    },
  },
};
