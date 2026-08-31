import { decryptJson, encryptJson } from "../crypto/secretPayload.js";

export interface GmailTokenPayload {
  accessToken: string;
  refreshToken: string;
  expiryDate?: number | null;
  scope?: string | null;
}

export function encryptTokenPayload(payload: GmailTokenPayload): string {
  return encryptJson(payload, "GMAIL_TOKEN_ENCRYPTION_KEY");
}

export function decryptTokenPayload(value: string): GmailTokenPayload {
  return decryptJson<GmailTokenPayload>(value, "GMAIL_TOKEN_ENCRYPTION_KEY");
}
