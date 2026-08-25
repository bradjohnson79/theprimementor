import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { shopProductFiles, shopProducts, type Database } from "@wisdom/db";
import { createHttpError } from "../booking/errors.js";
import { readShopFile } from "./shopFileStorage.js";
import { getShopEntitlement, hasActiveShopEntitlement } from "./shopEntitlementService.js";

const TOKEN_TTL_MS = 10 * 60 * 1000;
const ASCII_FILENAME_SAFE = /[^A-Za-z0-9._' -]+/g;

export function shopDownloadFilename(displayName: string, fallbackExtension = "") {
  const cleaned = displayName.replace(/["\r\n]/g, "").trim() || "download";
  return /\.[a-z0-9]+$/i.test(cleaned) ? cleaned : `${cleaned}${fallbackExtension}`;
}

export function buildShopContentDisposition(displayName: string, fallbackExtension = "") {
  const filename = shopDownloadFilename(displayName, fallbackExtension);
  const ascii = filename
    .normalize("NFKD")
    .replace(/[\u2012-\u2015]/g, "-")
    .replace(ASCII_FILENAME_SAFE, "-")
    .replace(/-{2,}/g, "-")
    .replace(/["\r\n]/g, "")
    .trim() || "download";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function downloadSecret() {
  return process.env.CLERK_SECRET_KEY?.trim() || process.env.STRIPE_WEBHOOK_SECRET?.trim() || "shop-download-dev";
}

export function createShopDownloadToken(input: { fileId: string; userId: string; expiresAt: number }) {
  const payload = `${input.fileId}.${input.userId}.${input.expiresAt}`;
  const signature = createHmac("sha256", downloadSecret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifyShopDownloadToken(token: string): { fileId: string; userId: string; expiresAt: number } {
  const parts = token.split(".");
  if (parts.length !== 4) {
    throw createHttpError(400, "Download link is invalid.");
  }
  const [fileId, userId, expiresRaw, signature] = parts;
  const expiresAt = Number(expiresRaw);
  if (!fileId || !userId || !Number.isFinite(expiresAt) || !signature) {
    throw createHttpError(400, "Download link is invalid.");
  }
  if (Date.now() > expiresAt) {
    throw createHttpError(410, "This download link has expired. Request a new download.");
  }
  const expected = createHmac("sha256", downloadSecret()).update(`${fileId}.${userId}.${expiresAt}`).digest("hex");
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) {
    throw createHttpError(403, "Download link is invalid.");
  }
  return { fileId, userId, expiresAt };
}

export async function issueShopDownloadToken(
  db: Database,
  input: { userId: string; fileId: string },
) {
  const file = await getAvailableShopFile(db, input.fileId);
  const entitlement = await getShopEntitlement(db, { userId: input.userId, productId: file.product_id });
  if (!hasActiveShopEntitlement(entitlement)) {
    throw createHttpError(403, "This download is available only after a verified purchase.");
  }
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  return {
    token: createShopDownloadToken({ fileId: file.id, userId: input.userId, expiresAt }),
    expiresAt: new Date(expiresAt).toISOString(),
    displayName: file.display_name,
  };
}

export async function loadAuthorizedShopDownload(
  db: Database,
  input: { token: string; userId: string },
) {
  const parsed = verifyShopDownloadToken(input.token);
  if (parsed.userId !== input.userId) {
    throw createHttpError(403, "This download belongs to another account.");
  }
  const file = await getAvailableShopFile(db, parsed.fileId);
  const entitlement = await getShopEntitlement(db, { userId: input.userId, productId: file.product_id });
  if (!hasActiveShopEntitlement(entitlement)) {
    throw createHttpError(403, "This download is available only after a verified purchase.");
  }
  const buffer = await readShopFile("files", file.storage_key);
  if (!buffer) {
    throw createHttpError(404, "The purchased file is not attached yet.");
  }
  return {
    buffer,
    displayName: file.display_name,
    mimeType: file.mime_type || "application/octet-stream",
  };
}

export function isShopInstructionFileKind(kind: string) {
  return kind === "booklet" || kind === "manual";
}

export function isPublicShopBooklet(
  file: { kind: string; is_available: boolean },
  product: { is_active: boolean; status: string },
) {
  return Boolean(
    file.kind === "booklet"
    && file.is_available
    && product.is_active
    && product.status === "active",
  );
}

export async function loadPublicShopBooklet(db: Database, slug: string) {
  const [product] = await db
    .select()
    .from(shopProducts)
    .where(eq(shopProducts.slug, slug.trim()))
    .limit(1);
  if (!product) {
    throw createHttpError(404, "This Shop product is not available.");
  }

  const [file] = await db
    .select()
    .from(shopProductFiles)
    .where(and(
      eq(shopProductFiles.product_id, product.id),
      eq(shopProductFiles.kind, "booklet"),
      eq(shopProductFiles.is_available, true),
    ))
    .limit(1);

  if (!file || !isPublicShopBooklet(file, product)) {
    throw createHttpError(404, "Instruction booklet is not available.");
  }

  const buffer = await readShopFile("files", file.storage_key);
  if (!buffer) {
    throw createHttpError(404, "Instruction booklet is not available.");
  }

  return {
    buffer,
    displayName: file.display_name,
    mimeType: file.mime_type || "application/pdf",
  };
}

async function getAvailableShopFile(db: Database, fileId: string) {
  const [file] = await db
    .select()
    .from(shopProductFiles)
    .where(and(eq(shopProductFiles.id, fileId), eq(shopProductFiles.is_available, true)))
    .limit(1);
  if (!file) {
    throw createHttpError(404, "Download file was not found.");
  }
  return file;
}
