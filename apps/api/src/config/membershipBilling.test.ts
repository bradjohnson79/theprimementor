import assert from "node:assert/strict";
import test from "node:test";
import { getFrontendUrl, resolveMembershipPriceId } from "./membershipBilling.js";

function withEnv(
  overrides: Partial<Record<
    | "FRONTEND_URL"
    | "APP_URL"
    | "VITE_APP_URL"
    | "NODE_ENV"
    | "STRIPE_SECRET_KEY"
    | "STRIPE_PRICE_SEEKER_MONTHLY"
    | "STRIPE_PRICE_SEEKER_ANNUAL"
    | "STRIPE_PRICE_INITIATE_MONTHLY"
    | "STRIPE_PRICE_INITIATE_ANNUAL"
    | "STRIPE_LIVE_PRICE_SEEKER_MONTHLY"
    | "STRIPE_LIVE_PRICE_SEEKER_ANNUAL"
    | "STRIPE_LIVE_PRICE_INITIATE_MONTHLY"
    | "STRIPE_LIVE_PRICE_INITIATE_ANNUAL",
    string | undefined
  >>,
  run: () => void,
) {
  const previous = new Map<string, string | undefined>();

  for (const key of [
    "FRONTEND_URL",
    "APP_URL",
    "VITE_APP_URL",
    "NODE_ENV",
    "STRIPE_SECRET_KEY",
    "STRIPE_PRICE_SEEKER_MONTHLY",
    "STRIPE_PRICE_SEEKER_ANNUAL",
    "STRIPE_PRICE_INITIATE_MONTHLY",
    "STRIPE_PRICE_INITIATE_ANNUAL",
    "STRIPE_LIVE_PRICE_SEEKER_MONTHLY",
    "STRIPE_LIVE_PRICE_SEEKER_ANNUAL",
    "STRIPE_LIVE_PRICE_INITIATE_MONTHLY",
    "STRIPE_LIVE_PRICE_INITIATE_ANNUAL",
  ] as const) {
    previous.set(key, process.env[key]);
    const nextValue = overrides[key];
    if (nextValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = nextValue;
    }
  }

  try {
    run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("getFrontendUrl prefers configured frontend URLs and strips trailing slashes", () => {
  withEnv(
    {
      FRONTEND_URL: "https://theprimementor.com/",
      APP_URL: "https://wrong.example.com",
      VITE_APP_URL: "https://also-wrong.example.com",
      NODE_ENV: "production",
    },
    () => {
      assert.equal(getFrontendUrl(), "https://theprimementor.com");
    },
  );
});

test("getFrontendUrl falls back to the production site in production", () => {
  withEnv(
    {
      FRONTEND_URL: undefined,
      APP_URL: undefined,
      VITE_APP_URL: undefined,
      NODE_ENV: "production",
    },
    () => {
      assert.equal(getFrontendUrl(), "https://theprimementor.com");
    },
  );
});

test("getFrontendUrl uses localhost fallback outside production", () => {
  withEnv(
    {
      FRONTEND_URL: undefined,
      APP_URL: undefined,
      VITE_APP_URL: undefined,
      NODE_ENV: "development",
    },
    () => {
      assert.equal(getFrontendUrl(), "http://localhost:3000");
    },
  );
});

test("resolveMembershipPriceId prefers live membership prices with a live Stripe key", () => {
  withEnv(
    {
      STRIPE_SECRET_KEY: "sk_live_example",
      STRIPE_PRICE_SEEKER_MONTHLY: "price_test_seeker_monthly",
      STRIPE_LIVE_PRICE_SEEKER_MONTHLY: undefined,
    },
    () => {
      const resolved = resolveMembershipPriceId("seeker", "monthly");
      assert.equal(resolved.priceId, "price_1TIL1WAd5V3LaCqjim2Zs3x8");
    },
  );
});

test("resolveMembershipPriceId prefers live initiate membership prices with a live Stripe key", () => {
  withEnv(
    {
      STRIPE_SECRET_KEY: "sk_live_example",
      STRIPE_PRICE_INITIATE_MONTHLY: "price_test_initiate_monthly",
      STRIPE_LIVE_PRICE_INITIATE_MONTHLY: undefined,
    },
    () => {
      const resolved = resolveMembershipPriceId("initiate", "monthly");
      assert.equal(resolved.priceId, "price_1TIL55Ad5V3LaCqjXkESzqeH");
    },
  );
});

test("resolveMembershipPriceId prefers live annual membership prices for both tiers", () => {
  withEnv(
    {
      STRIPE_SECRET_KEY: "sk_live_example",
      STRIPE_PRICE_SEEKER_ANNUAL: "price_test_seeker_annual",
      STRIPE_PRICE_INITIATE_ANNUAL: "price_test_initiate_annual",
      STRIPE_LIVE_PRICE_SEEKER_ANNUAL: undefined,
      STRIPE_LIVE_PRICE_INITIATE_ANNUAL: undefined,
    },
    () => {
      assert.equal(resolveMembershipPriceId("seeker", "annual").priceId, "price_1TILCKAd5V3LaCqj9HDFNWum");
      assert.equal(resolveMembershipPriceId("initiate", "annual").priceId, "price_1TILESAd5V3LaCqjLX4fWEd3");
    },
  );
});

test("resolveMembershipPriceId uses configured test membership price outside live mode", () => {
  withEnv(
    {
      STRIPE_SECRET_KEY: "sk_test_example",
      STRIPE_PRICE_SEEKER_MONTHLY: "price_test_seeker_monthly",
      STRIPE_LIVE_PRICE_SEEKER_MONTHLY: "price_live_seeker_monthly",
    },
    () => {
      const resolved = resolveMembershipPriceId("seeker", "monthly");
      assert.equal(resolved.priceId, "price_test_seeker_monthly");
      assert.equal(resolved.envKey, "STRIPE_PRICE_SEEKER_MONTHLY");
    },
  );
});
