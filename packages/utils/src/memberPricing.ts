import type { BillingInterval, Divin8Tier } from "./divin8.js";

export const MEMBER_PRICING: Record<Divin8Tier, Record<BillingInterval, { amountCad: number; label: string }>> = {
  seeker: {
    monthly: { amountCad: 29.99, label: "$29.99 CAD / month" },
    annual: { amountCad: 288, label: "$288 CAD / year" },
  },
  initiate: {
    monthly: { amountCad: 79.99, label: "$79.99 CAD / month" },
    annual: { amountCad: 760, label: "$760 CAD / year" },
  },
};

export function annualSavingsLabel(tier: Divin8Tier) {
  if (tier === "seeker") {
    return "Save $72/year";
  }
  return "Save $200/year";
}

export function isLimitReachedErrorMessage(message: string) {
  return message.includes("LIMIT_REACHED");
}
