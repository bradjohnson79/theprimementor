import { createHash, randomBytes } from "node:crypto";
import { createHttpError } from "../booking/errors.js";
import { decryptAdsGoogleTokens, encryptAdsGoogleTokens } from "./adsTokenCrypto.js";
import {
  adminAdsSettingsRedirectUrl,
  buildGoogleAdsAuthUrl,
  resolveAdsGoogleOAuthClient,
  type AdsGoogleOAuthClient,
} from "./googleAdsOAuthClient.js";
import { GOOGLE_ADS_SCOPE } from "./googleAdsIds.js";
import type { AdsGoogleStore } from "./googleAdsStore.js";

const STATE_TTL_MS = 10 * 60 * 1000;

export async function startGoogleAdsOAuth(
  store: AdsGoogleStore,
  userId: string,
  client: AdsGoogleOAuthClient = resolveAdsGoogleOAuthClient(),
) {
  void client;
  const state = randomBytes(32).toString("hex");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  await store.insertOauthState({
    state,
    user_id: userId,
    code_verifier: codeVerifier,
    expires_at: new Date(Date.now() + STATE_TTL_MS),
  });
  return { url: buildGoogleAdsAuthUrl({ state, codeChallenge }) };
}

export async function completeGoogleAdsOAuth(
  store: AdsGoogleStore,
  query: { code?: string; state?: string; error?: string },
  client: AdsGoogleOAuthClient = resolveAdsGoogleOAuthClient(),
): Promise<string> {
  if (query.error) {
    return adminAdsSettingsRedirectUrl("?ads=denied");
  }
  if (!query.code || !query.state) {
    return adminAdsSettingsRedirectUrl("?ads=invalid_state");
  }
  const stored = await store.consumeOauthState(query.state);
  if (!stored || stored.expires_at.getTime() < Date.now()) {
    return adminAdsSettingsRedirectUrl("?ads=invalid_state");
  }

  const tokens = await client.exchangeCode(query.code, stored.code_verifier);
  const existing = await store.getConnection();
  const existingTokens = existing ? decryptAdsGoogleTokens(existing.encrypted_tokens) : null;
  const refreshToken = tokens.refreshToken?.trim() || existingTokens?.refreshToken?.trim() || "";
  if (!refreshToken) {
    return adminAdsSettingsRedirectUrl("?ads=error");
  }

  await store.upsertConnection({
    encrypted_tokens: encryptAdsGoogleTokens({
      accessToken: tokens.accessToken,
      refreshToken,
      expiryDate: tokens.expiryDate,
      scope: tokens.scope ?? GOOGLE_ADS_SCOPE,
    }),
    token_expires_at: tokens.expiryDate ? new Date(tokens.expiryDate) : null,
    granted_scope: tokens.scope ?? GOOGLE_ADS_SCOPE,
    status: "connected",
    validated_at: null,
    connected_by_user_id: stored.user_id,
  });
  return adminAdsSettingsRedirectUrl("?ads=connected");
}

export async function getValidAdsAccessToken(
  store: AdsGoogleStore,
  client: AdsGoogleOAuthClient = resolveAdsGoogleOAuthClient(),
  options?: { forceRefresh?: boolean },
) {
  const connection = await store.getConnection();
  if (!connection || connection.status === "disconnected") {
    throw createHttpError(404, "Google Ads is not connected");
  }
  const tokens = decryptAdsGoogleTokens(connection.encrypted_tokens);
  const expiresSoon = !tokens.expiryDate || tokens.expiryDate < Date.now() + 60_000;
  if (!options?.forceRefresh && !expiresSoon && tokens.accessToken) {
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }
  if (!tokens.refreshToken) {
    await store.upsertConnection({
      ...connection,
      status: "expired",
    });
    const error = createHttpError(401, "Google Ads authorization expired") as Error & { code?: string };
    error.code = "GOOGLE_ADS_OAUTH_INVALID";
    throw error;
  }
  let refreshed;
  try {
    refreshed = await client.refreshAccessToken(tokens.refreshToken);
  } catch (error) {
    await store.upsertConnection({
      ...connection,
      status: "auth_error",
    });
    throw error;
  }
  await store.upsertConnection({
    encrypted_tokens: encryptAdsGoogleTokens({
      ...tokens,
      ...refreshed,
      refreshToken: refreshed.refreshToken || tokens.refreshToken,
    }),
    token_expires_at: refreshed.expiryDate ? new Date(refreshed.expiryDate) : null,
    granted_scope: refreshed.scope ?? connection.granted_scope,
    status: connection.status === "expired" ? "connected" : connection.status,
    validated_at: connection.validated_at,
    connected_by_user_id: connection.connected_by_user_id,
  });
  return {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken || tokens.refreshToken,
  };
}

export async function disconnectGoogleAds(
  store: AdsGoogleStore,
  client: AdsGoogleOAuthClient = resolveAdsGoogleOAuthClient(),
): Promise<{ disconnected: true; warning?: string }> {
  const connection = await store.getConnection();
  if (!connection) {
    throw createHttpError(404, "Google Ads is not connected");
  }
  const tokens = decryptAdsGoogleTokens(connection.encrypted_tokens);
  const revokeCredential = tokens.refreshToken || tokens.accessToken;
  await store.deleteConnection();
  if (!revokeCredential) {
    return { disconnected: true, warning: "Google revocation was skipped because no credential was available." };
  }
  try {
    await client.revokeToken(revokeCredential);
    return { disconnected: true };
  } catch {
    return { disconnected: true, warning: "The local Google Ads connection was removed, but Google could not confirm revocation." };
  }
}
