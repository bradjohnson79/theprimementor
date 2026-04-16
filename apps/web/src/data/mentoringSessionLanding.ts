import mentoringSessionImage from "../assets/mentoring-session.webp";
import { type SessionLandingContent } from "../components/public/SessionLandingPage";
import { MENTORING_BOOKING_PATH } from "../lib/sessionLandingPaths";

export const mentoringSessionLandingContent: SessionLandingContent = {
  theme: "mentoring",
  pageTitle: "mentoring_session",
  hero: {
    eyebrow: "Mentoring Session",
    title: "Mentoring Session: Transform Your Path. Embody Your Prime State.",
    subtitle:
      "A 90-minute, high-level mentoring experience designed to guide you through deep pattern transformation, expanded awareness, and long-term alignment.",
    supportingLine:
      "This is where clarity becomes integration and where your path becomes something you live, not just understand.",
    cta: {
      label: "Book Your Mentoring Session",
      href: MENTORING_BOOKING_PATH,
    },
    callout: {
      eyebrow: "Why This Is Different",
      title: "This is the most complete experience in the system.",
      description:
        "It is not a longer Focus Session. It is where your full blueprint, your patterns, and your intended direction are brought together so change can become lived and sustainable.",
    },
  },
  sections: [
    {
      id: "the-invitation",
      label: "The Invitation",
      title: "There comes a point where understanding on its own is no longer enough.",
      paragraphs: [
        "You may already understand your patterns. You may already see what needs to change.",
        "But understanding alone does not create transformation. The Mentoring Session is for those who are ready to go further, to integrate, evolve, and embody a new way of being.",
      ],
      density: "spacious",
    },
    {
      id: "what-it-is",
      label: "What This Session Is",
      title: "A full-system experience designed to work with the deeper structure of your blueprint.",
      paragraphs: [
        "The Mentoring Session is the most complete and in-depth experience offered.",
        "Over the course of 90 minutes, Brad works directly with your full blueprint, exploring your patterns, direction, and potential through the Divin8 Universal Knowledge System.",
        "This includes insights drawn from multiple systems such as numerology, astrology, I-Ching, tarot, Kabbalah science, body mapping, and other advanced metaphysical frameworks. This is not about collecting information. It is about understanding your system at a level where change becomes natural and sustainable.",
      ],
      image: {
        src: mentoringSessionImage,
        alt: "Mentoring Session artwork",
      },
      callout: {
        eyebrow: "What It Opens",
        title: "Everything begins to connect when the system is read as a whole.",
        description:
          "The session is built to connect insight, direction, and embodiment instead of leaving them as separate ideas.",
      },
      density: "spacious",
    },
    {
      id: "depth-of-work",
      label: "The Depth Of The Work",
      title: "The session goes beyond surface insight and into lived transformation.",
      paragraphs: [
        "In this session, patterns are not just identified. They are understood, integrated, and evolved.",
        "From this awareness, outdated behavioral patterns begin to dissolve and new aligned patterns are introduced. Brad works with you to stabilize what is known as Prime Mind, a state of harmony where your internal alignment matches your intended outcomes.",
      ],
      bullets: [
        "The deeper structure of your life path",
        "The origin of recurring patterns",
        "How your internal state influences your external reality",
      ],
      cta: {
        label: "Book Your Mentoring Session",
        href: MENTORING_BOOKING_PATH,
      },
      density: "default",
    },
    {
      id: "how-it-works",
      label: "How It Works",
      title: "The experience is deep, but it is still structured.",
      paragraphs: [
        "Prior to the session, your information is analyzed through multiple systems within the Divin8 framework.",
        "From this, a comprehensive session outline is developed, tailored to your goals, your challenges, and your current state.",
        "During the session, you are guided through the insights that matter most so awareness becomes application.",
      ],
      bullets: [
        "Deep insight into your blueprint and direction",
        "Identification and neutralization of limiting patterns",
        "Practical alignment methods to stabilize your state",
        "Clear steps to embody your intended reality",
      ],
      callout: {
        eyebrow: "Practical Depth",
        title: "This is where awareness becomes application.",
        description:
          "The session does not stop at understanding your system. It moves toward what you can embody after the call ends.",
      },
      density: "spacious",
    },
    {
      id: "benefits",
      label: "What You Receive",
      title: "A premium session built for depth, integration, and continued momentum.",
      paragraphs: [
        "What you receive here is designed to support transformation, not just a powerful conversation in the moment.",
      ],
      bullets: [
        "A transformational 90-minute experience revealing the deeper structure of your personal blueprint",
        "A complete session outline developed through over a dozen metaphysical systems within the Divin8 Universal Knowledge System",
        "Clear guidance, practical methods, and personalized exercises to dissolve conflicting behavioral patterns",
        "Tools and practices to stabilize your Prime Mind state on a daily basis",
        "A full video recording of your session available for download and continued integration",
      ],
      cta: {
        label: "Book Your Mentoring Session",
        href: MENTORING_BOOKING_PATH,
      },
      density: "default",
    },
    {
      id: "the-experience",
      label: "The Experience",
      title: "Transformation becomes believable when it starts to feel natural.",
      paragraphs: [
        "Within the session, clarity replaces confusion, but more importantly, alignment begins to take hold. You are not just seeing differently. You are experiencing differently.",
        "Old routines that once felt automatic begin to fall away, and new patterns that support your path start to become natural. This is where your goals begin to feel real, not distant, not theoretical, but already within reach.",
      ],
      density: "spacious",
    },
    {
      id: "positioning",
      label: "Positioning",
      title: "This is the highest-depth session in the system.",
      paragraphs: [
        "Regeneration stabilizes your state of wellness.",
        "Focus brings clarity to your direction.",
        "Mentoring transforms your path.",
        "This session is for those ready to move beyond cycles and step fully into alignment.",
      ],
      density: "default",
    },
  ],
  finalCta: {
    eyebrow: "Transform The Path",
    title: "Step Into Your Prime State and Transform Your Path",
    description:
      "Experience clarity, alignment, and transformation at the deepest level.",
    cta: {
      label: "Book Your Mentoring Session Now",
      href: MENTORING_BOOKING_PATH,
    },
  },
};
