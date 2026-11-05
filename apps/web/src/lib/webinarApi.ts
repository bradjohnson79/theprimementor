import {
  ADRONIS_WEBINAR_EVENT_ID,
  STAR_INITIATION_WEBINAR_EVENT_ID,
  getAdronisWebinarPublicCatalog,
  getStarInitiationWebinarPublicCatalog,
} from "@wisdom/utils";
import { api } from "./api";

export type WebinarPublicCatalog = Omit<
  ReturnType<typeof getAdronisWebinarPublicCatalog>,
  "featureBullets"
> & {
  featureBullets: string[];
  maxAttendees?: number | null;
  seatsTaken?: number | null;
  seatsRemaining?: number | null;
  soldOut?: boolean;
  homeSummary?: string;
  homeHighlights?: string[];
  descriptionParagraphs?: string[];
  landscapePosterPath?: string;
};

export interface WebinarEventState extends WebinarPublicCatalog {
  bookingId: string | null;
  paymentId: string | null;
  paymentStatus: string | null;
  purchaseStatus: "not_started" | "pending_payment" | "confirmed";
  accessStatus: "locked" | "pending_payment" | "confirmed";
  joinEligible: boolean;
  registered: boolean;
  zoomRegistrationUrl: string | null;
}

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function fallbackPublicCatalog(eventId: string) {
  if (eventId === STAR_INITIATION_WEBINAR_EVENT_ID) {
    return getStarInitiationWebinarPublicCatalog();
  }
  return getAdronisWebinarPublicCatalog();
}

export async function fetchPublicWebinar(eventId = ADRONIS_WEBINAR_EVENT_ID) {
  try {
    const payload = await api.get(`/webinars/${encodeURIComponent(eventId)}`);
    return unwrapData<WebinarPublicCatalog>(payload);
  } catch {
    return fallbackPublicCatalog(eventId);
  }
}

export async function fetchWebinarMe(eventId: string, token: string | null) {
  const payload = await api.get(`/webinars/${encodeURIComponent(eventId)}/me`, token);
  return unwrapData<WebinarEventState>(payload);
}

export interface WebinarCheckoutConfirmation {
  status: "processing" | "ready";
  zoomRegistrationUrl?: string | null;
}

export async function fetchWebinarCheckoutConfirmation(eventId: string, checkoutSessionId: string) {
  const payload = await api.get(
    `/webinars/${encodeURIComponent(eventId)}/checkout-confirmation?checkoutSessionId=${encodeURIComponent(checkoutSessionId)}`,
  );
  return unwrapData<WebinarCheckoutConfirmation>(payload);
}

export async function fetchWebinarAccess(eventId: string, token: string | null) {
  const payload = await api.get(`/webinars/${encodeURIComponent(eventId)}/access`, token);
  return unwrapData<WebinarEventState>(payload);
}
