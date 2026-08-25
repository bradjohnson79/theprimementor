import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

export type ShopStorageKind = "images" | "files";

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function uploadRoot(kind: ShopStorageKind): string {
  const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  return path.join(apiRoot, "uploads", "shop", kind);
}

export function sanitizeShopStorageKey(storageKey: string): string | null {
  const base = path.basename(storageKey);
  if (!base || base.includes("..") || base !== storageKey) return null;
  return base;
}

export async function saveShopFile(
  kind: ShopStorageKind,
  buffer: Buffer,
  mimeType: string,
  originalName?: string,
): Promise<{ storageKey: string; sizeBytes: number }> {
  await fs.mkdir(uploadRoot(kind), { recursive: true });
  const ext = kind === "images"
    ? (IMAGE_EXT_BY_MIME[mimeType.toLowerCase()] ?? ".bin")
    : path.extname(originalName ?? "").replace(/[^\w.]/g, "") || ".bin";
  const storageKey = `${randomUUID()}${ext}`;
  await fs.writeFile(path.join(uploadRoot(kind), storageKey), buffer);
  return { storageKey, sizeBytes: buffer.byteLength };
}

export async function readShopFile(kind: ShopStorageKind, storageKey: string): Promise<Buffer | null> {
  const safe = sanitizeShopStorageKey(storageKey);
  if (!safe) return null;
  try {
    return await fs.readFile(path.join(uploadRoot(kind), safe));
  } catch {
    return null;
  }
}

export async function deleteShopFile(kind: ShopStorageKind, storageKey: string): Promise<void> {
  const safe = sanitizeShopStorageKey(storageKey);
  if (!safe) return;
  try {
    await fs.unlink(path.join(uploadRoot(kind), safe));
  } catch {
    // already gone
  }
}
