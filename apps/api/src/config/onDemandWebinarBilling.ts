import {
  ADRONIS_ON_DEMAND_WEBINAR_ID,
  getOnDemandWebinarById,
  type OnDemandWebinarCatalogEntry,
} from "@wisdom/utils";
import { createHttpError } from "../services/booking/errors.js";

export const ADRONIS_ON_DEMAND_PRICE_ENV_KEY = "STRIPE_PRICE_ADRONIS_ON_DEMAND";
export const ADRONIS_ON_DEMAND_LIVE_PRICE_ENV_KEY = "STRIPE_LIVE_PRICE_ADRONIS_ON_DEMAND";

export function isLiveStripeMode() {
  return process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_") ?? false;
}

export function resolveOnDemandWebinarStripePriceId(webinar?: OnDemandWebinarCatalogEntry | null) {
  const target = webinar ?? getOnDemandWebinarById(ADRONIS_ON_DEMAND_WEBINAR_ID);
  if (!target) {
    throw createHttpError(404, "On-demand webinar was not found.");
  }

  if (isLiveStripeMode()) {
    const livePriceId = process.env[ADRONIS_ON_DEMAND_LIVE_PRICE_ENV_KEY]?.trim() || target.liveStripePriceId.trim();
    if (!livePriceId) {
      throw createHttpError(
        500,
        `Stripe live price is not configured for ${target.webinarId}. Missing ${ADRONIS_ON_DEMAND_LIVE_PRICE_ENV_KEY} or catalog liveStripePriceId.`,
      );
    }
    return {
      priceId: livePriceId,
      envKey: ADRONIS_ON_DEMAND_LIVE_PRICE_ENV_KEY,
      webinar: target,
      source: process.env[ADRONIS_ON_DEMAND_LIVE_PRICE_ENV_KEY]?.trim() ? "env" as const : "catalog" as const,
    };
  }

  const testPriceId = process.env[ADRONIS_ON_DEMAND_PRICE_ENV_KEY]?.trim() || "";
  if (!testPriceId) {
    throw createHttpError(
      500,
      `Stripe test price is not configured for ${target.webinarId}. Missing ${ADRONIS_ON_DEMAND_PRICE_ENV_KEY}. Live price IDs are never used in test mode.`,
    );
  }

  return {
    priceId: testPriceId,
    envKey: ADRONIS_ON_DEMAND_PRICE_ENV_KEY,
    webinar: target,
    source: "env" as const,
  };
}

export function isAuthorizedOnDemandZeroTotalCheckout(metadata: Record<string, string | undefined> | null | undefined) {
  return metadata?.onDemandZeroTotalAuthorized === "true"
    && process.env.ON_DEMAND_WEBINAR_ALLOW_ZERO_TOTAL === "1";
}

export function canAcceptOnDemandPaymentStatus(input: {
  paymentStatus?: string | null;
  amountTotal?: number | null;
  metadata?: Record<string, string | undefined> | null;
}) {
  if (input.paymentStatus === "paid") {
    return true;
  }
  if (input.paymentStatus === "no_payment_required") {
    return input.amountTotal === 0 && isAuthorizedOnDemandZeroTotalCheckout(input.metadata);
  }
  return false;
}
