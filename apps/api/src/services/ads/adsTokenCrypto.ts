import { decryptJson, encryptJson } from "../crypto/secretPayload.js";

export interface AdsGoogleTokenPayload {
  accessToken: string;
  refreshToken: string;
  expiryDate?: number | null;
  scope?: string | null;
}

export function encryptAdsGoogleTokens(payload: AdsGoogleTokenPayload): string {
  return encryptJson(payload, "ADS_TOKEN_ENCRYPTION_KEY");
}

export function decryptAdsGoogleTokens(value: string): AdsGoogleTokenPayload {
  return decryptJson<AdsGoogleTokenPayload>(value, "ADS_TOKEN_ENCRYPTION_KEY");
}
