import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

interface PhysiognomyImageMetadata {
  ownerUserId: string | null;
  createdAt: string;
}

/** Resolves to apps/api/uploads/physiognomy regardless of process cwd */
function uploadRoot(): string {
  const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  return path.join(apiRoot, "uploads", "physiognomy");
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export async function ensurePhysiognomyUploadDir(): Promise<void> {
  await fs.mkdir(uploadRoot(), { recursive: true });
}

/** Returns basename filename only, e.g. `a1b2c3.jpg` — safe to store in JSON */
export async function savePhysiognomyImage(
  buffer: Buffer,
  mimeType: string,
  options?: {
    ownerUserId?: string | null;
  },
): Promise<{ imageAssetId: string }> {
  await ensurePhysiognomyUploadDir();
  const ext = EXT_BY_MIME[mimeType.toLowerCase()] ?? ".bin";
  const imageAssetId = `${randomUUID()}${ext}`;
  const fp = path.join(uploadRoot(), imageAssetId);
  await fs.writeFile(fp, buffer);
  await fs.writeFile(resolveMetadataPath(imageAssetId), JSON.stringify({
    ownerUserId: options?.ownerUserId?.trim() || null,
    createdAt: new Date().toISOString(),
  } satisfies PhysiognomyImageMetadata));
  return { imageAssetId };
}

function resolveSafePath(imageAssetId: string): string | null {
  const base = path.basename(imageAssetId);
  if (!base || base.includes("..") || base !== imageAssetId) return null;
  return path.join(uploadRoot(), base);
}

function resolveMetadataPath(imageAssetId: string): string {
  return `${path.join(uploadRoot(), `${path.basename(imageAssetId)}.meta`)}.json`;
}

export async function readPhysiognomyImage(imageAssetId: string): Promise<Buffer | null> {
  const fp = resolveSafePath(imageAssetId);
  if (!fp) return null;
  try {
    return await fs.readFile(fp);
  } catch {
    return null;
  }
}

export async function readPhysiognomyImageMetadata(imageAssetId: string): Promise<PhysiognomyImageMetadata | null> {
  const fp = resolveSafePath(imageAssetId);
  if (!fp) return null;

  try {
    const raw = await fs.readFile(resolveMetadataPath(imageAssetId), "utf8");
    const parsed = JSON.parse(raw) as Partial<PhysiognomyImageMetadata>;
    return {
      ownerUserId: typeof parsed.ownerUserId === "string" && parsed.ownerUserId.trim()
        ? parsed.ownerUserId.trim()
        : null,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function canAccessPhysiognomyImage(
  imageAssetId: string,
  actor: { userId: string; role: string },
): Promise<boolean> {
  if (actor.role === "admin") {
    return (await readPhysiognomyImage(imageAssetId)) !== null;
  }

  const metadata = await readPhysiognomyImageMetadata(imageAssetId);
  if (!metadata?.ownerUserId) {
    return false;
  }

  return metadata.ownerUserId === actor.userId;
}

export async function deletePhysiognomyImage(imageAssetId: string | undefined | null): Promise<void> {
  if (!imageAssetId) return;
  const fp = resolveSafePath(imageAssetId);
  if (!fp) return;
  try {
    await fs.access(fp);
    await fs.unlink(fp);
  } catch {
    /* already gone */
  }
  try {
    await fs.unlink(resolveMetadataPath(imageAssetId));
  } catch {
    /* already gone */
  }
}

export function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  const b64 = buffer.toString("base64");
  return `data:${mimeType};base64,${b64}`;
}

export function mimeTypeForAssetId(imageAssetId: string): string {
  const ext = path.extname(imageAssetId).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

const SAFE_UPLOAD_BASENAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|webp)$/i;

/** Orphan uploads (abandoned before generate/interpret) — safe basename filenames only */
export async function deleteStalePhysiognomyUploads(maxAgeMs: number): Promise<number> {
  const root = uploadRoot();
  let removed = 0;
  let entries: Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return 0;
  }
  const now = Date.now();
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const name = ent.name;
    if (!SAFE_UPLOAD_BASENAME.test(name)) continue;
    const fp = path.join(root, name);
    try {
      const st = await fs.stat(fp);
      if (now - st.mtimeMs > maxAgeMs) {
        await fs.unlink(fp);
        removed++;
      }
    } catch {
      /* skip */
    }
  }
  return removed;
}
