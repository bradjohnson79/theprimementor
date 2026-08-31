import { createHash, randomBytes } from "node:crypto";
import { createHttpError } from "../booking/errors.js";
import {
  adminEmailsRedirectUrl,
  buildGoogleAuthUrl,
  GMAIL_READONLY_SCOPE,
  resolveGmailClient,
  type GmailClient,
} from "./gmailClient.js";
import { decryptTokenPayload, encryptTokenPayload } from "./tokenCrypto.js";
import type { EmailListStore } from "./emailListStore.js";

const STATE_TTL_MS = 10 * 60 * 1000;

export function serializeGmailStatus(connection: {
  status: string;
  gmail_address: string;
  connected_at: Date;
} | null) {
  if (!connection) {
    return { status: "disconnected" as const, gmailAddress: null, connectedAt: null };
  }
  return {
    status: connection.status,
    gmailAddress: connection.gmail_address,
    connectedAt: connection.connected_at.toISOString(),
  };
}

export async function startGmailOAuth(store: EmailListStore, userId: string, client: GmailClient = resolveGmailClient()) {
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
  return { url: buildGoogleAuthUrl({ state, codeChallenge }) };
}

export async function completeGmailOAuth(
  store: EmailListStore,
  query: { code?: string; state?: string; error?: string },
  client: GmailClient = resolveGmailClient(),
): Promise<string> {
  if (query.error) {
    return adminEmailsRedirectUrl("?gmail=error");
  }
  if (!query.code || !query.state) {
    return adminEmailsRedirectUrl("?gmail=invalid_state");
  }
  const stored = await store.consumeOauthState(query.state);
  if (!stored || stored.expires_at.getTime() < Date.now()) {
    return adminEmailsRedirectUrl("?gmail=invalid_state");
  }
  const tokens = await client.exchangeCode(query.code, stored.code_verifier);
  if (!tokens.refreshToken && !tokens.accessToken) {
    return adminEmailsRedirectUrl("?gmail=error");
  }
  const profile = await client.getProfile(tokens.accessToken);
  await store.upsertConnection({
    user_id: stored.user_id,
    gmail_address: profile.emailAddress,
    encrypted_tokens: encryptTokenPayload(tokens),
    token_expires_at: tokens.expiryDate ? new Date(tokens.expiryDate) : null,
    granted_scope: tokens.scope ?? GMAIL_READONLY_SCOPE,
    status: "connected",
  });
  return adminEmailsRedirectUrl("?gmail=connected");
}

export async function getValidAccessToken(
  store: EmailListStore,
  userId: string,
  client: GmailClient = resolveGmailClient(),
): Promise<{ accessToken: string; gmailAddress: string }> {
  const connection = await store.getConnection(userId);
  if (!connection) {
    throw createHttpError(404, "Gmail is not connected");
  }
  const tokens = decryptTokenPayload(connection.encrypted_tokens);
  const expiresSoon = !tokens.expiryDate || tokens.expiryDate < Date.now() + 60_000;
  if (!expiresSoon && tokens.accessToken) {
    return { accessToken: tokens.accessToken, gmailAddress: connection.gmail_address };
  }
  if (!tokens.refreshToken) {
    await store.upsertConnection({
      ...connection,
      status: "expired",
    });
    throw createHttpError(401, "Gmail connection expired");
  }
  try {
    const refreshed = await client.refreshAccessToken(tokens.refreshToken);
    await store.upsertConnection({
      user_id: userId,
      gmail_address: connection.gmail_address,
      encrypted_tokens: encryptTokenPayload({
        ...tokens,
        ...refreshed,
        refreshToken: refreshed.refreshToken || tokens.refreshToken,
      }),
      token_expires_at: refreshed.expiryDate ? new Date(refreshed.expiryDate) : null,
      granted_scope: refreshed.scope ?? connection.granted_scope,
      status: "connected",
    });
    return { accessToken: refreshed.accessToken, gmailAddress: connection.gmail_address };
  } catch (error) {
    await store.upsertConnection({
      ...connection,
      status: "expired",
    });
    throw error;
  }
}

export async function disconnectGmail(
  store: EmailListStore,
  userId: string,
  client: GmailClient = resolveGmailClient(),
): Promise<{ disconnected: true; warning?: string }> {
  const connection = await store.getConnection(userId);
  if (!connection) {
    throw createHttpError(404, "Gmail is not connected");
  }
  const tokens = decryptTokenPayload(connection.encrypted_tokens);
  const revokeCredential = tokens.refreshToken || tokens.accessToken;
  await store.deleteConnection(userId);
  if (!revokeCredential) {
    return { disconnected: true, warning: "Google revocation was skipped because no credential was available." };
  }
  try {
    await client.revokeToken(revokeCredential);
    return { disconnected: true };
  } catch {
    return { disconnected: true, warning: "The local Gmail connection was removed, but Google could not confirm revocation." };
  }
}
