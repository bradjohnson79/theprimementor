export type Divin8Tier = "seeker" | "initiate";
export type BillingInterval = "monthly" | "annual";

export interface TierCapabilities {
  easyAccessToServices: boolean;
  promptLimit: number | null;
  unlimitedChat: boolean;
  includesMentorCircle: boolean;
  traumaTranscendenceCourse: boolean;
  primeLawBeginner: boolean;
  primeLawIntermediate: boolean;
  primeLawAdvanced: boolean;
}

export const TIER_CONFIG = {
  seeker: {
    easyAccessToServices: true,
    promptLimit: 150,
    unlimitedChat: false,
    includesMentorCircle: false,
    traumaTranscendenceCourse: true,
    primeLawBeginner: true,
    primeLawIntermediate: true,
    primeLawAdvanced: false,
  },
  initiate: {
    easyAccessToServices: true,
    promptLimit: null,
    unlimitedChat: true,
    includesMentorCircle: true,
    traumaTranscendenceCourse: true,
    primeLawBeginner: true,
    primeLawIntermediate: true,
    primeLawAdvanced: true,
  },
} as const satisfies Record<Divin8Tier, TierCapabilities>;

export const DIVIN8_LIMITS = {
  seeker: TIER_CONFIG.seeker.promptLimit,
  initiate: Number.POSITIVE_INFINITY,
} as const;

export interface MemberUsageState {
  promptsUsed: number;
  periodStart: string;
  periodEnd: string;
}

export interface Divin8MemberProfile {
  id: string;
  tier: Divin8Tier;
  billingInterval: BillingInterval;
  usage: MemberUsageState;
}

export function getDivin8PromptLimit(tier: Divin8Tier) {
  const configured = TIER_CONFIG[tier].promptLimit;
  return configured === null ? Number.POSITIVE_INFINITY : configured;
}

export function getTierCapabilities(tier: Divin8Tier): TierCapabilities {
  return TIER_CONFIG[tier];
}

export function getDivin8Access(member: Divin8MemberProfile) {
  const config = TIER_CONFIG[member.tier];
  if (config.unlimitedChat) {
    return {
      canUse: true,
      unlimited: true as const,
      remaining: null as number | null,
      limit: null as number | null,
    };
  }

  const remaining = Math.max(0, config.promptLimit - member.usage.promptsUsed);
  return {
    canUse: remaining > 0,
    unlimited: false as const,
    remaining,
    limit: config.promptLimit,
  };
}
