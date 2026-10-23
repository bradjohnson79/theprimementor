import { type SessionLandingContent } from "../components/public/SessionLandingPage";
import { REGENERATION_BOOKING_PATH } from "../lib/sessionLandingPaths";

export const regenerationSessionLandingContent: SessionLandingContent = {
  theme: "regeneration",
  pageTitle: "regeneration_monthly_package",
  hero: {
    eyebrow: "Manifestation Monthly Package",
    title: "Your Manifestation. Your Alignment. Your Personal Circuit.",
    subtitle:
      "Manifestation is more than imagining what you desire. It is about entering the feeling that your desired reality is already present. This monthly package includes two personal consultations with Brad Johnson, manifestation safeguarding, and a personalized ideogram circuit.",
    bullets: [
      "Two 15-minute Manifestation Consultations with Brad Johnson each month",
      "A personalized Ideogram Circuit created by Brad Johnson",
      "Manifestation safeguarding, with a daily practice using your personal circuit",
      "30-day priority email support",
    ],
    supportingLine:
      "$99 CAD / month · Cancel anytime",
    cta: {
      label: "Begin Your Manifestation Journey",
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
      label: "The Monthly Experience",
      title: "Personal guidance, safeguarding, and your own ideogram circuit.",
      paragraphs: [
        "The Manifestation Monthly Package provides personal guidance, manifestation safeguarding, and a uniquely created ideogram circuit to help you establish and maintain the feeling that your desired reality is already present.",
        "With two personal Manifestation Consultations with Brad Johnson, you receive step-by-step support in aligning with your desired manifestation, reinforcing the state of fulfillment, and developing a consistent daily practice.",
        "Brad will also create your own personalized Manifestation Ideogram Circuit — a symbolic representation of your desired reality that you can use every day to reconnect with its fulfilled feeling.",
        "Together, these elements provide an ongoing framework for conscious manifestation and personal alignment. They do not guarantee a financial, medical, relationship, or other external outcome.",
      ],
      density: "default",
    },
    {
      id: "what-you-can-use-it-for",
      label: "Monthly Journey",
      title: "Two consultations, one personal circuit, and continued safeguarding.",
      paragraphs: [
        "Consultation One, Manifestation Alignment, happens at the beginning of the monthly period. Brad helps you clarify the manifestation, move beyond simply imagining it, and establish the real feeling that it is already present.",
        "Consultation Two, Manifestation Reinforcement, happens about halfway through the month. Brad reviews your practice, addresses doubt, and helps you keep the ideogram circuit in your daily alignment.",
        "Each consultation remains a 15-minute Zoom meeting. You share availability, and Brad schedules the two appointments inside the active monthly period.",
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
        src: "/images/manifestation-monthly-package.png",
        alt: "Manifestation Monthly Package artwork",
      },
      callout: {
        eyebrow: "Monthly Support",
        title: "$99 CAD / Month",
        description:
          "Two consultations, a personalized ideogram circuit, manifestation safeguarding, and the existing included package benefits.",
      },
    },
    {
      id: "whats-included",
      label: "What's Included",
      title: "One monthly experience, with the practices that keep the feeling alive.",
      paragraphs: [
        "Two Personal Manifestation Consultations: One at the beginning of your monthly package and another halfway through, helping you establish and strengthen your manifestation alignment.",
        "Personalized Ideogram Circuit: A unique symbolic circuit personally created by Brad Johnson to represent the fulfilled feeling of your manifestation. It is delivered digitally for the current subscription period.",
        "Manifestation Safeguarding: Your existing manifestation safeguarding service remains an integral part of the monthly package.",
        "Daily Manifestation Reinforcement: Use your ideogram circuit and the practices discussed during your consultations to maintain your connection with the feeling of fulfillment.",
        "Personalized Step-by-Step Guidance: Receive practical support in refining your assumptions, maintaining inner alignment, and returning to the state of your manifestation already being real.",
        "Offline Anti-Goal Clearing: Brad continues the offline work that helps clear resistance connected to the manifestation.",
        "Personal MP3 Clearing Exercises: Receive customized MP3 exercises so you can participate in the clearing process.",
        "30-Day Priority Email Support: Check in with Brad during the monthly cycle.",
      ],
      cta: {
        label: "Begin Your Manifestation Journey",
        href: REGENERATION_BOOKING_PATH,
      },
      density: "default",
    },
    {
      id: "how-the-monthly-cycle-works",
      label: "How the Month Unfolds",
      title: "Alignment at the start. Reinforcement at the midpoint. The circuit in daily practice.",
      paragraphs: [
        "The ideogram is a symbolic representation of the fulfilled state. You can view or hold it during practice, return to the real feeling when doubt arises, and use it in meditation, theta-state practice, or conscious assumption. Brad creates it personally. It is not generated automatically.",
      ],
      bullets: [
        "1. Subscribe to the Manifestation Monthly Package.",
        "2. Share the manifestation, the feeling of it already being real, and the assumptions you want to discuss.",
        "3. Schedule Consultation One at the beginning of the period.",
        "4. Brad safeguards the manifestation and creates your personal ideogram circuit.",
        "5. Use the circuit each day to stay with the thought form and the fulfilled feeling.",
        "6. Schedule Consultation Two about halfway through the month.",
        "7. Priority email support remains open through the monthly period.",
      ],
      bulletColumns: 1,
    },
    {
      id: "optional-first-month-add-on",
      label: "Optional First-Month Add-On",
      title: "Additional Manifestation Request",
      paragraphs: [
        "For +$29 CAD, you may add one additional manifestation request during your first month. This allows Brad to safeguard and amplify an extra desired outcome within the same monthly cycle.",
      ],
      density: "tight",
    },
    {
      id: "cancellation-no-obligation",
      label: "Cancellation / No Obligation",
      title: "Monthly support without a long-term obligation.",
      paragraphs: [
        "The Manifestation Monthly Package is $99 CAD/month. There is no long-term obligation, and you may cancel anytime.",
      ],
      density: "spacious",
    },
  ],
  finalCta: {
    eyebrow: "Begin Monthly Support",
    title: "Begin Your Manifestation Journey",
    description:
      "Two consultations, your personal ideogram circuit, and manifestation safeguarding for $99 CAD / month. Cancel anytime.",
    cta: {
      label: "Begin Your Manifestation Journey",
      href: REGENERATION_BOOKING_PATH,
    },
  },
};
