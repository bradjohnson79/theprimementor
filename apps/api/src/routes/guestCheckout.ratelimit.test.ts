import assert from "node:assert/strict";
import test from "node:test";
import { buildApp, resolveTrustProxyHops } from "../server.js";

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

function applyRequiredEnv() {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }
  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

for (const url of ["/api/guest/order-access/issue", "/api/guest/resend-links"]) {
  test(`${url}: per-IP limit returns 429 (not 500) after 5 requests per 10 minutes`, async (t) => {
    const restoreEnv = applyRequiredEnv();
    const app = await buildApp();
    t.after(async () => {
      await app.close();
      restoreEnv();
    });

    for (let i = 0; i < 5; i += 1) {
      const res = await app.inject({ method: "POST", url, remoteAddress: "203.0.113.7", payload: { email: `x${i}@example.com` } });
      assert.notEqual(res.statusCode, 429, `request ${i + 1} should not be rate limited`);
    }
    const limited = await app.inject({ method: "POST", url, remoteAddress: "203.0.113.7", payload: { email: "x@example.com" } });
    assert.equal(limited.statusCode, 429);
    assert.equal(limited.json().error, "Too many requests, please try again later");

    const otherIp = await app.inject({ method: "POST", url, remoteAddress: "198.51.100.9", payload: { email: "y@example.com" } });
    assert.notEqual(otherIp.statusCode, 429, "a different IP has its own bucket");
  });
}

test("resolveTrustProxyHops: opt-in, bounded, default off", () => {
  assert.equal(resolveTrustProxyHops(undefined), false);
  assert.equal(resolveTrustProxyHops(""), false);
  assert.equal(resolveTrustProxyHops("0"), false);
  assert.equal(resolveTrustProxyHops("abc"), false);
  assert.equal(resolveTrustProxyHops("1"), 1);
  assert.equal(resolveTrustProxyHops("2"), 2);
  assert.equal(resolveTrustProxyHops("99"), false);
});
