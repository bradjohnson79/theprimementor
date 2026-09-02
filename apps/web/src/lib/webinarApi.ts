import {
  ADRONIS_WEBINAR_EVENT_ID,
  getAdronisWebinarPublicCatalog,
} from "@wisdom/utils";
import { api } from "./api";

export type WebinarPublicCatalog = ReturnType<typeof getAdronisWebinarPublicCatalog>;

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

export async function fetchPublicWebinar(eventId = ADRONIS_WEBINAR_EVENT_ID) {
  try {
    const payload = await api.get(`/webinars/${encodeURIComponent(eventId)}`);
    return unwrapData<WebinarPublicCatalog>(payload);
  } catch {
    return getAdronisWebinarPublicCatalog();
  }
}

export async function fetchWebinarMe(eventId: string, token: string | null) {
  const payload = await api.get(`/webinars/${encodeURIComponent(eventId)}/me`, token);
  return unwrapData<WebinarEventState>(payload);
}

export async function fetchWebinarAccess(eventId: string, token: string | null) {
  const payload = await api.get(`/webinars/${encodeURIComponent(eventId)}/access`, token);
  return unwrapData<WebinarEventState>(payload);
}
