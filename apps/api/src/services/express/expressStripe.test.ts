import test from "node:test";
import assert from "node:assert/strict";
import { expressCheckoutSelection, expressLivePriceId, expressTranscriptionPriceId } from "./expressStripe.js";

test("Express live prices use the configured Stripe price for each service", () => {
  assert.equal(expressLivePriceId("ask", {}), "price_1UZvGHAd5V3LaCqjyY6GLQEJ");
  assert.equal(expressLivePriceId("healing", {}), "price_1UZvJPAd5V3LaCqjG4Q4j5k0");
  assert.equal(expressLivePriceId("past-life", {}), "price_1UZvHNAd5V3LaCqj4yMnfbem");
  assert.equal(expressLivePriceId("ask", { STRIPE_LIVE_PRICE_EXPRESS_ASK: "price_override" }), "price_override");
  assert.equal(expressTranscriptionPriceId({}), "price_1UZvY4Ad5V3LaCqjmrqFwrnn");
  assert.equal(
    expressTranscriptionPriceId({ STRIPE_LIVE_PRICE_EXPRESS_TRANSCRIPTION: "price_override" }),
    "price_override",
  );
});

test("Ask Brad / Adronis checkout can charge one to three sessions and one transcription", () => {
  const three = expressCheckoutSelection({ serviceId: "ask", transcription: true, quantity: 3 });
  assert.equal(three.quantity, 3);
  assert.equal(three.amountCents, 6600);
  assert.deepEqual(three.lineItems, [
    { price: "price_1UZvGHAd5V3LaCqjyY6GLQEJ", quantity: 3 },
    { price: "price_1UZvY4Ad5V3LaCqjmrqFwrnn", quantity: 1 },
  ]);
  const healing = expressCheckoutSelection({ serviceId: "healing", transcription: false, quantity: 3 });
  assert.equal(healing.quantity, 1);
  assert.equal(healing.lineItems[0]?.quantity, 1);
  assert.throws(() => expressCheckoutSelection({ serviceId: "ask", transcription: false, quantity: 4 }));
});
