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

test("Admin Emails routes reject missing bearer auth", async (t) => {
  const restoreEnv = applyRequiredEnv();
  const app = await buildApp();
  t.after(async () => {
    await app.close();
    restoreEnv();
  });

  for (const url of [
    "/api/admin/gmail/status",
    "/api/admin/email-contacts",
    "/api/admin/gmail/search-profiles",
    "/api/admin/email-contacts/exclusions",
  ]) {
    const response = await app.inject({ method: "GET", url });
    assert.equal(response.statusCode, 401, url);
    assert.equal(response.json().error, "Missing or invalid Authorization header");
  }

  const save = await app.inject({
    method: "POST",
    url: "/api/admin/gmail/candidates/save",
    payload: { searchSessionId: "x", candidateIds: ["y"] },
  });
  assert.equal(save.statusCode, 401);

  const searchImport = await app.inject({
    method: "POST",
    url: "/api/admin/gmail/search-import",
    payload: { query: "Adronis" },
  });
  assert.equal(searchImport.statusCode, 401);
});
