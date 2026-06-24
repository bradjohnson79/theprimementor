import "dotenv/config";
import Stripe from "stripe";
import { CANONICAL_SESSION_OFFERINGS } from "@wisdom/utils";
import { createDb } from "@wisdom/db";
import { getBookingTypeStripePriceId } from "../config/stripePrices.js";
import { validateActiveCanonicalBookingTypeCatalog } from "../services/booking/bookingTypesService.js";

function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  return createDb(databaseUrl);
}

function createStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

async function validateStripePrices(stripe: Stripe | null) {
  const errors: string[] = [];
  if (!stripe) {
    return errors;
  }

  for (const offering of CANONICAL_SESSION_OFFERINGS) {
    const priceId = getBookingTypeStripePriceId(offering.bookingTypeId);
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active) {
      errors.push(`${offering.bookingTypeId} Stripe price ${priceId} is not active`);
    }
    if (price.currency.toUpperCase() !== offering.currency) {
      errors.push(`${offering.bookingTypeId} Stripe currency expected ${offering.currency}, found ${price.currency}`);
    }
    if (price.unit_amount !== offering.amountCents) {
      errors.push(`${offering.bookingTypeId} Stripe amount expected ${offering.amountCents}, found ${price.unit_amount}`);
    }
  }

  return errors;
}

async function main() {
  const db = createDatabase();
  const dbValidation = await validateActiveCanonicalBookingTypeCatalog(db);
  const stripe = createStripe();
  const stripeErrors = await validateStripePrices(stripe);
  const errors = [...dbValidation.errors, ...stripeErrors];

  if (errors.length > 0) {
    console.error("Session catalog validation failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.info(`Session catalog validation passed for ${CANONICAL_SESSION_OFFERINGS.length} canonical offerings.`);
  if (!stripe) {
    console.info("Stripe price verification skipped because STRIPE_SECRET_KEY is not configured.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
