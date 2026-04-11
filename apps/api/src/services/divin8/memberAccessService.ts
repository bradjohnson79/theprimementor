import type { Database } from "@wisdom/db";
import type { BillingInterval, Divin8Tier, TierCapabilities } from "@wisdom/utils";
import {
  getEntitlementCapabilities,
  getMemberEntitlementSnapshot,
  hasActiveMemberEntitlement,
} from "./entitlementService.js";
import { getMemberUsageSummary, resolveUsageWindow } from "./usageService.js";

export interface ResolvedMemberAccess {
  tier: Divin8Tier;
  subscriptionStatus: "active";
  billingInterval: BillingInterval;
  capabilities: TierCapabilities;
  usage: {
    used: number;
    limit: number | null;
    periodStart: string;
    periodEnd: string;
  };
}

export async function resolveMemberAccess(db: Database, userId: string): Promise<ResolvedMemberAccess | null> {
  const entitlement = await getMemberEntitlementSnapshot(db, userId);
  if (!hasActiveMemberEntitlement(entitlement)) {
    return null;
  }

  const usageWindow = resolveUsageWindow(entitlement);
  const usage = await getMemberUsageSummary(db, {
    userId,
    tier: entitlement.tier,
    window: usageWindow,
  });

  return {
    tier: entitlement.tier,
    subscriptionStatus: "active",
    billingInterval: entitlement.billingInterval,
    capabilities: getEntitlementCapabilities(entitlement),
    usage,
  };
}
