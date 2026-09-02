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
  isAdronisWebinarRegistrationOpen,
} from "@wisdom/utils";

export const ADRONIS_WEBINAR_STRIPE_PRICE_ID = "price_1UB1hYAd5V3LaCqjzuAw3IlI";
export const ADRONIS_WEBINAR_ZOOM_REGISTRATION_URL =
  "https://us02web.zoom.us/meeting/register/sCZZBeMQQgOQwsYb9XuM7Q";
export const ADRONIS_WEBINAR_CONFIRMATION_SUBJECT =
  "Your Adronis Webinar Registration — From Disclosure to Contact";

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
};

const WEBINAR_EVENTS: WebinarEventDefinition[] = [ADRONIS_WEBINAR_EVENT];

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
  return now.getTime() < new Date(event.registrationClosesAt).getTime();
}
