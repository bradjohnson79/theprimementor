import { createHttpError } from "../services/booking/errors.js";
import {
  getActiveMentoringCirclePurchaseEvent,
  type MentoringCircleEventDefinition,
} from "../services/mentoringCircleService.js";

export const MENTORING_CIRCLE_PRICE_ENV_KEY = "STRIPE_PRICE_MENTORING_CIRCLE";
export const MENTORING_CIRCLE_LIVE_PRICE_ENV_KEY = "STRIPE_LIVE_PRICE_MENTORING_CIRCLE";

function isLiveStripeMode() {
  return process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_") ?? false;
}

export function resolveMentoringCircleStripePriceId(event?: MentoringCircleEventDefinition | null) {
  const target = event ?? getActiveMentoringCirclePurchaseEvent();
  if (!target) {
    throw createHttpError(409, "No Mentoring Circle event is currently available for purchase.");
  }

  const envKey = isLiveStripeMode()
    ? MENTORING_CIRCLE_LIVE_PRICE_ENV_KEY
    : MENTORING_CIRCLE_PRICE_ENV_KEY;
  const envPriceId = process.env[envKey]?.trim();
  const priceId = envPriceId || target.stripePriceId?.trim() || "";

  if (!priceId) {
    throw createHttpError(
      500,
      `Stripe price is not configured for Mentoring Circle event ${target.eventId}. Missing ${envKey} or event.stripePriceId.`,
    );
  }

  return { priceId, envKey, event: target, source: envPriceId ? "env" as const : "event" as const };
}

export function assertMentoringCircleStripeConfig() {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return;
  }
  const activeEvent = getActiveMentoringCirclePurchaseEvent();
  if (!activeEvent) {
    return;
  }
  resolveMentoringCircleStripePriceId(activeEvent);
}
