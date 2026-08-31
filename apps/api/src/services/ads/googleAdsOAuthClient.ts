import { createHttpError } from "../booking/errors.js";
import { GOOGLE_ADS_SCOPE } from "./googleAdsIds.js";

export type AdsGoogleTokenSet = {
  accessToken: string;
  refreshToken: string;
  expiryDate?: number | null;
  scope?: string | null;
};

export interface AdsGoogleOAuthClient {
  exchangeCode(code: string, codeVerifier: string): Promise<AdsGoogleTokenSet>;
  refreshAccessToken(refreshToken: string): Promise<AdsGoogleTokenSet>;
  revokeToken(token: string): Promise<void>;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw createHttpError(503, "Google Ads OAuth is not configured");
  return value;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

export function googleAdsRedirectUri() {
  return requiredEnv("GOOGLE_ADS_REDIRECT_URI");
}

export function buildGoogleAdsAuthUrl(input: { state: string; codeChallenge: string }): string {
  const params = new URLSearchParams({
    client_id: requiredEnv("GOOGLE_ADS_CLIENT_ID"),
    redirect_uri: googleAdsRedirectUri(),
    response_type: "code",
    scope: GOOGLE_ADS_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function googleAdsOAuthClient(): AdsGoogleOAuthClient {
  const clientId = requiredEnv("GOOGLE_ADS_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_ADS_CLIENT_SECRET");
  const redirectUri = googleAdsRedirectUri();

  return {
    async exchangeCode(code, codeVerifier) {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          code_verifier: codeVerifier,
        }),
      });
      const data = await readJson(response);
      if (!response.ok || typeof data.access_token !== "string") {
        const error = createHttpError(502, "Unable to complete Google Ads authorization") as Error & { code?: string };
        error.code = "GOOGLE_ADS_OAUTH_INVALID";
        throw error;
      }
      return {
        accessToken: data.access_token,
        refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : "",
        expiryDate: typeof data.expires_in === "number" ? Date.now() + data.expires_in * 1000 : null,
        scope: typeof data.scope === "string" ? data.scope : GOOGLE_ADS_SCOPE,
      };
    },

    async refreshAccessToken(refreshToken) {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });
      const data = await readJson(response);
      if (!response.ok || typeof data.access_token !== "string") {
        const error = createHttpError(401, "Google Ads authorization expired") as Error & { code?: string };
        error.code = "GOOGLE_ADS_OAUTH_INVALID";
        throw error;
      }
      return {
        accessToken: data.access_token,
        refreshToken: typeof data.refresh_token === "string" && data.refresh_token.trim()
          ? data.refresh_token
          : refreshToken,
        expiryDate: typeof data.expires_in === "number" ? Date.now() + data.expires_in * 1000 : null,
        scope: typeof data.scope === "string" ? data.scope : GOOGLE_ADS_SCOPE,
      };
    },

    async revokeToken(token) {
      const response = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
      });
      if (!response.ok && response.status !== 400) {
        throw createHttpError(502, "Google could not revoke the Ads connection");
      }
    },
  };
}

let oauthClientOverride: AdsGoogleOAuthClient | null = null;

export function setAdsGoogleOAuthClientForTests(client: AdsGoogleOAuthClient | null) {
  oauthClientOverride = client;
}

export function resolveAdsGoogleOAuthClient(): AdsGoogleOAuthClient {
  return oauthClientOverride ?? googleAdsOAuthClient();
}

export function adminAdsSettingsRedirectUrl(query = "") {
  const base = (process.env.ADMIN_URL?.trim() || "http://127.0.0.1:5174").replace(/\/$/, "");
  return `${base}/admin/ads/settings${query}`;
}
