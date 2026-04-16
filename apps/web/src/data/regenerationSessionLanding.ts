import regenerationSessionImage from "../assets/regeneration-session.webp";
import { type SessionLandingContent } from "../components/public/SessionLandingPage";
import { REGENERATION_BOOKING_PATH } from "../lib/sessionLandingPaths";

export const regenerationSessionLandingContent: SessionLandingContent = {
  theme: "regeneration",
  pageTitle: "regeneration_session",
  hero: {
    eyebrow: "Regeneration Session",
    title: "Regeneration: Enter Your Natural State of Wellness",
    subtitle:
      "This is not about fixing what is broken. This is about aligning with what has always been whole.",
    supportingLine:
      "A guided offline experience designed to help you release old patterns and stabilize a 'prime' state of being.",
    cta: {
      label: "Book Your Regeneration Session",
      href: REGENERATION_BOOKING_PATH,
    },
    callout: {
      eyebrow: "Why It Lands Differently",
      title: "Regeneration reframes wellness as something you enter and remain within.",
      description:
        "Instead of chasing a future state where everything is finally fixed, this page needs to move people into the recognition that wellness is already available and can be stabilized through alignment.",
    },
  },
  sections: [
    {
      id: "the-shift",
      label: "The Shift",
      title: "When the healing loop breaks, wellness starts to feel immediate.",
      paragraphs: [
        "For many people, wellness has been approached as something to fix, repair, or recover.",
        "But what if there was never anything truly broken? Healing often keeps you in a state of becoming, working toward a version of yourself that always seems just out of reach.",
        "Regeneration is different. It invites you into the realization that wellness is already present, and that your work now is to stabilize it, embody it, and live from it.",
      ],
      statementLines: [
        "Healing is the process of becoming well.",
        "Regeneration is the state of being well.",
      ],
      density: "default",
    },
    {
      id: "what-it-is",
      label: "What This Session Is",
      title: "An offline energetic alignment designed to bring your system back into harmony.",
      paragraphs: [
        "The Regeneration Session is an offline energetic alignment designed to bring your system into a stable state of wellness.",
        "Rather than focusing on symptoms or problems, this session works at the level of alignment, supporting the release of old patterns, behaviors, and energetic imprints that no longer serve you.",
        "Through this process, you begin to reconnect with a familiar state of balance where your system naturally maintains harmony without constant effort.",
      ],
      image: {
        src: regenerationSessionImage,
        alt: "Regeneration Session artwork",
      },
      callout: {
        eyebrow: "What Changes",
        title: "The session moves from symptom management into state alignment.",
        description:
          "That shift is what helps the experience feel lighter, calmer, and more stable instead of effortful.",
      },
    },
    {
      id: "how-it-works",
      label: "How It Works",
      title: "Your personalized alignment process begins as soon as the session is initiated.",
      paragraphs: [
        "Using the Divin8 system, your unique blueprint is explored through a combination of astrology, numerology, and advanced metaphysical interpretation systems.",
        "From this, custom-designed exercises are created specifically for you, guiding your awareness into a consistent state of alignment.",
        "These exercises are not about effort. They are about familiarity. The more familiar the state becomes, the more natural it is to remain within it.",
      ],
      cta: {
        label: "Book Your Regeneration Session",
        href: REGENERATION_BOOKING_PATH,
      },
      density: "tight",
    },
    {
      id: "benefits",
      label: "What You Receive",
      title: "Grounded support that helps your system hold the state it recognizes.",
      paragraphs: [
        "The value here is not just insight. It is the structure that helps you stay aligned after the session begins working through your system.",
      ],
      bullets: [
        "Personalized regeneration alignment guided by nearly 20 years of experience",
        "Custom MP3 exercises designed to stabilize your 'prime' state of being",
        "7 days of priority email support for continued guidance and alignment",
        "Exercises developed through natal charts using astrology, numerology, and advanced metaphysical systems",
      ],
    },
    {
      id: "the-experience",
      label: "The Experience",
      title: "What begins to release is often what once felt permanently heavy.",
      paragraphs: [
        "As the session integrates, you may begin to notice a sense of lightness, clarity, and internal stability.",
        "What once felt heavy or persistent begins to release, not through force, but through alignment.",
        "Your system starts to recognize a different baseline, one where wellness is no longer something you chase, but something you remain within. This is where regeneration begins to take hold.",
      ],
      density: "tight",
    },
    {
      id: "support",
      label: "Support + Integration",
      title: "The shift is supported while your system learns to stay in it.",
      paragraphs: [
        "Following your session, you receive 7 days of priority email support.",
        "This gives you space to ask questions, receive guidance, and stay aligned as your system stabilizes into this new state. You are not left to figure it out alone. You are supported as the shift integrates.",
      ],
      cta: {
        label: "Book Your Regeneration Session",
        href: REGENERATION_BOOKING_PATH,
      },
      density: "spacious",
    },
  ],
  finalCta: {
    eyebrow: "Step Into The Baseline",
    title: "Step Into a State Where Wellness Is Your Baseline",
    description:
      "Move beyond cycles of healing and into a stable, aligned state of being.",
    cta: {
      label: "Book Your Regeneration Session Now",
      href: REGENERATION_BOOKING_PATH,
    },
  },
};
