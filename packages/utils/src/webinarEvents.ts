export const ADRONIS_WEBINAR_EVENT_ID = "adronis-disclosure-to-contact-2026";
export const ADRONIS_WEBINAR_EVENT_KEY = ADRONIS_WEBINAR_EVENT_ID;
export const ADRONIS_WEBINAR_TITLE = "Adronis: From Disclosure to Contact";
export const ADRONIS_WEBINAR_PRESENTER = "Brad Johnson channeling Adronis";
export const ADRONIS_WEBINAR_PRICE_CENTS = 1499;
export const ADRONIS_WEBINAR_CURRENCY = "CAD";
export const ADRONIS_WEBINAR_TIMEZONE = "America/Los_Angeles";
export const ADRONIS_WEBINAR_STARTS_AT = "2026-09-12T10:00:00-07:00";
export const ADRONIS_WEBINAR_REGISTRATION_CLOSES_AT = "2026-09-12T09:00:00-07:00";
export const ADRONIS_WEBINAR_DURATION_MINUTES = 90;
export const ADRONIS_WEBINAR_DISPLAY_DATE = "Saturday, September 12, 2026";
export const ADRONIS_WEBINAR_DISPLAY_TIME = "10:00 AM Pacific / 1:00 PM Eastern";
export const ADRONIS_WEBINAR_POSTER_PATH = "/images/adronis-from-disclosure-to-contact.png";
export const ADRONIS_WEBINAR_POSTER_ALT =
  "Adronis: From Disclosure to Contact webinar with Brad Johnson, Saturday, September 12 at 10 AM Pacific.";
export const ADRONIS_WEBINAR_CHECKOUT_PATH = "/webinars/adronis-disclosure-to-contact";
export const ADRONIS_WEBINAR_THANK_YOU_PATH = "/webinars/adronis-disclosure-to-contact/thank-you";
export const ADRONIS_WEBINAR_BOOKING_TYPE_ID = "webinar-adronis-disclosure-to-contact";
export const ADRONIS_WEBINAR_AUTOCHECKOUT_PATH = `${ADRONIS_WEBINAR_CHECKOUT_PATH}?autocheckout=1`;

export const ADRONIS_WEBINAR_DESCRIPTION = [
  "Join Brad Johnson for a life-changing live webinar experience as he channels Adronis.",
  "Adronis will share deep insights into humanity’s path from the current phase of disclosure toward global first contact. Explore how this transition may unfold, what global contact could mean for humanity, and what may follow in its aftermath.",
  "The webinar will be held live on Zoom and will include an interactive question-and-answer session with Adronis.",
].join(" ");

export const ADRONIS_WEBINAR_FEATURE_BULLETS = [
  "Deep insights from Adronis on disclosure leading into global contact",
  "How the transition into first contact may occur",
  "What humanity may experience following global first contact",
  "Interactive live Q&A with Adronis",
  "Two live giveaways for the new Prime Body Healing Level 1 and Level 2 sessions",
  "A simple and powerful practice for Higher Self connection",
] as const;

const REGISTRATION_CLOSES_AT_MS = Date.parse(ADRONIS_WEBINAR_REGISTRATION_CLOSES_AT);

export function isAdronisWebinarRegistrationOpen(now = new Date()) {
  return now.getTime() < REGISTRATION_CLOSES_AT_MS;
}

export function formatAdronisWebinarPrice(cents = ADRONIS_WEBINAR_PRICE_CENTS, currency = ADRONIS_WEBINAR_CURRENCY) {
  const amount = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `${amount} ${currency}`;
}

export function getAdronisWebinarPublicCatalog(now = new Date()) {
  return {
    eventId: ADRONIS_WEBINAR_EVENT_ID,
    eventKey: ADRONIS_WEBINAR_EVENT_KEY,
    title: ADRONIS_WEBINAR_TITLE,
    presenter: ADRONIS_WEBINAR_PRESENTER,
    description: ADRONIS_WEBINAR_DESCRIPTION,
    featureBullets: [...ADRONIS_WEBINAR_FEATURE_BULLETS],
    startsAt: ADRONIS_WEBINAR_STARTS_AT,
    registrationClosesAt: ADRONIS_WEBINAR_REGISTRATION_CLOSES_AT,
    displayDate: ADRONIS_WEBINAR_DISPLAY_DATE,
    displayTime: ADRONIS_WEBINAR_DISPLAY_TIME,
    timezone: ADRONIS_WEBINAR_TIMEZONE,
    priceCents: ADRONIS_WEBINAR_PRICE_CENTS,
    currency: ADRONIS_WEBINAR_CURRENCY,
    displayPrice: formatAdronisWebinarPrice(),
    posterPath: ADRONIS_WEBINAR_POSTER_PATH,
    posterAlt: ADRONIS_WEBINAR_POSTER_ALT,
    checkoutPath: ADRONIS_WEBINAR_CHECKOUT_PATH,
    thankYouPath: ADRONIS_WEBINAR_THANK_YOU_PATH,
    registrationOpen: isAdronisWebinarRegistrationOpen(now),
  };
}
