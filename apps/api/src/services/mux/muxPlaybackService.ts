import { createSign } from "node:crypto";
import {
  getOnDemandWebinarById,
  isOnDemandWebinarSaleable,
  type OnDemandWebinarMediaReadiness,
} from "@wisdom/utils";
import { createHttpError } from "../booking/errors.js";

const MUX_API_BASE = "https://api.mux.com/video/v1";
const PLAYBACK_TOKEN_TTL_SECONDS = 12 * 60 * 60;
const READINESS_CACHE_TTL_MS = 30_000;

export interface MuxPlaybackIdRecord {
  id: string;
  policy?: string | null;
}

export interface MuxAssetRecord {
  id: string;
  status?: string | null;
  playback_ids?: MuxPlaybackIdRecord[] | null;
}

export interface MuxPlaybackLookup {
  id: string;
  policy?: string | null;
  object?: {
    type?: string | null;
    id?: string | null;
  } | null;
}

export type MuxAudience = "v" | "t" | "s";

export interface MuxClient {
  getPlaybackId(playbackId: string): Promise<MuxPlaybackLookup>;
  getAsset(assetId: string): Promise<MuxAssetRecord>;
}

interface CachedReadiness extends OnDemandWebinarMediaReadiness {
  expiresAt: number;
  playbackIds: MuxPlaybackIdRecord[];
}

const readinessCache = new Map<string, CachedReadiness>();

function basicAuthHeader(tokenId: string, tokenSecret: string) {
  return `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`;
}

function getMuxCredentials() {
  const tokenId = process.env.MUX_TOKEN_ID?.trim() || "";
  const tokenSecret = process.env.MUX_TOKEN_SECRET?.trim() || "";
  if (!tokenId || !tokenSecret) {
    return null;
  }
  return { tokenId, tokenSecret };
}

function getMuxSigningCredentials() {
  const keyId = process.env.MUX_SIGNING_KEY_ID?.trim() || "";
  const rawKey = process.env.MUX_SIGNING_PRIVATE_KEY?.trim() || "";
  if (!keyId || !rawKey) {
    return null;
  }
  const privateKey = rawKey.includes("BEGIN")
    ? rawKey.replace(/\\n/g, "\n")
    : Buffer.from(rawKey, "base64").toString("utf8").replace(/\\n/g, "\n");
  return { keyId, privateKey };
}

async function muxJson<T>(path: string, credentials: { tokenId: string; tokenSecret: string }): Promise<T> {
  const response = await fetch(`${MUX_API_BASE}${path}`, {
    headers: {
      Authorization: basicAuthHeader(credentials.tokenId, credentials.tokenSecret),
    },
  });
  if (!response.ok) {
    throw createHttpError(502, `Mux API request failed (${response.status}).`);
  }
  const body = await response.json() as { data?: T };
  if (!body.data) {
    throw createHttpError(502, "Mux API returned an empty payload.");
  }
  return body.data;
}

