import { MENTOR_TRAINING_PACKAGES, type MentorTrainingPackageType } from "@wisdom/utils";

const TRAINING_PRICE_ENV_KEYS: Record<MentorTrainingPackageType, { standard: string; live: string }> = {
  entry: {
    standard: "STRIPE_PRICE_TRAINING_ENTRY",
    live: "STRIPE_LIVE_PRICE_TRAINING_ENTRY",
  },
  seeker: {
    standard: "STRIPE_PRICE_TRAINING_SEEKER",
    live: "STRIPE_LIVE_PRICE_TRAINING_SEEKER",
  },
  initiate: {
    standard: "STRIPE_PRICE_TRAINING_INITIATE",
    live: "STRIPE_LIVE_PRICE_TRAINING_INITIATE",
  },
};

const LIVE_TRAINING_PRICE_FALLBACKS: Record<MentorTrainingPackageType, string> = {
  entry: "price_1TKllSAd5V3LaCqjpbywuZvH",
  seeker: "price_1TKlmTAd5V3LaCqju0yvmyaW",
  initiate: "price_1TKlnOAd5V3LaCqj6HxoQxFT",
};

export const TRAINING_PACKAGES = {
  entry: {
    ...MENTOR_TRAINING_PACKAGES.entry,
    envKey: TRAINING_PRICE_ENV_KEYS.entry.standard,
  },
  seeker: {
    ...MENTOR_TRAINING_PACKAGES.seeker,
    envKey: TRAINING_PRICE_ENV_KEYS.seeker.standard,
  },
  initiate: {
    ...MENTOR_TRAINING_PACKAGES.initiate,
    envKey: TRAINING_PRICE_ENV_KEYS.initiate.standard,
  },
} as const;

function isLiveStripeMode() {
  return process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_") ?? false;
}

export function getMentorTrainingStripePriceId(packageType: MentorTrainingPackageType) {
  const envKeys = TRAINING_PRICE_ENV_KEYS[packageType];
  const priceId = isLiveStripeMode()
    ? process.env[envKeys.live]?.trim() || LIVE_TRAINING_PRICE_FALLBACKS[packageType]
    : process.env[envKeys.standard]?.trim();
  if (!priceId) {
    throw new Error(`Missing ${isLiveStripeMode() ? envKeys.live : envKeys.standard}`);
  }

  return priceId;
}

export function assertMentorTrainingStripeConfig() {
  for (const packageType of Object.keys(TRAINING_PRICE_ENV_KEYS) as MentorTrainingPackageType[]) {
    const envKeys = TRAINING_PRICE_ENV_KEYS[packageType];
    const envKey = isLiveStripeMode() ? envKeys.live : envKeys.standard;
    const value = process.env[envKey]?.trim();
    const fallback = LIVE_TRAINING_PRICE_FALLBACKS[packageType];
    if (!value && (!isLiveStripeMode() || !fallback)) {
      throw new Error(`Missing ${envKey}`);
    }
  }
}
