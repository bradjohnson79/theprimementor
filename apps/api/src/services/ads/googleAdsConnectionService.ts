import { logger } from "@wisdom/utils";
import { configuredCustomerId, configuredLoginCustomerId, displayCustomerId, maskCustomerId } from "./googleAdsIds.js";
import { decryptAdsGoogleTokens } from "./adsTokenCrypto.js";
import type { AdsGoogleStore } from "./googleAdsStore.js";
import type { AdsCapabilityMode } from "./types.js";

export type GoogleAdsConnectionStatus =
  | "disconnected"
  | "oauth_required"
  | "connected_read_only"
  | "auth_error"
  | "access_error"
  | "developer_token_error"
  | "api_error";

export type GoogleAdsPublicStatus = {
  configured: boolean;
  authenticated: boolean;
  customerIdConfigured: boolean;
  hasDeveloperToken: boolean;
  oauthClientConfigured: boolean;
  oauthConfigured: boolean;
  authorizationConnected: boolean;
  apiAccessValidated: boolean;
  mode: AdsCapabilityMode;
  connectionStatus: GoogleAdsConnectionStatus;
  customerIdMasked: string | null;
  customerIdDisplay: string | null;
  loginCustomerIdDisplay: string | null;
  lastError: string | null;
};

function envFlag(name: string) {
  return Boolean(process.env[name]?.trim());
}

export { maskCustomerId, displayCustomerId };

export async function serializeGoogleAdsStatus(store?: AdsGoogleStore | null): Promise<GoogleAdsPublicStatus> {
  const hasDeveloperToken = envFlag("GOOGLE_ADS_DEVELOPER_TOKEN");
  const oauthClientConfigured = envFlag("GOOGLE_ADS_CLIENT_ID") && envFlag("GOOGLE_ADS_CLIENT_SECRET");
  const customerIdConfigured = Boolean(configuredCustomerId());
  const connection = store ? await store.getConnection() : null;
  let authorizationConnected = false;
  if (connection?.encrypted_tokens) {
    try {
      const tokens = decryptAdsGoogleTokens(connection.encrypted_tokens);
      authorizationConnected = Boolean(tokens.refreshToken?.trim());
    } catch {
      authorizationConnected = false;
    }
  }
  const apiAccessValidated = Boolean(connection?.validated_at && connection.status === "connected");
  const connectionStatus: GoogleAdsConnectionStatus = apiAccessValidated
    ? "connected_read_only"
    : connection?.status === "auth_error"
      ? "auth_error"
      : connection?.status === "access_error"
        ? "access_error"
        : connection?.status === "developer_token_error"
          ? "developer_token_error"
          : connection?.status === "api_error"
            ? "api_error"
            : authorizationConnected
              ? "api_error"
              : oauthClientConfigured
                ? "oauth_required"
                : "disconnected";
  const lastError = connectionStatus === "developer_token_error"
    ? "The developer token is only approved for use with test accounts. To access non-test accounts, apply for Basic or Standard access."
    : connectionStatus === "access_error"
      ? "The advertising account is not accessible through the Manager account."
      : connectionStatus === "auth_error"
        ? "Google Ads authorization is invalid."
        : connectionStatus === "api_error"
          ? "The Google Ads API did not accept the validated request."
          : null;
  const mode: AdsCapabilityMode = apiAccessValidated ? "READ_ONLY" : "DISCONNECTED";
  const configured = hasDeveloperToken && oauthClientConfigured && customerIdConfigured && apiAccessValidated;

  logger.info("ads_google_ads_status", {
    configured,
    hasDeveloperToken,
    oauthClientConfigured,
    authorizationConnected,
    apiAccessValidated,
    customerIdConfigured,
    mode,
    connectionStatus,
  });

  return {
    configured,
    authenticated: apiAccessValidated,
    customerIdConfigured,
    hasDeveloperToken,
    oauthClientConfigured,
    oauthConfigured: authorizationConnected,
    authorizationConnected,
    apiAccessValidated,
    mode,
    connectionStatus,
    customerIdMasked: customerIdConfigured ? maskCustomerId(configuredCustomerId()) : null,
    customerIdDisplay: displayCustomerId(configuredCustomerId()),
    loginCustomerIdDisplay: displayCustomerId(configuredLoginCustomerId()),
    lastError,
  };
}

export function assertNoGoogleAdsSecrets(payload: unknown) {
  const serialized = JSON.stringify(payload);
  const forbidden = [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "clientSecret",
    "refreshToken",
    "developer-token",
    "ya29.",
  ];
  for (const key of forbidden) {
    if (serialized.includes(key)) {
      throw new Error(`Google Ads status leaked secret key: ${key}`);
    }
  }
}

export function hasMutationAdsTool(name: string) {
  return /create|update|delete|pause|enable|apply|budget|bid|mutate|remove/i.test(name);
}
