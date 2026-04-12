import type { BillingInterval, Divin8Tier } from "@wisdom/utils";
import { createHttpError } from "../services/booking/errors.js";

export type MembershipTierKey = Extract<Divin8Tier, "seeker" | "initiate">;

export interface MembershipBillingPlan {
  tier: MembershipTierKey;
  displayName: string;
  monthlyEnvKey: "STRIPE_PRICE_SEEKER_MONTHLY" | "STRIPE_PRICE_INITIATE_MONTHLY";
  annualEnvKey: "STRIPE_PRICE_SEEKER_ANNUAL" | "STRIPE_PRICE_INITIATE_ANNUAL";
}

const MEMBERSHIP_BILLING_PLANS: Record<MembershipTierKey, MembershipBillingPlan> = {
  seeker: {
    tier: "seeker",
    displayName: "Seeker Membership",
    monthlyEnvKey: "STRIPE_PRICE_SEEKER_MONTHLY",
    annualEnvKey: "STRIPE_PRICE_SEEKER_ANNUAL",
  },
  initiate: {
    tier: "initiate",
    displayName: "Initiate Membership",
    monthlyEnvKey: "STRIPE_PRICE_INITIATE_MONTHLY",
    annualEnvKey: "STRIPE_PRICE_INITIATE_ANNUAL",
  },
};

export const MEMBERSHIP_CHECKOUT_APP = "prime-mentor";
export const MEMBERSHIP_CHECKOUT_SCHEMA_VERSION = "membership-checkout-v1";
const DEFAULT_PRODUCTION_FRONTEND_URL = "https://theprimementor.com";
const DEFAULT_LOCAL_FRONTEND_URL = "http://localhost:3000";
export const MEMBERSHIP_REQUIRED_ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_SEEKER_MONTHLY",
  "STRIPE_PRICE_INITIATE_MONTHLY",
] as const;

function normalizeEnvironment(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "production") return "prod";
  if (normalized === "test") return "test";
  return "dev";
}

export function getMembershipBillingPlan(tier: string): MembershipBillingPlan {
  if (tier !== "seeker" && tier !== "initiate") {
    throw createHttpError(400, `Unsupported membership tier: ${tier}`);
  }
  return MEMBERSHIP_BILLING_PLANS[tier];
}

export function getMissingMembershipEnvKeys() {
  return MEMBERSHIP_REQUIRED_ENV_KEYS.filter((key) => !process.env[key]?.trim());
}

export function assertMembershipStripeConfig() {
  const missing = getMissingMembershipEnvKeys();
  if (missing.length === 0) {
    return;
  }

  throw new Error(
    `Missing required Stripe membership environment variables: ${missing.join(", ")}. `
      + "Membership checkout is disabled until Stripe membership pricing and webhook secrets are configured.",
  );
}

export function resolveMembershipPriceId(
  tier: MembershipTierKey,
  billingInterval: BillingInterval = "monthly",
) {
  const plan = getMembershipBillingPlan(tier);
  const envKey = billingInterval === "annual" ? plan.annualEnvKey : plan.monthlyEnvKey;
  const priceId = process.env[envKey]?.trim();

  if (!priceId) {
    throw createHttpError(
      500,
      `Stripe membership price is not configured for ${plan.displayName} (${billingInterval}). Missing ${envKey}.`,
    );
  }

  return {
    plan,
    billingInterval,
    priceId,
    envKey,
  };
}

export function getMembershipCheckoutEnvironment() {
  return normalizeEnvironment(process.env.NODE_ENV);
}

function normalizeFrontendUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function getFrontendUrl() {
  const configuredUrl = process.env.FRONTEND_URL?.trim()
    || process.env.APP_URL?.trim()
    || process.env.VITE_APP_URL?.trim();

  if (configuredUrl) {
    return normalizeFrontendUrl(configuredUrl);
  }

  if (process.env.NODE_ENV === "production") {
    return DEFAULT_PRODUCTION_FRONTEND_URL;
  }

  return DEFAULT_LOCAL_FRONTEND_URL;
}
