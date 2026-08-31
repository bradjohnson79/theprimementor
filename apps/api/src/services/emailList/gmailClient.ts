import { createHttpError } from "../booking/errors.js";

const GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly";

export interface GmailTokenSet {
  accessToken: string;
  refreshToken: string;
  expiryDate?: number | null;
  scope?: string | null;
}

export interface GmailMessageMeta {
  id: string;
  threadId: string;
  headers: Array<{ name?: string | null; value?: string | null }>;
  internalDate?: string | null;
}

export interface GmailThreadMeta {
  id: string;
  messages: GmailMessageMeta[];
}

export interface GmailClient {
  exchangeCode(code: string, codeVerifier: string): Promise<GmailTokenSet>;
  refreshAccessToken(refreshToken: string): Promise<GmailTokenSet>;
  revokeToken(token: string): Promise<void>;
  getProfile(accessToken: string): Promise<{ emailAddress: string }>;
  listMessageIds(accessToken: string, query: string, pageToken?: string | null, maxResults?: number): Promise<{ ids: Array<{ id: string; threadId: string }>; nextPageToken: string | null }>;
  getMessageMetadata(accessToken: string, id: string): Promise<GmailMessageMeta>;
  getThreadMetadata(accessToken: string, id: string): Promise<GmailThreadMeta>;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw createHttpError(503, "Gmail OAuth is not configured");
  return value;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGmailJson(url: string, accessToken: string, errorMessage: string): Promise<Record<string, unknown>> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    lastStatus = response.status;
    if (response.ok) return readJson(response);
    if (response.status === 429 || response.status >= 500) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 400 * (attempt + 1) * (attempt + 1));
      continue;
    }
    throw createHttpError(502, errorMessage);
  }
  throw createHttpError(502, lastStatus === 429 ? "Gmail rate limit was reached. Try again in a moment." : errorMessage);
}

export function googleGmailClient(): GmailClient {
  const clientId = requiredEnv("GOOGLE_GMAIL_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_GMAIL_CLIENT_SECRET");
  const redirectUri = requiredEnv("GOOGLE_GMAIL_REDIRECT_URI");

  return {
    async exchangeCode(code, codeVerifier) {
      const body = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      });
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const data = await readJson(response);
      if (!response.ok || typeof data.access_token !== "string") {
        throw createHttpError(502, "Unable to complete Gmail authorization");
      }
      return {
        accessToken: data.access_token,
        refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : "",
        expiryDate: typeof data.expires_in === "number" ? Date.now() + data.expires_in * 1000 : null,
        scope: typeof data.scope === "string" ? data.scope : GMAIL_READONLY,
      };
    },

    async refreshAccessToken(refreshToken) {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      });
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const data = await readJson(response);
      if (!response.ok || typeof data.access_token !== "string") {
        throw createHttpError(401, "Gmail connection expired");
      }
      return {
        accessToken: data.access_token,
        refreshToken,
        expiryDate: typeof data.expires_in === "number" ? Date.now() + data.expires_in * 1000 : null,
        scope: typeof data.scope === "string" ? data.scope : GMAIL_READONLY,
      };
    },

    async revokeToken(token) {
      const response = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
      });
      if (!response.ok && response.status !== 400) {
        throw createHttpError(502, "Google could not revoke the Gmail connection");
      }
    },

    async getProfile(accessToken) {
      const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await readJson(response);
      if (!response.ok || typeof data.emailAddress !== "string") {
        throw createHttpError(502, "Unable to read the connected Gmail profile");
      }
      return { emailAddress: data.emailAddress };
    },

    async listMessageIds(accessToken, query, pageToken, maxResults = 500) {
      const size = Math.min(500, Math.max(1, maxResults));
      const params = new URLSearchParams({ q: query, maxResults: String(size) });
      if (pageToken) params.set("pageToken", pageToken);
      const data = await fetchGmailJson(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
        accessToken,
        "Gmail search could not be completed",
      );
      const messages = Array.isArray(data.messages) ? data.messages : [];
      return {
        ids: messages
          .map((item) => item as { id?: string; threadId?: string })
          .filter((item): item is { id: string; threadId: string } => Boolean(item.id && item.threadId)),
        nextPageToken: typeof data.nextPageToken === "string" ? data.nextPageToken : null,
      };
    },

    async getMessageMetadata(accessToken, id) {
      const params = new URLSearchParams({
        format: "metadata",
        metadataHeaders: "From",
      });
      params.append("metadataHeaders", "To");
      params.append("metadataHeaders", "Cc");
      params.append("metadataHeaders", "Subject");
      params.append("metadataHeaders", "Date");
      params.append("metadataHeaders", "List-Id");
      params.append("metadataHeaders", "List-Unsubscribe");
      params.append("metadataHeaders", "Precedence");
      params.append("metadataHeaders", "Auto-Submitted");
      const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await readJson(response);
      if (!response.ok) {
        throw createHttpError(502, "Gmail message metadata could not be loaded");
      }
      const payload = (data.payload ?? {}) as { headers?: Array<{ name?: string; value?: string }> };
      return {
        id: String(data.id ?? id),
        threadId: String(data.threadId ?? ""),
        headers: payload.headers ?? [],
        internalDate: typeof data.internalDate === "string" ? data.internalDate : null,
      };
    },

    async getThreadMetadata(accessToken, id) {
      const params = new URLSearchParams({ format: "metadata" });
      const data = await fetchGmailJson(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(id)}?${params}`,
        accessToken,
        "Gmail thread metadata could not be loaded",
      );
      const messages = Array.isArray(data.messages) ? data.messages : [];
      return {
        id: String(data.id ?? id),
        messages: messages.map((item) => {
          const message = item as {
            id?: string;
            threadId?: string;
            internalDate?: string;
            payload?: { headers?: Array<{ name?: string; value?: string }> };
          };
          return {
            id: String(message.id ?? ""),
            threadId: String(message.threadId ?? id),
            headers: message.payload?.headers ?? [],
            internalDate: message.internalDate ?? null,
          };
        }),
      };
    },
  };
}

let gmailClientOverride: GmailClient | null = null;

export function setGmailClientForTests(client: GmailClient | null) {
  gmailClientOverride = client;
}

export function resolveGmailClient(): GmailClient {
  return gmailClientOverride ?? googleGmailClient();
}

export function ownerAddresses(gmailAddress: string): string[] {
  const aliases = (process.env.GMAIL_OWNER_ALIASES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return [gmailAddress, ...aliases];
}

export function adminEmailsRedirectUrl(query = ""): string {
  const base = (process.env.ADMIN_URL?.trim() || "http://127.0.0.1:5174").replace(/\/$/, "");
  return `${base}/admin/emails${query}`;
}

export function buildGoogleAuthUrl(input: { state: string; codeChallenge: string }): string {
  const params = new URLSearchParams({
    client_id: requiredEnv("GOOGLE_GMAIL_CLIENT_ID"),
    redirect_uri: requiredEnv("GOOGLE_GMAIL_REDIRECT_URI"),
    response_type: "code",
    scope: GMAIL_READONLY,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export const GMAIL_READONLY_SCOPE = GMAIL_READONLY;
