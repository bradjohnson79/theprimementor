import { createHttpError } from "../booking/errors.js";
import { configuredCustomerId, configuredLoginCustomerId } from "./googleAdsIds.js";

export const GOOGLE_ADS_API_VERSION = "v25";
export const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

export type GoogleAdsFetch = typeof fetch;

export type GoogleAdsSearchRow = Record<string, unknown>;

function adsError(statusCode: number, message: string, code: string) {
  const error = createHttpError(statusCode, message) as Error & { code?: string };
  error.code = code;
  return error;
}

export function googleAdsErrorMessage(body: Record<string, unknown>) {
  const items: string[] = [];
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      items.push(record.message.trim());
    }
    for (const child of Object.values(record)) walk(child);
  };
  walk(body);
  return items.find((message) => /developer token is only approved|developer_token_not_approved/i.test(message))
    ?? items.find((message) => /developer token/i.test(message))
    ?? items.find((message) => /doesn't have permission to access customer/i.test(message))
    ?? items.find((message) => /permission|customer/i.test(message))
    ?? items[0]
    ?? "";
}

export function classifyGoogleAdsError(status: number, body: Record<string, unknown>) {
  const serialized = JSON.stringify(body).toLowerCase();
  const googleMessage = googleAdsErrorMessage(body);
  if (status === 401 || serialized.includes("unauthenticated") || serialized.includes("invalid_grant")) {
    return adsError(401, googleMessage || "Google Ads authorization is invalid.", "GOOGLE_ADS_OAUTH_INVALID");
  }
  if (
    serialized.includes("developer_token_not_approved")
    || serialized.includes("developer token")
    || serialized.includes("developertoken")
    || serialized.includes("authorizationerror.developer_token")
  ) {
    return adsError(403, googleMessage || "The Google Ads developer token was rejected.", "GOOGLE_ADS_DEVELOPER_TOKEN_ERROR");
  }
  if (status === 403 || serialized.includes("permission") || serialized.includes("authorizationerror") || serialized.includes("customer not found")) {
    return adsError(403, googleMessage || "The advertising account is not accessible through the Manager account.", "GOOGLE_ADS_CUSTOMER_ACCESS_ERROR");
  }
  return adsError(status >= 400 && status < 500 ? status : 502, googleMessage || "The Google Ads API is unavailable.", "GOOGLE_ADS_API_ERROR");
}

export async function searchGoogleAds(input: {
  accessToken: string;
  query: string;
  fetcher?: GoogleAdsFetch;
  customerId?: string;
  loginCustomerId?: string;
}): Promise<GoogleAdsSearchRow[]> {
  const customerId = input.customerId || configuredCustomerId();
  const loginCustomerId = input.loginCustomerId || configuredLoginCustomerId();
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!customerId || !loginCustomerId || !developerToken) {
    throw adsError(503, "Google Ads account identifiers are not configured.", "GOOGLE_ADS_API_ERROR");
  }

  const response = await (input.fetcher ?? fetch)(
    `${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "developer-token": developerToken,
        "login-customer-id": loginCustomerId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: input.query }),
    },
  );
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw classifyGoogleAdsError(response.status, body);
  }
  return Array.isArray(body.results) ? body.results as GoogleAdsSearchRow[] : [];
}

export async function validateGoogleAdsAccess(input: {
  accessToken: string;
  fetcher?: GoogleAdsFetch;
}) {
  const customerId = configuredCustomerId();
  const loginCustomerId = configuredLoginCustomerId();
  try {
    const rows = await searchGoogleAds({
      accessToken: input.accessToken,
      fetcher: input.fetcher,
      query: "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1",
    });
    const customer = (rows[0]?.customer ?? {}) as Record<string, unknown>;
    const returnedId = String(customer.id ?? "").replace(/[^\d]/g, "");
    if (returnedId && returnedId !== customerId) {
      throw adsError(403, "The advertising account is not accessible through the Manager account.", "GOOGLE_ADS_CUSTOMER_ACCESS_ERROR");
    }
    return {
      customerId,
      descriptiveName: typeof customer.descriptiveName === "string"
        ? customer.descriptiveName
        : typeof customer.descriptive_name === "string"
          ? customer.descriptive_name
          : null,
    };
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String((error as { code?: string }).code) : "";
    if (code === "GOOGLE_ADS_DEVELOPER_TOKEN_ERROR" || !loginCustomerId || loginCustomerId === customerId) {
      throw error;
    }
    try {
      await searchGoogleAds({
        accessToken: input.accessToken,
        fetcher: input.fetcher,
        customerId: loginCustomerId,
        loginCustomerId,
        query: "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1",
      });
    } catch (managerError) {
      const managerCode = managerError instanceof Error && "code" in managerError
        ? String((managerError as { code?: string }).code)
        : "";
      if (managerCode === "GOOGLE_ADS_DEVELOPER_TOKEN_ERROR") {
        throw managerError;
      }
    }
    throw error;
  }
}
