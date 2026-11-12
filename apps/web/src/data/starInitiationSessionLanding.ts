import { type SessionLandingContent } from "../components/public/SessionLandingPage";
import { STAR_INITIATION_BOOKING_PATH } from "../lib/sessionLandingPaths";

const BOOKING_PATH = `${STAR_INITIATION_BOOKING_PATH}?intakeType=star_initiation&minutes=30&bookingTypeId=star-initiation-session&productKey=star-initiation-session`;

export const starInitiationSessionLandingContent: SessionLandingContent = {
  theme: "star_initiation",
  pageTitle: "star_initiation",
  hero: {
    eyebrow: "Premium Sessions",
    title: "Star Initiation Session",
    subtitle: "Your Personal Journey Into Soul Lineage, Star Ancestry & Cosmic Integration",
    supportingLine: "A private session hosted by Adronis. Approximately 20–30 minutes. Zoom or phone. $99 CAD.",
    cta: {
      label: "Book Your Star Initiation — $99 CAD",
      href: BOOKING_PATH,
    },
    callout: {
      eyebrow: "Private appointment",
      title: "One-to-one with Adronis",
      description: "Session duration: 20–30 minutes. Session type: private one-to-one. Available through Zoom or phone. Price: $99 CAD. The calendar reserves a 30-minute appointment.",
    },
  },
  testimonial: {
    quote: "I just recently completed my private one-to-one Star Initiation session with Adronis, and the experience provided me with clarity and confirmation with the answers I was seeking. It provided me news of such profound connections I would never have known! It has me searching and exploring new areas and motivated me to pursue current interests even further. I definitely look forward to another session!",
    name: "Shahzad",
  },
  sections: [
    {
      id: "session",
      label: "The Session",
      title: "Reconnect with your soul lineage, star ancestry, and deeper cosmic awareness.",
      paragraphs: [
        "Experience a private Star Initiation Session hosted by Adronis, designed to help you reconnect with your soul lineage, star ancestry, and deeper cosmic awareness.",
        "During this personalized session, Adronis works with you through an energetic calibration process intended to establish a connection with your soul and star lineage.",
        "Through this process, a Cosmic Soul Retrieval is performed, intended to help you reconnect with and reintegrate aspects of your greater soul awareness.",
        "As part of the initiation, Adronis may also provide a personal symbol, instruction, or ritual to support your integration following the session.",
        "Each initiation is individualized, with the intention of supporting deeper clarity, inner connection, spiritual growth, and conscious integration.",
      ],
    },
    {
      id: "includes",
      label: "What Your Session Includes",
      title: "A personal initiation, held live.",
      paragraphs: [
        "The appointment is a private one-to-one meeting. You choose Zoom or phone when you book, and the time you select is held for 30 minutes.",
      ],
      bullets: [
        "Soul & Star Lineage Connection — a personalized energetic calibration intended to deepen your connection with your soul identity and star ancestry.",
        "Cosmic Soul Retrieval — a guided initiation process intended to support the reconnection and integration of aspects of your greater soul awareness.",
        "Personal Symbols & Rituals — where applicable, Adronis may provide a personal symbol, spiritual exercise, or ritual intended to help integrate the initiation.",
        "Integration Guidance — personalized guidance for working with the experience after your appointment.",
      ],
    },
    {
      id: "booking-facts",
      label: "Booking",
      title: "Book Your Star Initiation — $99 CAD",
      paragraphs: [
        "Session duration: 20–30 minutes. Session type: private one-to-one. Available through Zoom or phone. Price: $99 CAD.",
        "Checkout is guest checkout. After payment you choose Zoom or phone and a time on the same booking calendar used for other live Premium Sessions.",
      ],
      statementLines: [
        "20–30 minutes",
        "Zoom or phone",
        "$99 CAD",
      ],
      cta: {
        label: "Book Your Star Initiation — $99 CAD",
        href: BOOKING_PATH,
      },
      alignment: "center",
    },
    {
      id: "disclaimer",
      label: "A note on this work",
      title: "A spiritual service, offered personally.",
      paragraphs: [
        "This experience is a spiritual service. Interpretations and experiences are personal, and individual outcomes are not guaranteed.",
      ],
      density: "tight",
    },
  ],
  finalCta: {
    eyebrow: "Star Initiation Session",
    title: "Begin your private session with Adronis",
    description: "A 20–30 minute one-to-one appointment on Zoom or by phone. $99 CAD.",
    cta: {
      label: "Book Your Star Initiation — $99 CAD",
      href: BOOKING_PATH,
    },
  },
};
