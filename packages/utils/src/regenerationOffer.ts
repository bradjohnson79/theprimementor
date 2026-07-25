export const REGENERATION_OFFER_CODE = "regeneration_offer_2026";
export const REGENERATION_OFFER_TITLE = "Regeneration Q&A Package";
export const REGENERATION_OFFER_SUBTITLE = "30-Day Regeneration Experience";
export const REGENERATION_OFFER_PRICE_CENTS = 14900;
export const REGENERATION_OFFER_CURRENCY = "cad";
export const REGENERATION_OFFER_TIMEZONE = "America/Vancouver";
export const REGENERATION_OFFER_ENDS_AT = "2026-08-31T23:59:59-07:00";
export const REGENERATION_OFFER_PATH = "/regeneration-offer";
export const REGENERATION_OFFER_BOOKING_TYPE_ID = "regeneration-qa-package";
export const REGENERATION_OFFER_BOOKING_PATH = `/sessions?bookingTypeId=${REGENERATION_OFFER_BOOKING_TYPE_ID}`;

export interface RegenerationOfferStatus {
  active: boolean;
  title: typeof REGENERATION_OFFER_TITLE;
  priceCents: typeof REGENERATION_OFFER_PRICE_CENTS;
  currency: typeof REGENERATION_OFFER_CURRENCY;
  endsAt: typeof REGENERATION_OFFER_ENDS_AT;
  timezone: typeof REGENERATION_OFFER_TIMEZONE;
}

export interface RegenerationOfferPackageMetadata {
  offerCode: typeof REGENERATION_OFFER_CODE;
  regenerationSessions: 1;
  priorityEmailSupportDays: 30;
  qaSessions: 1;
  qaDurationMinutes: 30;
  supportStartsOn: "regeneration_session_completion";
  qaMustBeUsedWithinSupportWindow: true;
  offerEndsAt: typeof REGENERATION_OFFER_ENDS_AT;
}

const REGENERATION_OFFER_ENDS_AT_MS = Date.parse(REGENERATION_OFFER_ENDS_AT);

export function getRegenerationOfferEndsAtUtc() {
  return new Date(REGENERATION_OFFER_ENDS_AT_MS).toISOString();
}

export function isRegenerationOfferActive(now = new Date()) {
  return now.getTime() <= REGENERATION_OFFER_ENDS_AT_MS;
}

export function getRegenerationOfferStatus(now = new Date()): RegenerationOfferStatus {
  return {
    active: isRegenerationOfferActive(now),
    title: REGENERATION_OFFER_TITLE,
    priceCents: REGENERATION_OFFER_PRICE_CENTS,
    currency: REGENERATION_OFFER_CURRENCY,
    endsAt: REGENERATION_OFFER_ENDS_AT,
    timezone: REGENERATION_OFFER_TIMEZONE,
  };
}

export function getRegenerationOfferPackageMetadata(): RegenerationOfferPackageMetadata {
  return {
    offerCode: REGENERATION_OFFER_CODE,
    regenerationSessions: 1,
    priorityEmailSupportDays: 30,
    qaSessions: 1,
    qaDurationMinutes: 30,
    supportStartsOn: "regeneration_session_completion",
    qaMustBeUsedWithinSupportWindow: true,
    offerEndsAt: REGENERATION_OFFER_ENDS_AT,
  };
}
