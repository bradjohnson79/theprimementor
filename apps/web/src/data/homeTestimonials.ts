import type { TestimonialItem } from "../components/public/TestimonialsSlider";

/**
 * Homepage testimonials.
 *
 * Only the "safe" quotes from Section 2 of
 * /Users/bradjohnson/Documents/primementor-revamp/prime-mentor-strengths-brief.md
 * appear here. Two quotes are trimmed to the safe excerpt that brief calls out;
 * the removed sentences (health/medical or mental-health comparisons) are noted
 * inline below and in REPORT.md. The regeneration/autism testimonial that was
 * previously here has been removed entirely — it is on the brief's DO NOT USE list.
 */
export const NANCY_P_TTT_TESTIMONIAL: TestimonialItem = {
  id: "nancy-p-ttt",
  quote:
    "I recently did the Trauma Transcendence Technique Free Ecourse again as a refresher. This is a great free technique to use on a daily basis. I highly recommend using TTT. Brad's ecourse is well presented and well put together. He explains things in an easy-to-understand manner. Take the time to learn TTT with this free ecourse, use it on a daily basis, and reap the benefits.",
  name: "Nancy P",
};

export const ALEXANDER_GROSSMAN_TTT_TESTIMONIAL: TestimonialItem = {
  id: "alexander-grossman-ttt",
  quote:
    "Wonderful and very effective course. Thanks for making this available for free. It is amazing what is possible and how easy, when you start thinking in energies and identification with it. Keep continue the very valid work you are offering to humanity.",
  name: "Alexander Grossman",
};

export const HOME_TESTIMONIALS: TestimonialItem[] = [
  {
    id: "1",
    quote:
      "Interacting with Brad was joyful, inspirational, empowering, and downright fun!!! In addition to the enormous wisdom Brad emparts I was gifted an immensity of Love.",
    name: "Bibi Tinsley",
    role: "Los Angeles, CA",
  },
  {
    id: "2",
    quote:
      "Divin8 helped me see patterns I was too close to name. The language is precise without being cold; I finally had a map I could use when life felt noisy.",
    name: "Ronald P.",
    role: "Premium member",
  },
  {
    id: "3",
    // Trimmed: the brief flags the next sentence ("He did what years of therapists...")
    // as an implied mental-health comparison and keeps it off ads/landing pages.
    quote: "Within a single session, Brad helped me to heal parts of myself I never realized were out of touch. That session transformed my life.",
    name: "Gregory Hudson",
    role: "Halifax, NS",
  },
  {
    id: "4",
    // Trimmed to the brief's safe excerpt only; the removed sentence about the
    // "healing part" of the session reads as a physical-health claim.
    quote:
      "My session with Brad was amazing, I feel extremely grateful as well as surprised at how fast my questions were answered. I feel a sense of peace after my session as I'd learned many different things about myself. I will be doing this again!",
    name: "Sarah Bresman Cosme",
    role: "Florida",
  },
  {
    id: "5",
    quote:
      "heartfelt thanks to Brad and Adronis for the wonderful session. The suggestions and insights we gained from the session helped us understand ourselves and the world we live in even more. We look forward to our next interaction.",
    name: "Robert Grifa",
    role: "Texas",
  },
  {
    id: "7",
    quote:
      "The Deep dive report is certainly well titled! The Multi-layered report is the most detailed, concise reading I've ever purchased! From the overview details to understanding and integrating challenges, it will continue to be a useful reference guide as I continue my journey. Thank you so much!",
    name: "Craig Stickler",
    role: "Texas",
  },
  NANCY_P_TTT_TESTIMONIAL,
  ALEXANDER_GROSSMAN_TTT_TESTIMONIAL,
];
