import Stripe from "stripe";
import { createHttpError } from "../booking/errors.js";

export function getShopStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw createHttpError(503, "STRIPE_SECRET_KEY is not configured.");
  }
  return new Stripe(key);
}

export function isLiveStripeSecret(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_"));
}

export function assertCanMutateShopStripe(): void {
  if (isLiveStripeSecret()) {
    throw createHttpError(
      503,
      "Localhost Shop will not create or replace live Stripe Products or Prices. Associate an existing Price ID instead.",
    );
  }
}

export interface VerifiedShopStripePrice {
  priceId: string;
  productId: string | null;
  unitAmount: number;
  currency: string;
  active: boolean;
  type: string;
}

export async function retrieveShopPriceProductId(stripe: Stripe, priceId: string): Promise<string | null> {
  const trimmed = priceId.trim();
  if (!trimmed.startsWith("price_")) {
    throw createHttpError(400, "A valid Stripe Price ID is required.");
  }
  try {
    const price = await stripe.prices.retrieve(trimmed);
    if (typeof price.product === "string") return price.product;
    if (price.product && !price.product.deleted) return price.product.id;
    return null;
  } catch {
    throw createHttpError(400, "Stripe Price ID could not be retrieved. Confirm the ID and Stripe mode.");
  }
}

export async function retrieveAndVerifyShopPrice(
  stripe: Stripe,
  input: { priceId: string; expectedCents: number; expectedCurrency: string; expectedProductId?: string | null },
): Promise<VerifiedShopStripePrice> {
  const priceId = input.priceId.trim();
  if (!priceId.startsWith("price_")) {
    throw createHttpError(400, "A valid Stripe Price ID is required.");
  }

  let price: Stripe.Price;
  try {
    price = await stripe.prices.retrieve(priceId);
  } catch {
    throw createHttpError(400, "Stripe Price ID could not be retrieved. Confirm the ID and Stripe mode.");
  }

  const currency = (price.currency ?? "").toLowerCase();
  const expectedCurrency = input.expectedCurrency.trim().toLowerCase();
  const unitAmount = price.unit_amount ?? null;
  const type = price.type ?? "unknown";
  const productId = typeof price.product === "string"
    ? price.product
    : price.product && !price.product.deleted
      ? price.product.id
      : null;

  const expectedProductId = input.expectedProductId?.trim() || null;
  const productMismatch = Boolean(expectedProductId && productId && expectedProductId !== productId);
  if (!price.active || type !== "one_time" || currency !== expectedCurrency || unitAmount !== input.expectedCents || productMismatch) {
    throw createHttpError(
      503,
      `Stripe Price does not match the Shop catalog. Expected active one-time ${expectedCurrency.toUpperCase()} ${input.expectedCents} cents.`,
    );
  }

  return {
    priceId: price.id,
    productId,
    unitAmount: unitAmount ?? 0,
    currency,
    active: price.active,
    type,
  };
}

export async function createShopStripeProductAndPrice(
  stripe: Stripe,
  input: { name: string; description?: string | null; amountCents: number; currency: string },
): Promise<VerifiedShopStripePrice> {
  assertCanMutateShopStripe();
  const product = await stripe.products.create({
    name: input.name,
    description: input.description?.trim() || undefined,
    metadata: { source: "prime_mentor_shop" },
  });
  const price = await stripe.prices.create({
    unit_amount: input.amountCents,
    currency: input.currency.toLowerCase(),
    product: product.id,
    metadata: { source: "prime_mentor_shop" },
  });
  return {
    priceId: price.id,
    productId: product.id,
    unitAmount: price.unit_amount ?? input.amountCents,
    currency: price.currency,
    active: Boolean(price.active),
    type: price.type ?? "one_time",
  };
}

export async function createReplacementShopStripePrice(
  stripe: Stripe,
  input: { productId: string; amountCents: number; currency: string },
): Promise<VerifiedShopStripePrice> {
  assertCanMutateShopStripe();
  if (!input.productId.trim()) {
    throw createHttpError(400, "A Stripe Product ID is required before a new Price can be created.");
  }
  const price = await stripe.prices.create({
    unit_amount: input.amountCents,
    currency: input.currency.toLowerCase(),
    product: input.productId.trim(),
    metadata: { source: "prime_mentor_shop_price_change" },
  });
  return {
    priceId: price.id,
    productId: input.productId.trim(),
    unitAmount: price.unit_amount ?? input.amountCents,
    currency: price.currency,
    active: Boolean(price.active),
    type: price.type ?? "one_time",
  };
}
