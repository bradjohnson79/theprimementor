import { api } from "./api";
import type { MembershipSignupTierKey } from "../config/membershipSignupPlans";

export interface CreateCheckoutSessionResponse {
  sessionId?: string;
  url?: string | null;
}

interface CreateMembershipPurchaseResponse {
  membershipId?: string;
}

/**
 * Starts Stripe Checkout for the selected membership tier.
 * Backend: create or reuse a local membership first, then request Checkout for that entity.
 * When Stripe returns a hosted Checkout URL, the browser navigates there.
 */
export async function startMembershipCheckoutSession(
  tier: MembershipSignupTierKey,
  options: {
    getToken: () => Promise<string | null>;
    clerkUserId: string | undefined;
  },
): Promise<void> {
  const token = await options.getToken();
  const purchase = (await api.post(
    "/member/subscriptions",
    { tier, billingInterval: "monthly" },
    token,
  )) as CreateMembershipPurchaseResponse;
  const membershipId = typeof purchase?.membershipId === "string" ? purchase.membershipId.trim() : "";
  if (!membershipId) {
    throw new Error("Membership checkout could not be created locally before Stripe redirect.");
  }

  const body = {
    type: "subscription" as const,
    membershipId,
    tier,
    clerkId: options.clerkUserId?.trim() || undefined,
  };

  const data = (await api.post("/create-checkout-session", body, token)) as CreateCheckoutSessionResponse;

  const url = typeof data?.url === "string" ? data.url.trim() : "";
  if (url) {
    window.location.assign(url);
    return;
  }

  throw new Error(
    "Checkout did not return a redirect URL. Confirm STRIPE_SECRET_KEY and create-checkout-session are configured.",
  );
}
