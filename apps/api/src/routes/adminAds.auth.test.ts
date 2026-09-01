import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../server.js";

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

test("Admin Ads routes reject missing bearer auth", async (t) => {
  const restoreEnv = applyRequiredEnv();
  const app = await buildApp();
  t.after(async () => {
    await app.close();
    restoreEnv();
  });

  for (const url of [
    "/api/admin/ads/status",
    "/api/admin/ads/google/oauth/start",
    "/api/admin/ads/reporting/summary",
    "/api/admin/ads/reporting/campaigns",
    "/api/admin/ads/agent/health",
    "/api/admin/ads/agent/conversations",
    "/api/admin/ads/agent/memory",
    "/api/admin/ads/divin8-knowledge",
    "/api/admin/ads/pma/workspace",
    "/api/admin/ads/pma/projects",
  ]) {
    const response = await app.inject({ method: "GET", url });
    assert.equal(response.statusCode, 401, url);
    assert.equal(response.json().error, "Missing or invalid Authorization header");
  }

  const chat = await app.inject({
    method: "POST",
    url: "/api/admin/ads/agent/chat",
    payload: { message: "What is CTR in Google Ads?" },
  });
  assert.equal(chat.statusCode, 401);

  const validate = await app.inject({
    method: "POST",
    url: "/api/admin/ads/google/validate",
  });
  assert.equal(validate.statusCode, 401);

  for (const [method, url] of [
    ["GET", "/api/admin/ads/pma/campaigns"],
    ["POST", "/api/admin/ads/pma/analyze"],
    ["POST", "/api/admin/ads/pma/campaigns"],
  ] as const) {
    const response = await app.inject({
      method,
      url,
      payload: method === "POST" ? { project: "divin8-reports" } : undefined,
    });
    assert.equal(response.statusCode, 401, `${method} ${url}`);
  }
});
