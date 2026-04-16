import focusSessionImage from "../assets/focus-session.webp";
import { type SessionLandingContent } from "../components/public/SessionLandingPage";
import { FOCUS_BOOKING_PATH } from "../lib/sessionLandingPaths";

export const focusSessionLandingContent: SessionLandingContent = {
  theme: "focus",
  pageTitle: "focus_session",
  hero: {
    eyebrow: "Focus Session",
    title: "Focus Session: Clear the Pattern. Align the Direction.",
    subtitle:
      "When everything feels scattered or uncertain, this session brings clarity to what actually matters so you can move forward with confidence and intention.",
    supportingLine:
      "A 45-minute guided session with Divin8 Synthesis insights designed to cut through confusion and reveal your next steps.",
    cta: {
      label: "Book Your Focus Session",
      href: FOCUS_BOOKING_PATH,
    },
    callout: {
      eyebrow: "Why It Works",
      title: "Precision changes the way direction feels in your body.",
      description:
        "The goal is not abstract insight. It is to isolate the real pattern underneath the noise so your next step becomes usable, clear, and immediate.",
    },
  },
  sections: [
    {
      id: "the-problem",
      label: "The Problem",
      title: "Clarity usually disappears when too many patterns are speaking at once.",
      paragraphs: [
        "There are moments where everything feels unclear. You may be thinking through options, revisiting the same questions, or feeling stuck between different directions.",
        "The more you try to figure it out, the more scattered it can become. This is not because you lack answers. It is because the core pattern has not yet been brought into focus.",
      ],
      density: "tight",
    },
    {
      id: "what-it-is",
      label: "What This Session Is",
      title: "A guided interaction built to isolate the signal from the noise.",
      paragraphs: [
        "The Focus Session is a 45-minute guided interaction designed to bring clarity to your current situation.",
        "Before the session begins, Brad prepares a Divin8 Synthesis report by exploring your natal charts and metaphysical blueprint.",
        "This allows the session to move directly into what matters, identifying the deeper pattern behind your current experience and helping you understand what is actually needed to move forward. Whether you are navigating a decision, facing a challenge, or seeking direction, this session isolates the signal from the noise.",
      ],
      image: {
        src: focusSessionImage,
        alt: "Focus Session artwork",
      },
      callout: {
        eyebrow: "Session Outcome",
        title: "You leave with clarity that can be acted on, not merely appreciated.",
        description:
          "That is what separates this page from generic coaching language and keeps the experience grounded in direction.",
      },
    },
    {
      id: "how-it-works",
      label: "How It Works",
      title: "This session is built around structure, not vagueness.",
      paragraphs: [
        "Using the Divin8 Universal Knowledge System, Brad synthesizes insights from multiple metaphysical systems to form a clear outline for your session.",
        "During your time together, the conversation is designed to move efficiently from recognition into direction.",
      ],
      bullets: [
        "Identify the core pattern influencing your current situation",
        "Understand what is keeping you in your present state",
        "Receive a clear, structured direction forward",
        "Begin shifting your internal state toward alignment",
      ],
      cta: {
        label: "Book Your Focus Session",
        href: FOCUS_BOOKING_PATH,
      },
      callout: {
        eyebrow: "Why It Feels Different",
        title: "The goal is not just understanding. It is actionable clarity.",
        description:
          "Everything in the session points toward what you can do next with confidence.",
      },
      density: "tight",
    },
    {
      id: "benefits",
      label: "What You Receive",
      title: "Practical guidance that turns insight into movement.",
      paragraphs: [
        "This session is designed to leave you with something solid in your hands: a clearer read on what is happening and a more grounded way to respond to it.",
      ],
      bullets: [
        "A clear and strategic goal-setting plan aligned with your prime state",
        "Insight into your natal charts and metaphysical patterns to identify and neutralize behavioral blocks",
        "A synthesized action plan tailored to your current situation and direction",
        "A recorded video session available for download and review",
        "Immediate clarity, direction, and grounded confidence moving forward",
      ],
      cta: {
        label: "Book Your Focus Session",
        href: FOCUS_BOOKING_PATH,
      },
    },
    {
      id: "the-experience",
      label: "The Experience",
      title: "Once the pattern becomes clear, momentum starts to return.",
      paragraphs: [
        "As the session unfolds, what once felt complex begins to simplify. You start to see your situation differently, not through overthinking, but through understanding.",
        "The confusion begins to dissolve, and in its place comes clarity. Instead of questioning your next step, you begin to recognize it. This is where movement begins.",
      ],
      density: "tight",
    },
    {
      id: "positioning",
      label: "Positioning",
      title: "This is the session that turns uncertainty into direction.",
      paragraphs: [
        "Regeneration stabilizes your state of wellness.",
        "Focus brings clarity to your direction.",
        "Mentoring transforms your path.",
        "The Focus Session exists to help you see clearly so that your next step is no longer uncertain.",
      ],
      density: "default",
    },
  ],
  finalCta: {
    eyebrow: "Move Forward Clearly",
    title: "Step Out of Confusion and Into Clarity",
    description:
      "Gain a clear understanding of your situation and move forward with confidence and direction.",
    cta: {
      label: "Book Your Focus Session Now",
      href: FOCUS_BOOKING_PATH,
    },
  },
};
