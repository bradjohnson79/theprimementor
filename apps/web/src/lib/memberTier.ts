export type MemberSubscription = {
  tier: "seeker" | "initiate";
} | null | undefined;

export type UserTier = "free" | "seeker" | "initiate";
export type UserTierState = "loading" | UserTier;

export function getUserTier(subscription: MemberSubscription): UserTier {
  if (!subscription) {
    return "free";
  }
  return subscription.tier;
}
