import assert from "node:assert/strict";
import test from "node:test";
import { getSessionStripePriceId } from "./stripePrices.js";

test("getSessionStripePriceId prefers live session prices with a live Stripe key", () => {
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const originalFocus = process.env.STRIPE_PRICE_FOCUS;
  const originalLiveFocus = process.env.STRIPE_LIVE_PRICE_FOCUS;

  try {
    process.env.STRIPE_SECRET_KEY = "sk_live_example";
    process.env.STRIPE_PRICE_FOCUS = "price_test_focus";
    delete process.env.STRIPE_LIVE_PRICE_FOCUS;

    assert.equal(getSessionStripePriceId("focus"), "price_1TILliAd5V3LaCqjidvbVLrl");
  } finally {
    process.env.STRIPE_SECRET_KEY = originalSecret;
    if (originalFocus === undefined) delete process.env.STRIPE_PRICE_FOCUS;
    else process.env.STRIPE_PRICE_FOCUS = originalFocus;
    if (originalLiveFocus === undefined) delete process.env.STRIPE_LIVE_PRICE_FOCUS;
    else process.env.STRIPE_LIVE_PRICE_FOCUS = originalLiveFocus;
  }
});

test("getSessionStripePriceId uses configured test price with a non-live Stripe key", () => {
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const originalFocus = process.env.STRIPE_PRICE_FOCUS;

  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_PRICE_FOCUS = "price_test_focus";

    assert.equal(getSessionStripePriceId("focus"), "price_test_focus");
  } finally {
    process.env.STRIPE_SECRET_KEY = originalSecret;
    if (originalFocus === undefined) delete process.env.STRIPE_PRICE_FOCUS;
    else process.env.STRIPE_PRICE_FOCUS = originalFocus;
  }
});

test("getSessionStripePriceId returns the Q&A live fallback price", () => {
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const originalQa = process.env.STRIPE_PRICE_QA_SESSION;
  const originalLiveQa = process.env.STRIPE_LIVE_PRICE_QA_SESSION;

  try {
    process.env.STRIPE_SECRET_KEY = "sk_live_example";
    delete process.env.STRIPE_PRICE_QA_SESSION;
    delete process.env.STRIPE_LIVE_PRICE_QA_SESSION;

    assert.equal(getSessionStripePriceId("qa_session"), "price_1TS1mkAd5V3LaCqjBfSoDdZn");
  } finally {
    process.env.STRIPE_SECRET_KEY = originalSecret;
    if (originalQa === undefined) delete process.env.STRIPE_PRICE_QA_SESSION;
    else process.env.STRIPE_PRICE_QA_SESSION = originalQa;
    if (originalLiveQa === undefined) delete process.env.STRIPE_LIVE_PRICE_QA_SESSION;
    else process.env.STRIPE_LIVE_PRICE_QA_SESSION = originalLiveQa;
  }
});