export function createMuxClient(credentials = getMuxCredentials()): MuxClient | null {
  if (!credentials) {
    return null;
  }
  return {
    getPlaybackId(playbackId) {
      return muxJson<MuxPlaybackLookup>(`/playback-ids/${encodeURIComponent(playbackId)}`, credentials);
    },
    getAsset(assetId) {
      return muxJson<MuxAssetRecord>(`/assets/${encodeURIComponent(assetId)}`, credentials);
    },
  };
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function signMuxPlaybackToken(input: {
  playbackId: string;
  audience: MuxAudience;
  expiresInSeconds?: number;
  signingKeyId?: string;
  privateKey?: string;
}) {
  const credentials = input.signingKeyId && input.privateKey
    ? { keyId: input.signingKeyId, privateKey: input.privateKey }
    : getMuxSigningCredentials();
  if (!credentials) {
    throw createHttpError(503, "Mux signing credentials are not configured.");
  }

  const expiresAt = Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? PLAYBACK_TOKEN_TTL_SECONDS);
  const header = { alg: "RS256", typ: "JWT", kid: credentials.keyId };
  const payload = {
    sub: input.playbackId,
    aud: input.audience,
    exp: expiresAt,
    kid: credentials.keyId,
  };
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(credentials.privateKey, "base64url");
  return {
    token: `${unsigned}.${signature}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

export function isPlaybackProtected(playbackIds: MuxPlaybackIdRecord[]) {
  if (playbackIds.length === 0) {
    return false;
  }
  return playbackIds.every((entry) => entry.policy === "signed");
}

export async function reconcileOnDemandMuxReadiness(
  webinarId: string,
  client: MuxClient | null = createMuxClient(),
): Promise<OnDemandWebinarMediaReadiness & { playbackIds: MuxPlaybackIdRecord[] }> {
  const cached = readinessCache.get(webinarId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  const webinar = getOnDemandWebinarById(webinarId);
  if (!webinar) {
    throw createHttpError(404, "On-demand webinar was not found.");
  }
  if (!client) {
    const unavailable = {
      assetReady: false,
      playbackProtected: false,
      muxAssetId: null,
      playbackIds: [] as MuxPlaybackIdRecord[],
      expiresAt: Date.now() + READINESS_CACHE_TTL_MS,
    };
    readinessCache.set(webinarId, unavailable);
    return unavailable;
  }

  const playback = await client.getPlaybackId(webinar.playbackId);
  const assetId = playback.object?.id?.trim() || "";
  if (!assetId) {
    throw createHttpError(502, "Mux playback ID did not resolve to an asset.");
  }
  const asset = await client.getAsset(assetId);
  const playbackIds = asset.playback_ids ?? [];
  const readiness = {
    assetReady: asset.status === "ready",
    playbackProtected: isPlaybackProtected(playbackIds),
    muxAssetId: asset.id,
    playbackIds,
    expiresAt: Date.now() + READINESS_CACHE_TTL_MS,
  };
  readinessCache.set(webinarId, readiness);
  return readiness;
}

export function clearOnDemandMuxReadinessCache(webinarId?: string) {
  if (webinarId) {
    readinessCache.delete(webinarId);
    return;
  }
  readinessCache.clear();
}

export async function assertOnDemandWebinarSaleable(webinarId: string, client?: MuxClient | null) {
  const webinar = getOnDemandWebinarById(webinarId);
  if (!webinar) {
    throw createHttpError(404, "On-demand webinar was not found.");
  }
  const readiness = await reconcileOnDemandMuxReadiness(webinarId, client);
  if (!isOnDemandWebinarSaleable(webinar, readiness)) {
    throw createHttpError(409, "This on-demand webinar is not available for purchase yet.");
  }
  return { webinar, readiness };
}

export async function createSignedOnDemandPlayback(input: {
  webinarId: string;
  client?: MuxClient | null;
}) {
  const webinar = getOnDemandWebinarById(input.webinarId);
  if (!webinar) {
    throw createHttpError(404, "On-demand webinar was not found.");
  }
  const readiness = await reconcileOnDemandMuxReadiness(input.webinarId, input.client);
  if (!readiness.assetReady || !readiness.playbackProtected) {
    throw createHttpError(409, "This recording is not ready for protected playback.");
  }

  const video = signMuxPlaybackToken({ playbackId: webinar.playbackId, audience: "v" });
  const thumbnail = signMuxPlaybackToken({ playbackId: webinar.playbackId, audience: "t" });
  const storyboard = signMuxPlaybackToken({ playbackId: webinar.playbackId, audience: "s" });

  return {
    playbackId: webinar.playbackId,
    token: video.token,
    tokens: {
      playback: video.token,
      thumbnail: thumbnail.token,
      storyboard: storyboard.token,
    },
    expiresAt: video.expiresAt,
    muxAssetId: readiness.muxAssetId ?? null,
  };
}
