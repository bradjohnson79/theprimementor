import { MENTOR_TRAINING_PACKAGES, type MentorTrainingPackageType } from "@wisdom/utils";

const TRAINING_PRICE_ENV_KEYS: Record<MentorTrainingPackageType, string> = {
  entry: "STRIPE_PRICE_TRAINING_ENTRY",
  seeker: "STRIPE_PRICE_TRAINING_SEEKER",
  initiate: "STRIPE_PRICE_TRAINING_INITIATE",
};

export const TRAINING_PACKAGES = {
  entry: {
    ...MENTOR_TRAINING_PACKAGES.entry,
    envKey: TRAINING_PRICE_ENV_KEYS.entry,
  },
  seeker: {
    ...MENTOR_TRAINING_PACKAGES.seeker,
    envKey: TRAINING_PRICE_ENV_KEYS.seeker,
  },
  initiate: {
    ...MENTOR_TRAINING_PACKAGES.initiate,
    envKey: TRAINING_PRICE_ENV_KEYS.initiate,
  },
} as const;

export function getMentorTrainingStripePriceId(packageType: MentorTrainingPackageType) {
  const envKey = TRAINING_PRICE_ENV_KEYS[packageType];
  const priceId = process.env[envKey]?.trim();
  if (!priceId) {
    throw new Error(`Missing ${envKey}`);
  }

  return priceId;
}

export function assertMentorTrainingStripeConfig() {
  for (const envKey of Object.values(TRAINING_PRICE_ENV_KEYS)) {
    const value = process.env[envKey]?.trim();
    if (!value) {
      throw new Error(`Missing ${envKey}`);
    }
  }
}
