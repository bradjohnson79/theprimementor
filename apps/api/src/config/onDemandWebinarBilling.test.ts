import assert from "node:assert/strict";
import test from "node:test";
import {
  ADRONIS_ON_DEMAND_LIVE_STRIPE_PRICE_ID,
  ADRONIS_ON_DEMAND_WEBINAR_ID,
  getOnDemandWebinarById,
} from "@wisdom/utils";
import {
  canAcceptOnDemandPaymentStatus,
  resolveOnDemandWebinarStripePriceId,
} from "./onDemandWebinarBilling.js";

test("test-mode Stripe price never falls back to the live Price ID", () => {
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const previousTest = process.env.STRIPE_PRICE_ADRONIS_ON_DEMAND;
  const previousLive = process.env.STRIPE_LIVE_PRICE_ADRONIS_ON_DEMAND;
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  delete process.env.STRIPE_PRICE_ADRONIS_ON_DEMAND;
  process.env.STRIPE_LIVE_PRICE_ADRONIS_ON_DEMAND = ADRONIS_ON_DEMAND_LIVE_STRIPE_PRICE_ID;

  assert.throws(
    () => resolveOnDemandWebinarStripePriceId(getOnDemandWebinarById(ADRONIS_ON_DEMAND_WEBINAR_ID)),
    /test price is not configured|never used in test mode/i,
  );

  process.env.STRIPE_PRICE_ADRONIS_ON_DEMAND = "price_test_on_demand";
  const resolved = resolveOnDemandWebinarStripePriceId(getOnDemandWebinarById(ADRONIS_ON_DEMAND_WEBINAR_ID));
  assert.equal(resolved.priceId, "price_test_on_demand");
  assert.notEqual(resolved.priceId, ADRONIS_ON_DEMAND_LIVE_STRIPE_PRICE_ID);

  process.env.STRIPE_SECRET_KEY = previousSecret;
  if (previousTest === undefined) delete process.env.STRIPE_PRICE_ADRONIS_ON_DEMAND;
  else process.env.STRIPE_PRICE_ADRONIS_ON_DEMAND = previousTest;
  if (previousLive === undefined) delete process.env.STRIPE_LIVE_PRICE_ADRONIS_ON_DEMAND;
  else process.env.STRIPE_LIVE_PRICE_ADRONIS_ON_DEMAND = previousLive;
});

test("live-mode Stripe price can use the catalog live Price ID", () => {
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const previousLive = process.env.STRIPE_LIVE_PRICE_ADRONIS_ON_DEMAND;
  process.env.STRIPE_SECRET_KEY = "sk_live_example";
  delete process.env.STRIPE_LIVE_PRICE_ADRONIS_ON_DEMAND;
  const resolved = resolveOnDemandWebinarStripePriceId(getOnDemandWebinarById(ADRONIS_ON_DEMAND_WEBINAR_ID));
  assert.equal(resolved.priceId, ADRONIS_ON_DEMAND_LIVE_STRIPE_PRICE_ID);
  process.env.STRIPE_SECRET_KEY = previousSecret;
  if (previousLive === undefined) delete process.env.STRIPE_LIVE_PRICE_ADRONIS_ON_DEMAND;
  else process.env.STRIPE_LIVE_PRICE_ADRONIS_ON_DEMAND = previousLive;
});

test("no_payment_required is rejected unless explicitly authorized", () => {
  assert.equal(canAcceptOnDemandPaymentStatus({ paymentStatus: "paid", amountTotal: 799 }), true);
  assert.equal(canAcceptOnDemandPaymentStatus({
    paymentStatus: "no_payment_required",
    amountTotal: 0,
  }), false);
  assert.equal(canAcceptOnDemandPaymentStatus({
    paymentStatus: "no_payment_required",
    amountTotal: 0,
    metadata: { onDemandZeroTotalAuthorized: "true" },
  }), false);

  const previous = process.env.ON_DEMAND_WEBINAR_ALLOW_ZERO_TOTAL;
  process.env.ON_DEMAND_WEBINAR_ALLOW_ZERO_TOTAL = "1";
  assert.equal(canAcceptOnDemandPaymentStatus({
    paymentStatus: "no_payment_required",
    amountTotal: 0,
    metadata: { onDemandZeroTotalAuthorized: "true" },
  }), true);
  if (previous === undefined) delete process.env.ON_DEMAND_WEBINAR_ALLOW_ZERO_TOTAL;
  else process.env.ON_DEMAND_WEBINAR_ALLOW_ZERO_TOTAL = previous;
});
