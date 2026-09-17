export const ADRONIS_ON_DEMAND_WEBINAR_ID = "adronis-disclosure-to-contact-on-demand";
export const ADRONIS_ON_DEMAND_WEBINAR_TITLE = "Adronis: From Disclosure to Contact";
export const ADRONIS_ON_DEMAND_WEBINAR_KIND = "on_demand_recording" as const;
export const ADRONIS_ON_DEMAND_PRICE_CENTS = 799;
export const ADRONIS_ON_DEMAND_CURRENCY = "CAD";
export const ADRONIS_ON_DEMAND_LIVE_STRIPE_PRICE_ID = "price_1UFd7kAd5V3LaCqjFX6qZeRU";
export const ADRONIS_ON_DEMAND_PLAYBACK_ID = "iEwnjRE3o8jKpy7n1Uw2gLYGS5CdTTRLfOxHM00ScWpc";
export const ADRONIS_ON_DEMAND_DURATION_SECONDS = 8331;
export const ADRONIS_ON_DEMAND_POSTER_PATH = "/images/adronis-from-disclosure-to-contact-on-demand.jpg";
export const ADRONIS_ON_DEMAND_POSTER_ALT =
  "Adronis: From Disclosure to Contact on-demand webinar. Available now on demand for $7.99.";
export const ADRONIS_ON_DEMAND_CHECKOUT_PATH = "/webinars/adronis-disclosure-to-contact/on-demand";
export const ADRONIS_ON_DEMAND_THANK_YOU_PATH = "/webinars/adronis-disclosure-to-contact/on-demand/thank-you";
export const ADRONIS_ON_DEMAND_PLAYER_PATH = `/dashboard/webinars/${ADRONIS_ON_DEMAND_WEBINAR_ID}`;
export const ADRONIS_ON_DEMAND_AUTOCHECKOUT_PATH = `${ADRONIS_ON_DEMAND_CHECKOUT_PATH}?autocheckout=1`;
export const ADRONIS_ON_DEMAND_CANCEL_PATH = "/";
export const ADRONIS_ON_DEMAND_PRESENTER = "Brad Johnson channeling Adronis";

export const ADRONIS_ON_DEMAND_DESCRIPTION = [
  "Watch the recorded Adronis webinar with Brad Johnson on humanity’s path from disclosure toward global first contact.",
  "This is the full on-demand recording, including the original question-and-answer session and a simple practice for Higher Self connection.",
].join(" ");

export const ADRONIS_ON_DEMAND_FEATURE_BULLETS = [
  "Deep insights from Adronis on disclosure leading into global contact",
  "How the transition into first contact may occur",
  "What humanity may experience following global first contact",
  "The recorded question-and-answer session with Adronis",
  "A simple and powerful practice for Higher Self connection",
] as const;

export type OnDemandWebinarKind = typeof ADRONIS_ON_DEMAND_WEBINAR_KIND;

export interface OnDemandWebinarCatalogEntry {
  webinarId: string;
  title: string;
  presenter: string;
  kind: OnDemandWebinarKind;
  description: string;
  featureBullets: string[];
  priceCents: number;
  currency: string;
  liveStripePriceId: string;
  playbackId: string;
  durationSeconds: number;
  posterPath: string;
  posterAlt: string;
  checkoutPath: string;
  thankYouPath: string;
  playerPath: string;
  autocheckoutPath: string;
  published: boolean;
}

export interface OnDemandWebinarMediaReadiness {
  assetReady: boolean;
  playbackProtected: boolean;
  muxAssetId?: string | null;
}

export const ON_DEMAND_WEBINARS: readonly OnDemandWebinarCatalogEntry[] = [
  {
    webinarId: ADRONIS_ON_DEMAND_WEBINAR_ID,
    title: ADRONIS_ON_DEMAND_WEBINAR_TITLE,
    presenter: ADRONIS_ON_DEMAND_PRESENTER,
    kind: ADRONIS_ON_DEMAND_WEBINAR_KIND,
    description: ADRONIS_ON_DEMAND_DESCRIPTION,
    featureBullets: [...ADRONIS_ON_DEMAND_FEATURE_BULLETS],
    priceCents: ADRONIS_ON_DEMAND_PRICE_CENTS,
    currency: ADRONIS_ON_DEMAND_CURRENCY,
    liveStripePriceId: ADRONIS_ON_DEMAND_LIVE_STRIPE_PRICE_ID,
    playbackId: ADRONIS_ON_DEMAND_PLAYBACK_ID,
    durationSeconds: ADRONIS_ON_DEMAND_DURATION_SECONDS,
    posterPath: ADRONIS_ON_DEMAND_POSTER_PATH,
    posterAlt: ADRONIS_ON_DEMAND_POSTER_ALT,
    checkoutPath: ADRONIS_ON_DEMAND_CHECKOUT_PATH,
    thankYouPath: ADRONIS_ON_DEMAND_THANK_YOU_PATH,
    playerPath: ADRONIS_ON_DEMAND_PLAYER_PATH,
    autocheckoutPath: ADRONIS_ON_DEMAND_AUTOCHECKOUT_PATH,
    published: true,
  },
];

export function getOnDemandWebinarById(webinarId: string) {
  return ON_DEMAND_WEBINARS.find((entry) => entry.webinarId === webinarId) ?? null;
}

export function listPublishedOnDemandWebinars() {
  return ON_DEMAND_WEBINARS.filter((entry) => entry.published);
}

export function isOnDemandWebinarSaleable(
  webinar: Pick<OnDemandWebinarCatalogEntry, "published">,
  readiness: Pick<OnDemandWebinarMediaReadiness, "assetReady" | "playbackProtected">,
) {
  return webinar.published === true
    && readiness.assetReady === true
    && readiness.playbackProtected === true;
}

export function formatOnDemandWebinarPrice(
  cents = ADRONIS_ON_DEMAND_PRICE_CENTS,
  currency = ADRONIS_ON_DEMAND_CURRENCY,
) {
  const amount = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `${amount} ${currency}`;
}

export function formatOnDemandWebinarDuration(durationSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(durationSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function boundOnDemandProgressSeconds(positionSeconds: number, durationSeconds: number) {
  if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds)) {
    return 0;
  }
  const max = Math.max(0, Math.floor(durationSeconds));
  return Math.min(max, Math.max(0, Math.floor(positionSeconds)));
}

export function getOnDemandWebinarPublicCatalog(
  webinar: OnDemandWebinarCatalogEntry,
  readiness: OnDemandWebinarMediaReadiness,
) {
  return {
    webinarId: webinar.webinarId,
    title: webinar.title,
    presenter: webinar.presenter,
    kind: webinar.kind,
    description: webinar.description,
    featureBullets: [...webinar.featureBullets],
    priceCents: webinar.priceCents,
    currency: webinar.currency,
    displayPrice: formatOnDemandWebinarPrice(webinar.priceCents, webinar.currency),
    durationSeconds: webinar.durationSeconds,
    displayDuration: formatOnDemandWebinarDuration(webinar.durationSeconds),
    posterPath: webinar.posterPath,
    posterAlt: webinar.posterAlt,
    checkoutPath: webinar.checkoutPath,
    thankYouPath: webinar.thankYouPath,
    playerPath: webinar.playerPath,
    autocheckoutPath: webinar.autocheckoutPath,
    published: webinar.published,
    assetReady: readiness.assetReady,
    playbackProtected: readiness.playbackProtected,
    saleable: isOnDemandWebinarSaleable(webinar, readiness),
    muxAssetId: readiness.muxAssetId ?? null,
  };
}
