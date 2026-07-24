import { api } from "./api";

export const REGENERATION_OFFER_ROUTE = "/regeneration-offer";
export const REGENERATION_OFFER_SUCCESS_ROUTE = "/regeneration-offer/success";

export interface RegenerationOfferStatus {
  active: boolean;
  title: string;
  priceCents: 14900;
  currency: "cad";
  endsAt: string;
  timezone: "America/Vancouver";
}

export interface RegenerationOfferCheckoutResponse {
  requiresPayment?: boolean;
  sessionId?: string;
  url?: string | null;
}

export interface RegenerationOfferPurchaseStatus {
  found: boolean;
  status: null | {
    orderId: string;
    status: "pending" | "completed" | "refunded" | "failed";
    completed: boolean;
    createdAt: string;
    updatedAt: string | null;
  };
}

export async function fetchRegenerationOfferStatus() {
  return (await api.get("/regeneration-offer")) as RegenerationOfferStatus;
}

export async function startRegenerationOfferCheckout(token: string | null) {
  const data = (await api.post(
    "/member/regeneration-offer/checkout",
    {},
    token,
  )) as RegenerationOfferCheckoutResponse;

  const url = typeof data.url === "string" ? data.url.trim() : "";
  if (url) {
    window.location.assign(url);
    return;
  }

  throw new Error("Checkout did not return a redirect URL. Please try again.");
}

export async function fetchRegenerationOfferPurchaseStatus(token: string | null, checkoutSessionId: string) {
  const query = new URLSearchParams({ checkoutSessionId });
  return (await api.get(
    `/member/regeneration-offer/status?${query.toString()}`,
    token,
  )) as RegenerationOfferPurchaseStatus;
}

export function formatRegenerationOfferPrice(status: RegenerationOfferStatus | null) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: status?.currency ?? "cad",
    maximumFractionDigits: 0,
  }).format((status?.priceCents ?? 14900) / 100);
}
