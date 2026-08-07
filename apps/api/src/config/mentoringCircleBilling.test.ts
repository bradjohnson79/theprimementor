import assert from "node:assert/strict";
import test from "node:test";
import {
  MENTORING_CIRCLE_LIVE_PRICE_ENV_KEY,
  MENTORING_CIRCLE_PRICE_ENV_KEY,
  resolveMentoringCircleStripePriceId,
} from "./mentoringCircleBilling.js";
import { getMentoringCircleEventOrThrow } from "../services/mentoringCircleService.js";

const ORIGINAL_ENV = { ...process.env };

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test("mentoring circle resolves the August event stripe price fallback", () => {
  process.env.STRIPE_SECRET_KEY = "sk_live_example";
  delete process.env[MENTORING_CIRCLE_LIVE_PRICE_ENV_KEY];
  delete process.env[MENTORING_CIRCLE_PRICE_ENV_KEY];

  const event = getMentoringCircleEventOrThrow("2026-08-16");
  assert.deepEqual(resolveMentoringCircleStripePriceId(event), {
    priceId: "price_1U1crjAd5V3LaCqjFeK5s5oK",
    envKey: MENTORING_CIRCLE_LIVE_PRICE_ENV_KEY,
    event,
    source: "event",
  });
});

test("mentoring circle live price prefers environment override", () => {
  process.env.STRIPE_SECRET_KEY = "sk_live_example";
  process.env[MENTORING_CIRCLE_LIVE_PRICE_ENV_KEY] = "price_live_override";

  const event = getMentoringCircleEventOrThrow("2026-08-16");
  assert.deepEqual(resolveMentoringCircleStripePriceId(event), {
    priceId: "price_live_override",
    envKey: MENTORING_CIRCLE_LIVE_PRICE_ENV_KEY,
    event,
    source: "env",
  });
});

test("mentoring circle test price uses the non-live environment key", () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  process.env[MENTORING_CIRCLE_PRICE_ENV_KEY] = "price_test_configured";

  const event = getMentoringCircleEventOrThrow("2026-08-16");
  assert.deepEqual(resolveMentoringCircleStripePriceId(event), {
    priceId: "price_test_configured",
    envKey: MENTORING_CIRCLE_PRICE_ENV_KEY,
    event,
    source: "env",
  });
});
