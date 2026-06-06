import assert from "node:assert/strict";
import test from "node:test";
import { getBookingTypeStripePriceId, getSessionStripePriceId } from "./stripePrices.js";

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

    assert.equal(getSessionStripePriceId("qa_session"), "price_1Te0tkAd5V3LaCqjaF1A19RZ");
  } finally {
    process.env.STRIPE_SECRET_KEY = originalSecret;
    if (originalQa === undefined) delete process.env.STRIPE_PRICE_QA_SESSION;
    else process.env.STRIPE_PRICE_QA_SESSION = originalQa;
    if (originalLiveQa === undefined) delete process.env.STRIPE_LIVE_PRICE_QA_SESSION;
    else process.env.STRIPE_LIVE_PRICE_QA_SESSION = originalLiveQa;
  }
});

test("getBookingTypeStripePriceId resolves Q&A duration prices by booking type id", () => {
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const originalQa45 = process.env.STRIPE_PRICE_QA_SESSION_45;

  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_PRICE_QA_SESSION_45 = "price_test_qa_45";

    assert.equal(getBookingTypeStripePriceId("qa-session-45"), "price_test_qa_45");
  } finally {
    process.env.STRIPE_SECRET_KEY = originalSecret;
    if (originalQa45 === undefined) delete process.env.STRIPE_PRICE_QA_SESSION_45;
    else process.env.STRIPE_PRICE_QA_SESSION_45 = originalQa45;
  }
});

test("getBookingTypeStripePriceId fails fast for unmapped guided booking types", () => {
  assert.throws(
    () => getBookingTypeStripePriceId("unknown-session-45"),
    /Missing Stripe price mapping for booking type/,
  );
});
