import {
  ADRONIS_ON_DEMAND_WEBINAR_ID,
  getOnDemandWebinarById,
  getOnDemandWebinarPublicCatalog,
} from "@wisdom/utils";
import { api } from "./api";

export type OnDemandWebinarPublicCatalog = ReturnType<typeof getOnDemandWebinarPublicCatalog>;

export interface OnDemandWebinarState extends OnDemandWebinarPublicCatalog {
  owned: boolean;
  entitlementId?: string | null;
  purchasedAt?: string | null;
  positionSeconds?: number;
}

export interface OnDemandWebinarLibrary {
  owned: OnDemandWebinarState[];
  explore: OnDemandWebinarState[];
}

export interface OnDemandPlaybackAuth {
  playbackId: string;
  token: string;
  tokens?: {
    playback?: string;
    thumbnail?: string;
    storyboard?: string;
  };
  expiresAt: string;
}

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function fallbackCatalog(webinarId = ADRONIS_ON_DEMAND_WEBINAR_ID) {
  const webinar = getOnDemandWebinarById(webinarId);
  if (!webinar) {
    throw new Error("On-demand webinar was not found.");
  }
  return getOnDemandWebinarPublicCatalog(webinar, {
    assetReady: false,
    playbackProtected: false,
    muxAssetId: null,
  });
}

export async function fetchPublicOnDemandWebinar(webinarId = ADRONIS_ON_DEMAND_WEBINAR_ID) {
  try {
    const payload = await api.get(`/webinars/on-demand/${encodeURIComponent(webinarId)}`);
    return unwrapData<OnDemandWebinarPublicCatalog>(payload);
  } catch {
    return fallbackCatalog(webinarId);
  }
}

export async function fetchOnDemandWebinarMe(webinarId: string, token: string | null) {
  const payload = await api.get(`/webinars/on-demand/${encodeURIComponent(webinarId)}/me`, token);
  return unwrapData<OnDemandWebinarState>(payload);
}

export async function fetchOnDemandWebinarLibrary(token: string | null) {
  const payload = await api.get("/webinars/on-demand-library/me", token);
  return unwrapData<OnDemandWebinarLibrary>(payload);
}

export async function fetchOnDemandPlayback(webinarId: string, token: string | null) {
  const payload = await api.get(`/webinars/on-demand/${encodeURIComponent(webinarId)}/playback`, token);
  return unwrapData<OnDemandPlaybackAuth>(payload);
}

export async function saveOnDemandProgress(
  webinarId: string,
  positionSeconds: number,
  token: string | null,
) {
  const payload = await api.put(
    `/webinars/on-demand/${encodeURIComponent(webinarId)}/progress`,
    { positionSeconds },
    token,
  );
  return unwrapData<{ positionSeconds: number; durationSeconds: number }>(payload);
}

export async function startOnDemandWebinarCheckout(
  webinarId: string,
  options: { token: string | null },
): Promise<void> {
  const payload = await api.post(
    "/create-checkout-session",
    { type: "on_demand_webinar", webinarId },
    options.token,
  ) as { sessionId?: string; url?: string | null; data?: { url?: string | null } };

  const url = (typeof payload?.data?.url === "string" ? payload.data.url : payload?.url)?.trim() ?? "";
  if (url) {
    window.location.assign(url);
    return;
  }

  throw new Error(
    "Checkout did not return a redirect URL. Confirm STRIPE_SECRET_KEY and create-checkout-session are configured.",
  );
}
