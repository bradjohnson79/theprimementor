import type { Divin8Tier } from "@wisdom/utils";
import { MEMBER_PRICING } from "@wisdom/utils";

export type MembershipSignupTierKey = Extract<Divin8Tier, "seeker" | "initiate">;

export interface MembershipSignupPlan {
  tier: MembershipSignupTierKey;
  name: string;
  tagline: string;
  description: string;
  features: string[];
  ctaLabel: string;
  /** Shown as premium / recommended — subtle emphasis in UI only */
  recommended: boolean;
  /** Monthly price label from shared pricing */
  priceLabel: string;
}

export const MEMBERSHIP_SIGNUP_PLANS: MembershipSignupPlan[] = [
  {
    tier: "seeker",
    name: "Seeker Plan",
    tagline: "Foundation & Exploration",
    description:
      "The Seeker Plan is designed for those beginning their journey into deeper self-awareness and energetic understanding. It provides essential access to the Divin8 system and foundational teachings, allowing you to explore your blueprint, ask meaningful questions, and begin integrating new levels of clarity into your life at a steady pace.",
    features: [
      "Easy Access to All Services",
      "150 Prompt Limit to the Divin8 Chat",
      "Access to the Trauma Transcendence Technique E-course",
      "Access to the Beginner & Intermediate Levels of the Prime Law E-course (Coming soon)",
    ],
    ctaLabel: "Start as a Seeker",
    recommended: false,
    priceLabel: MEMBER_PRICING.seeker.monthly.label,
  },
  {
    tier: "initiate",
    name: "Initiate Plan",
    tagline: "Expansion & Mastery",
    description:
      "The Initiate Plan is for those ready to go deeper—removing limitations and stepping fully into the Divin8 system and advanced teachings. With unrestricted access and expanded training, this path supports continuous insight, refinement, and mastery across multiple systems, empowering you to move with clarity, confidence, and precision.",
    features: [
      "Easy Access to All Services",
      "Unlimited Usage of the Divin8 Chat",
      "Access to the Trauma Transcendence Technique E-course",
      "Access to the Beginner, Intermediate & Advanced Levels of the Prime Law E-course (Coming soon)",
      "Free Attendance Access to the Monthly Mentoring Circle Webinar",
      "Eligible for the Mentor Training Packages after a completed Mentoring Session",
    ],
    ctaLabel: "Become an Initiate",
    recommended: true,
    priceLabel: MEMBER_PRICING.initiate.monthly.label,
  },
];
