import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

export function resolveEncryptionKey(envName: string): Buffer {
  const raw = process.env[envName]?.trim() ?? "";
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  if (raw.length >= 32) {
    return Buffer.from(raw).subarray(0, 32);
  }
  throw new Error(`${envName} must be a 32-byte hex or 32-character secret`);
}

export function encryptJson(payload: unknown, envName: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, resolveEncryptionKey(envName), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptJson<T>(value: string, envName: string): T {
  const [ivPart, tagPart, dataPart] = value.split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Invalid encrypted token payload");
  }
  const decipher = createDecipheriv(ALGORITHM, resolveEncryptionKey(envName), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}
