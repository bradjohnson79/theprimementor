import Stripe from "stripe";
import {
  RESONANT_DOWSING_CURRENCY,
  RESONANT_DOWSING_PRICE_CENTS,
} from "../services/courses/resonantDowsingCourse.js";

export const RESONANT_DOWSING_STRIPE_PRICE_ID = "price_1ToFFCAd5V3LaCqj2pPuEFp9";
export const RESONANT_DOWSING_STRIPE_PRICE_ENV = "STRIPE_PRICE_RESONANT_DOWSING";
export const RESONANT_DOWSING_STRIPE_PRICE_MISMATCH_MESSAGE =
  "Resonant Dowsing Stripe configuration mismatch: Expected active one-time CAD price at 9900 cents.";

export function getResonantDowsingStripePriceId() {
  const configured = process.env[RESONANT_DOWSING_STRIPE_PRICE_ENV]?.trim();
  if (!configured) {
    throw new Error(`${RESONANT_DOWSING_STRIPE_PRICE_ENV} must be set to ${RESONANT_DOWSING_STRIPE_PRICE_ID}.`);
  }
  if (configured !== RESONANT_DOWSING_STRIPE_PRICE_ID) {
    throw new Error(RESONANT_DOWSING_STRIPE_PRICE_MISMATCH_MESSAGE);
  }
  return configured;
}

export function validateResonantDowsingStripePrice(price: Stripe.Price) {
  const currencyMatches = price.currency.toLowerCase() === RESONANT_DOWSING_CURRENCY.toLowerCase();
  const amountMatches = price.unit_amount === RESONANT_DOWSING_PRICE_CENTS;
  const typeMatches = price.type === "one_time";
  if (!price.active || !currencyMatches || !amountMatches || !typeMatches) {
    throw new Error(RESONANT_DOWSING_STRIPE_PRICE_MISMATCH_MESSAGE);
  }
  return true;
}

export async function verifyResonantDowsingStripePrice(stripe: Stripe) {
  const priceId = getResonantDowsingStripePriceId();
  const price = await stripe.prices.retrieve(priceId);
  validateResonantDowsingStripePrice(price);
  return price;
}
