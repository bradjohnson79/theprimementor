import {
  ADRONIS_WEBINAR_BOOKING_TYPE_ID,
  ADRONIS_WEBINAR_CURRENCY,
  ADRONIS_WEBINAR_DISPLAY_DATE,
  ADRONIS_WEBINAR_DISPLAY_TIME,
  ADRONIS_WEBINAR_DURATION_MINUTES,
  ADRONIS_WEBINAR_EVENT_ID,
  ADRONIS_WEBINAR_EVENT_KEY,
  ADRONIS_WEBINAR_FEATURE_BULLETS,
  ADRONIS_WEBINAR_POSTER_ALT,
  ADRONIS_WEBINAR_POSTER_PATH,
  ADRONIS_WEBINAR_PRESENTER,
  ADRONIS_WEBINAR_PRICE_CENTS,
  ADRONIS_WEBINAR_REGISTRATION_CLOSES_AT,
  ADRONIS_WEBINAR_STARTS_AT,
  ADRONIS_WEBINAR_THANK_YOU_PATH,
  ADRONIS_WEBINAR_TIMEZONE,
  ADRONIS_WEBINAR_TITLE,
  ADRONIS_WEBINAR_DESCRIPTION,
  STAR_FAMILY_WEBINAR_BOOKING_TYPE_ID,
  STAR_FAMILY_WEBINAR_CURRENCY,
  STAR_FAMILY_WEBINAR_DESCRIPTION,
  STAR_FAMILY_WEBINAR_DISPLAY_DATE,
  STAR_FAMILY_WEBINAR_DISPLAY_TIME,
  STAR_FAMILY_WEBINAR_DURATION_MINUTES,
  STAR_FAMILY_WEBINAR_EVENT_ID,
  STAR_FAMILY_WEBINAR_EVENT_KEY,
  STAR_FAMILY_WEBINAR_FEATURE_BULLETS,
  STAR_FAMILY_WEBINAR_POSTER_ALT,
  STAR_FAMILY_WEBINAR_POSTER_PATH,
  STAR_FAMILY_WEBINAR_PRESENTER,
  STAR_FAMILY_WEBINAR_PRICE_CENTS,
  STAR_FAMILY_WEBINAR_REGISTRATION_CLOSES_AT,
  STAR_FAMILY_WEBINAR_STARTS_AT,
  STAR_FAMILY_WEBINAR_THANK_YOU_PATH,
  STAR_FAMILY_WEBINAR_TIMEZONE,
  STAR_FAMILY_WEBINAR_TITLE,
  isAdronisWebinarRegistrationOpen,
  isStarFamilyWebinarRegistrationOpen,
} from "@wisdom/utils";

export const ADRONIS_WEBINAR_STRIPE_PRICE_ID = "price_1UB1hYAd5V3LaCqjzuAw3IlI";
export const ADRONIS_WEBINAR_ZOOM_REGISTRATION_URL =
  "https://us02web.zoom.us/meeting/register/sCZZBeMQQgOQwsYb9XuM7Q";
export const ADRONIS_WEBINAR_CONFIRMATION_SUBJECT =
  "Your Adronis Webinar Registration — From Disclosure to Contact";
export const STAR_FAMILY_WEBINAR_STRIPE_PRICE_ID = "price_1UMYJiAd5V3LaCqjWcgD4gdr";
export const STAR_FAMILY_WEBINAR_ZOOM_REGISTRATION_URL =
  "https://us02web.zoom.us/meeting/register/eTHsHKnRQ16W0yoB5HaR6Q";
export const STAR_FAMILY_WEBINAR_ZOOM_ENV_KEY = "ZOOM_REGISTRATION_URL_ADRONIS_STAR_FAMILY_COMMUNION";
export const STAR_FAMILY_WEBINAR_CONFIRMATION_SUBJECT =
  "You’re Registered — Adronis: Star Family Communion";

export interface WebinarEventDefinition {
  eventId: string;
  eventKey: string;
  eventTitle: string;
  presenter: string;
  description: string;
  featureBullets: string[];
  eventStartAt: string;
  registrationClosesAt: string;
  displayDate: string;
  displayTime: string;
  timezone: string;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  posterPath: string;
  posterAlt: string;
  stripePriceId: string;
  zoomRegistrationUrl: string;
  thankYouPath: string;
  bookingTypeId: string;
  confirmationEmailSubject: string;
  active: boolean;
  grantsComplimentaryRecording: boolean;
  testPriceEnvKey: string;
  livePriceEnvKey: string;
  allowTestLivePriceFallback: boolean;
}

