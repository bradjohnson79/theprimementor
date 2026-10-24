import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../server.js";

// Same minimal env as guestCheckout.ratelimit.test.ts. No database is attached, and every /api/guest/
// route needs one (schema guard), so this covers the per-IP limit, which runs first. Token, honeypot
// and resubmit behavior is covered end to end against the local test DB by check/intake-e2e.mjs.
const REQUIRED_ENV: Record<string, string> = {
  OPENAI_API_KEY: "test",
  STRIPE_SECRET_KEY: "sk_test_x",
  STRIPE_WEBHOOK_SECRET: "whsec_test_x",
  STRIPE_PRICE_SEEKER_MONTHLY: "price_test_seeker_monthly",
  STRIPE_PRICE_INITIATE_MONTHLY: "price_test_initiate_monthly",
  STRIPE_PRICE_TRAINING_ENTRY: "price_test_training_entry",
  STRIPE_PRICE_TRAINING_SEEKER: "price_test_training_seeker",
  STRIPE_PRICE_TRAINING_INITIATE: "price_test_training_initiate",
  STRIPE_PRICE_REGENERATION_OFFER: "price_test_regeneration_offer",
};

async function makeApp(t: { after: (fn: () => Promise<void> | void) => void }) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }
  const app = await buildApp();
  t.after(async () => {
    await app.close();
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  return app;
}

test("guest intake: submit is rate limited per IP (10/min)", async (t) => {
  const app = await makeApp(t);
  for (let i = 0; i < 10; i += 1) {
    const res = await app.inject({ method: "POST", url: "/api/guest/intake/short/submit", remoteAddress: "203.0.113.22", payload: {} });
    assert.notEqual(res.statusCode, 429, `request ${i + 1} should not be rate limited`);
  }
  const limited = await app.inject({ method: "POST", url: "/api/guest/intake/short/submit", remoteAddress: "203.0.113.22", payload: {} });
  assert.equal(limited.statusCode, 429);
  const other = await app.inject({ method: "POST", url: "/api/guest/intake/short/submit", remoteAddress: "198.51.100.22", payload: {} });
  assert.notEqual(other.statusCode, 429, "a different IP has its own bucket");
});
