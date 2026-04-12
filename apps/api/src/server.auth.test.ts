import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "./server.js";

const REQUIRED_ENV: Record<string, string> = {
  OPENAI_API_KEY: "test",
  STRIPE_SECRET_KEY: "sk_test_x",
  STRIPE_WEBHOOK_SECRET: "whsec_test_x",
  STRIPE_PRICE_SEEKER_MONTHLY: "price_test_seeker_monthly",
  STRIPE_PRICE_INITIATE_MONTHLY: "price_test_initiate_monthly",
  STRIPE_PRICE_TRAINING_ENTRY: "price_test_training_entry",
  STRIPE_PRICE_TRAINING_SEEKER: "price_test_training_seeker",
  STRIPE_PRICE_TRAINING_INITIATE: "price_test_training_initiate",
};

function applyRequiredEnv() {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

test("GET /api/health preserves legacy payload shape", async (t) => {
  const restoreEnv = applyRequiredEnv();
  const app = await buildApp();
  t.after(async () => {
    await app.close();
    restoreEnv();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/health",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
});

test("GET /api/health/ephemeris exposes initialized health state", async (t) => {
  const restoreEnv = applyRequiredEnv();
  const app = await buildApp();
  t.after(async () => {
    await app.close();
    restoreEnv();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/health/ephemeris",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "ok",
    ephemeris: {
      initialized: true,
      ephemerisPath: response.json().ephemeris.ephemerisPath,
      requiredFile: "sepl_18.se1",
      requiredFilePath: response.json().ephemeris.requiredFilePath,
      initializedAt: response.json().ephemeris.initializedAt,
      lastError: null,
    },
  });
});

test("GET /api/me rejects requests without bearer auth", async (t) => {
  const restoreEnv = applyRequiredEnv();
  const app = await buildApp();
  t.after(async () => {
    await app.close();
    restoreEnv();
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/me",
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    error: "Missing or invalid Authorization header",
  });
});

test("runtime adapter rejects raw JSON payloads that bypass ok()/fail()", async (t) => {
  const restoreEnv = applyRequiredEnv();
  const app = await buildApp();
  app.get("/_test/raw-json-bypass", async () => ({ raw: true }));

  t.after(async () => {
    await app.close();
    restoreEnv();
  });

  const response = await app.inject({
    method: "GET",
    url: "/_test/raw-json-bypass",
  });

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json(), {
    error: "Internal API responses must return ok()/fail() envelopes before serialization.",
  });
});
