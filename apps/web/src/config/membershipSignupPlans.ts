import type { BillingInterval, Divin8Tier } from "@wisdom/utils";
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
  annualPriceLabel: string;
}

export function getMembershipPlanPriceLabel(plan: MembershipSignupPlan, billingInterval: BillingInterval) {
  return billingInterval === "annual" ? plan.annualPriceLabel : plan.priceLabel;
}

export const MEMBERSHIP_SIGNUP_PLANS: MembershipSignupPlan[] = [
  {
    tier: "seeker",
    name: "Premium Membership",
    tagline: "Guidance, Insight & Growth",
    description:
      "Premium Membership gives you steady access to Divin8 Chat, member-only savings, webinar discounts, and upcoming Prime Mentor course pricing so you can keep moving with clarity and direction.",
    features: [
      "Easy Access to All Services",
      "200 Prompts per Month in Divin8 Chat",
      "20% Off Monthly Mentoring Circle Webinars",
      "Exclusive Discounts on Upcoming Prime Mentor E-Courses",
      "Access to the Trauma Transcendence Technique E-course",
      "Access to the Beginner & Intermediate Levels of the Prime Law E-course (Coming soon)",
    ],
    ctaLabel: "Join Premium",
    recommended: true,
    priceLabel: MEMBER_PRICING.seeker.monthly.label,
    annualPriceLabel: MEMBER_PRICING.seeker.annual.label,
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
    annualPriceLabel: MEMBER_PRICING.initiate.annual.label,
  },
];
