import Stripe from "stripe";
import { createHttpError } from "../booking/errors.js";

export interface ShopCheckoutSessionOwner {
  userId: string;
  userEmail: string;
  clerkId: string;
}

export function isShopFulfillmentTestStubEnabled() {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.SHOP_TEST_FULFILLMENT === "1";
}

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw createHttpError(503, "Stripe is not configured.");
  }
  return new Stripe(key);
}

export async function retrieveShopCheckoutSession(
  sessionId: string,
  owner?: ShopCheckoutSessionOwner,
): Promise<Stripe.Checkout.Session> {
  if (isShopFulfillmentTestStubEnabled()) {
    const { retrieveStubbedShopCheckoutSession } = await import("./shopFulfillmentTestStub.js");
    const stubbed = retrieveStubbedShopCheckoutSession(sessionId, owner);
    if (stubbed) return stubbed;
    throw new Error("Unknown shop test checkout session");
  }
  return getStripeClient().checkout.sessions.retrieve(sessionId);
}