export const ADRONIS_WEBINAR_EVENT: WebinarEventDefinition = {
  eventId: ADRONIS_WEBINAR_EVENT_ID,
  eventKey: ADRONIS_WEBINAR_EVENT_KEY,
  eventTitle: ADRONIS_WEBINAR_TITLE,
  presenter: ADRONIS_WEBINAR_PRESENTER,
  description: ADRONIS_WEBINAR_DESCRIPTION,
  featureBullets: [...ADRONIS_WEBINAR_FEATURE_BULLETS],
  eventStartAt: ADRONIS_WEBINAR_STARTS_AT,
  registrationClosesAt: ADRONIS_WEBINAR_REGISTRATION_CLOSES_AT,
  displayDate: ADRONIS_WEBINAR_DISPLAY_DATE,
  displayTime: ADRONIS_WEBINAR_DISPLAY_TIME,
  timezone: ADRONIS_WEBINAR_TIMEZONE,
  durationMinutes: ADRONIS_WEBINAR_DURATION_MINUTES,
  priceCents: ADRONIS_WEBINAR_PRICE_CENTS,
  currency: ADRONIS_WEBINAR_CURRENCY,
  posterPath: ADRONIS_WEBINAR_POSTER_PATH,
  posterAlt: ADRONIS_WEBINAR_POSTER_ALT,
  stripePriceId: ADRONIS_WEBINAR_STRIPE_PRICE_ID,
  zoomRegistrationUrl: ADRONIS_WEBINAR_ZOOM_REGISTRATION_URL,
  thankYouPath: ADRONIS_WEBINAR_THANK_YOU_PATH,
  bookingTypeId: ADRONIS_WEBINAR_BOOKING_TYPE_ID,
  confirmationEmailSubject: ADRONIS_WEBINAR_CONFIRMATION_SUBJECT,
  active: true,
  grantsComplimentaryRecording: false,
  testPriceEnvKey: "STRIPE_PRICE_ADRONIS_WEBINAR",
  livePriceEnvKey: "STRIPE_LIVE_PRICE_ADRONIS_WEBINAR",
  allowTestLivePriceFallback: true,
};

export const STAR_FAMILY_WEBINAR_EVENT: WebinarEventDefinition = {
  eventId: STAR_FAMILY_WEBINAR_EVENT_ID,
  eventKey: STAR_FAMILY_WEBINAR_EVENT_KEY,
  eventTitle: STAR_FAMILY_WEBINAR_TITLE,
  presenter: STAR_FAMILY_WEBINAR_PRESENTER,
  description: STAR_FAMILY_WEBINAR_DESCRIPTION,
  featureBullets: [...STAR_FAMILY_WEBINAR_FEATURE_BULLETS],
  eventStartAt: STAR_FAMILY_WEBINAR_STARTS_AT,
  registrationClosesAt: STAR_FAMILY_WEBINAR_REGISTRATION_CLOSES_AT,
  displayDate: STAR_FAMILY_WEBINAR_DISPLAY_DATE,
  displayTime: STAR_FAMILY_WEBINAR_DISPLAY_TIME,
  timezone: STAR_FAMILY_WEBINAR_TIMEZONE,
  durationMinutes: STAR_FAMILY_WEBINAR_DURATION_MINUTES,
  priceCents: STAR_FAMILY_WEBINAR_PRICE_CENTS,
  currency: STAR_FAMILY_WEBINAR_CURRENCY,
  posterPath: STAR_FAMILY_WEBINAR_POSTER_PATH,
  posterAlt: STAR_FAMILY_WEBINAR_POSTER_ALT,
  stripePriceId: STAR_FAMILY_WEBINAR_STRIPE_PRICE_ID,
  zoomRegistrationUrl: STAR_FAMILY_WEBINAR_ZOOM_REGISTRATION_URL,
  thankYouPath: STAR_FAMILY_WEBINAR_THANK_YOU_PATH,
  bookingTypeId: STAR_FAMILY_WEBINAR_BOOKING_TYPE_ID,
  confirmationEmailSubject: STAR_FAMILY_WEBINAR_CONFIRMATION_SUBJECT,
  active: true,
  grantsComplimentaryRecording: true,
  testPriceEnvKey: "STRIPE_PRICE_ADRONIS_STAR_FAMILY_COMMUNION",
  livePriceEnvKey: "STRIPE_LIVE_PRICE_ADRONIS_STAR_FAMILY_COMMUNION",
  allowTestLivePriceFallback: false,
};

const WEBINAR_EVENTS: WebinarEventDefinition[] = [ADRONIS_WEBINAR_EVENT, STAR_FAMILY_WEBINAR_EVENT];

export function listWebinarEvents() {
  return WEBINAR_EVENTS;
}

export function getWebinarEventById(eventId?: string | null) {
  const normalized = eventId?.trim();
  if (!normalized) return null;
  return WEBINAR_EVENTS.find((event) =>
    event.eventId === normalized || event.eventKey === normalized,
  ) ?? null;
}

export function isWebinarRegistrationOpen(event: WebinarEventDefinition, now = new Date()) {
  if (!event.active) return false;
  if (event.eventId === ADRONIS_WEBINAR_EVENT_ID) {
    return isAdronisWebinarRegistrationOpen(now);
  }
  if (event.eventId === STAR_FAMILY_WEBINAR_EVENT_ID) {
    return isStarFamilyWebinarRegistrationOpen(now);
  }
  return now.getTime() < new Date(event.registrationClosesAt).getTime();
}

export function resolveWebinarZoomRegistrationUrl(event: WebinarEventDefinition) {
  if (event.eventId !== STAR_FAMILY_WEBINAR_EVENT_ID) {
    return event.zoomRegistrationUrl;
  }
  const configured = process.env[STAR_FAMILY_WEBINAR_ZOOM_ENV_KEY]?.trim();
  return configured || STAR_FAMILY_WEBINAR_ZOOM_REGISTRATION_URL;
}
