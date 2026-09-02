import { createHttpError } from "../services/booking/errors.js";
import {
  ADRONIS_WEBINAR_EVENT,
  getWebinarEventById,
  isWebinarRegistrationOpen,
  type WebinarEventDefinition,
} from "./webinarEvents.js";

export const ADRONIS_WEBINAR_PRICE_ENV_KEY = "STRIPE_PRICE_ADRONIS_WEBINAR";
export const ADRONIS_WEBINAR_LIVE_PRICE_ENV_KEY = "STRIPE_LIVE_PRICE_ADRONIS_WEBINAR";

function isLiveStripeMode() {
  return process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_") ?? false;
}

export function resolveWebinarStripePriceId(event?: WebinarEventDefinition | null) {
  const target = event ?? ADRONIS_WEBINAR_EVENT;
  const envKey = isLiveStripeMode()
    ? ADRONIS_WEBINAR_LIVE_PRICE_ENV_KEY
    : ADRONIS_WEBINAR_PRICE_ENV_KEY;
  const envPriceId = process.env[envKey]?.trim();
  const priceId = envPriceId || target.stripePriceId?.trim() || "";

  if (!priceId) {
    throw createHttpError(
      500,
      `Stripe price is not configured for webinar event ${target.eventId}. Missing ${envKey} or event.stripePriceId.`,
    );
  }

  return { priceId, envKey, event: target, source: envPriceId ? "env" as const : "event" as const };
}

export function assertWebinarRegistrationOpen(event: WebinarEventDefinition, now = new Date()) {
  if (!isWebinarRegistrationOpen(event, now)) {
    throw createHttpError(409, "Registration for this webinar has closed.");
  }
}

export function assertWebinarStripeConfig() {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return;
  }
  const event = getWebinarEventById(ADRONIS_WEBINAR_EVENT.eventId);
  if (!event || !isWebinarRegistrationOpen(event)) {
    return;
  }
  resolveWebinarStripePriceId(event);
}
