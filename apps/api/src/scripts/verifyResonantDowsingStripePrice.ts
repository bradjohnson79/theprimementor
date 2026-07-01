import "dotenv/config";
import Stripe from "stripe";
import {
  getResonantDowsingStripePriceId,
  verifyResonantDowsingStripePrice,
} from "../config/courseBilling.js";

const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) {
  throw new Error("STRIPE_SECRET_KEY must be set to verify the Resonant Dowsing Stripe price.");
}

const stripe = new Stripe(apiKey);
await verifyResonantDowsingStripePrice(stripe);
console.log(`Verified Resonant Dowsing Stripe price ${getResonantDowsingStripePriceId()}.`);
