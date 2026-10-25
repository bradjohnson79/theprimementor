import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGuestIntakeFormUrl,
  buildGuestThankYouUrl,
  intakeKindForEntity,
} from "./guestIntakeService.js";

const ORIGINAL = process.env.FRONTEND_URL;
test.after(() => {
  if (ORIGINAL === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = ORIGINAL;
});

test("intake kind: reports for report orders, services for everything else", () => {
  assert.equal(intakeKindForEntity("report"), "reports");
  assert.equal(intakeKindForEntity("session"), "services");
});

test("intake form URL: token is in the path and URL-encoded", () => {
  process.env.FRONTEND_URL = "https://example.test/";
  assert.equal(buildGuestIntakeFormUrl("abc_DEF-123", "services"), "https://example.test/intake/services/abc_DEF-123");
  assert.equal(buildGuestIntakeFormUrl("a/b?c", "reports"), "https://example.test/intake/reports/a%2Fb%3Fc");
});

test("thank-you URL: kind, product, intake token and Stripe's session placeholder", () => {
  process.env.FRONTEND_URL = "https://example.test";
  const url = buildGuestThankYouUrl({ token: "tok123", kind: "reports", product: "deep_dive" });
  assert.ok(url.startsWith("https://example.test/order/thank-you?"));
  // {CHECKOUT_SESSION_ID} must stay literal so Stripe can substitute it
  assert.ok(url.endsWith("&checkoutSessionId={CHECKOUT_SESSION_ID}"));
  const params = new URL(url.replace("{CHECKOUT_SESSION_ID}", "cs_test")).searchParams;
  assert.equal(params.get("kind"), "reports");
  assert.equal(params.get("product"), "deep_dive");
  assert.equal(params.get("intake"), "tok123");
});

test("thank-you URL uses the production site when no frontend URL is configured in production", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAppUrl = process.env.APP_URL;
  const previousViteUrl = process.env.VITE_APP_URL;
  delete process.env.FRONTEND_URL;
  delete process.env.APP_URL;
  delete process.env.VITE_APP_URL;
  process.env.NODE_ENV = "production";
  try {
    const url = buildGuestThankYouUrl({ token: "tok", kind: "services", product: "email-session" });
    assert.ok(url.startsWith("https://theprimementor.com/order/thank-you?"));
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previousAppUrl;
    if (previousViteUrl === undefined) delete process.env.VITE_APP_URL;
    else process.env.VITE_APP_URL = previousViteUrl;
  }
});

test("thank-you URL: product is optional", () => {
  process.env.FRONTEND_URL = "https://example.test";
  const params = new URL(buildGuestThankYouUrl({ token: "t", kind: "services" }).replace("{CHECKOUT_SESSION_ID}", "x")).searchParams;
  assert.equal(params.get("product"), null);
  assert.equal(params.get("kind"), "services");
});
