import { logger } from "@wisdom/utils";

const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";
const ZOOM_MEETINGS_URL = "https://api.zoom.us/v2/users/me/meetings";
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresAt = 0;

interface ZoomTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface CreateZoomMeetingInput {
  topic: string;
  startTime: string;
  duration: number;
  timezone?: string;
}

interface ZoomMeetingApiResponse {
  join_url?: string;
  start_url?: string;
}

interface ZoomRequestError extends Error {
  status?: number;
  responseBody?: string;
}

function getRequiredEnv(name: "ZOOM_ACCOUNT_ID" | "ZOOM_CLIENT_ID" | "ZOOM_CLIENT_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required Zoom environment variable: ${name}`);
  }
  return value;
}

function invalidateZoomTokenCache() {
  cachedAccessToken = null;
  cachedAccessTokenExpiresAt = 0;
}

function isCachedTokenValid() {
  return Boolean(cachedAccessToken) && Date.now() < cachedAccessTokenExpiresAt - TOKEN_EXPIRY_BUFFER_MS;
}

function buildZoomRequestError(message: string, status?: number, responseBody?: string): ZoomRequestError {
  const error = new Error(message) as ZoomRequestError;
  error.status = status;
  error.responseBody = responseBody;
  return error;
}

function isZoomAuthFailure(error: unknown) {
  return error instanceof Error
    && "status" in error
    && (error as ZoomRequestError).status !== undefined
    && [401, 403].includes((error as ZoomRequestError).status ?? 0);
}

export async function getZoomAccessToken() {
  if (isCachedTokenValid() && cachedAccessToken) {
    return cachedAccessToken;
  }

  const accountId = getRequiredEnv("ZOOM_ACCOUNT_ID");
  const clientId = getRequiredEnv("ZOOM_CLIENT_ID");
  const clientSecret = getRequiredEnv("ZOOM_CLIENT_SECRET");
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenUrl = new URL(ZOOM_TOKEN_URL);
  tokenUrl.searchParams.set("grant_type", "account_credentials");
  tokenUrl.searchParams.set("account_id", accountId);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  const rawBody = await response.text();
  if (!response.ok) {
    throw buildZoomRequestError(
      `Zoom token request failed with status ${response.status}`,
      response.status,
      rawBody,
    );
  }

  const data = JSON.parse(rawBody) as ZoomTokenResponse;
  if (!data.access_token || typeof data.expires_in !== "number") {
    throw new Error("Zoom token response did not include access token metadata.");
  }

  cachedAccessToken = data.access_token;
  cachedAccessTokenExpiresAt = Date.now() + (data.expires_in * 1000);

  return cachedAccessToken;
}

async function requestZoomMeeting(accessToken: string, payload: CreateZoomMeetingInput) {
  const response = await fetch(ZOOM_MEETINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: payload.topic,
      type: 2,
      start_time: payload.startTime,
      duration: payload.duration,
      timezone: payload.timezone ?? "UTC",
      settings: {
        join_before_host: false,
        waiting_room: true,
      },
    }),
  });

  const rawBody = await response.text();
  if (!response.ok) {
    throw buildZoomRequestError(
      `Zoom meeting request failed with status ${response.status}`,
      response.status,
      rawBody,
    );
  }

  const data = JSON.parse(rawBody) as ZoomMeetingApiResponse;
  logger.debug("zoom_meeting_response_received", {
    joinUrl: data.join_url,
    startUrl: data.start_url,
  });
  if (!data.join_url || !data.start_url) {
    throw new Error("Zoom meeting response did not include join and start URLs.");
  }

  return {
    joinUrl: data.join_url,
    startUrl: data.start_url,
  };
}

// This will be triggered after Stripe webhook confirms payment
// Do not call this from frontend
export async function createZoomMeeting({
  topic,
  startTime,
  duration,
  timezone = "UTC",
}: CreateZoomMeetingInput) {
  try {
    const accessToken = await getZoomAccessToken();
    const data = await requestZoomMeeting(accessToken, { topic, startTime, duration, timezone });
    logger.info("zoom_meeting_created", {
      joinUrl: data.joinUrl,
      startUrl: data.startUrl,
    });
    return {
      joinUrl: data.joinUrl,
      startUrl: data.startUrl,
    };
  } catch (error) {
    if (isZoomAuthFailure(error)) {
      invalidateZoomTokenCache();
      try {
        const freshToken = await getZoomAccessToken();
        const data = await requestZoomMeeting(freshToken, { topic, startTime, duration, timezone });
        logger.info("zoom_meeting_created_after_token_refresh", {
          joinUrl: data.joinUrl,
          startUrl: data.startUrl,
        });
        return {
          joinUrl: data.joinUrl,
          startUrl: data.startUrl,
        };
      } catch (retryError) {
        logger.error("zoom_meeting_creation_failed_after_retry", {
          topic,
          startTime,
          status: retryError instanceof Error && "status" in retryError
            ? (retryError as ZoomRequestError).status
            : undefined,
          responseBody: retryError instanceof Error && "responseBody" in retryError
            ? (retryError as ZoomRequestError).responseBody
            : undefined,
          message: retryError instanceof Error ? retryError.message : String(retryError),
        });
        throw retryError;
      }
    }

    logger.error("zoom_meeting_creation_failed", {
      topic,
      startTime,
      status: error instanceof Error && "status" in error
        ? (error as ZoomRequestError).status
        : undefined,
      responseBody: error instanceof Error && "responseBody" in error
        ? (error as ZoomRequestError).responseBody
        : undefined,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
