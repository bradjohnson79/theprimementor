import "dotenv/config";
import Stripe from "stripe";
import {
  diagnoseResonantDowsingStripePrice,
} from "../config/courseBilling.js";

const apiKey = process.env.STRIPE_SECRET_KEY?.trim();

if (!apiKey) {
  console.error(JSON.stringify({
    valid: false,
    validationResult: "invalid",
    validationFailureReason: "missing_environment_variable",
    message: "STRIPE_SECRET_KEY is not configured.",
  }, null, 2));
  process.exit(1);
}

const stripe = new Stripe(apiKey);
const diagnostics = await diagnoseResonantDowsingStripePrice(stripe);

console.log(JSON.stringify({
  accountId: diagnostics.stripeAccountId,
  accountLivemode: diagnostics.stripeAccountLivemode,
  configuredPriceId: diagnostics.configuredPriceId,
  priceExists: diagnostics.priceExists,
  active: diagnostics.active,
  currency: diagnostics.currency,
  unitAmount: diagnostics.unitAmount,
  type: diagnostics.type,
  priceLivemode: diagnostics.priceLivemode,
  valid: diagnostics.valid,
  validationResult: diagnostics.validationResult,
  validationFailureReason: diagnostics.validationFailureReason,
}, null, 2));

if (!diagnostics.valid) {
  process.exit(1);
}
