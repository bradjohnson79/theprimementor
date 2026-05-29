import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "application/markdown": ".md",
};

function uploadRoot() {
  const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
  return path.join(apiRoot, "uploads", "divin8-knowledge");
}

export async function ensureKnowledgeUploadDir() {
  await fs.mkdir(uploadRoot(), { recursive: true });
}

export function resolveKnowledgeSourcePath(sourcePath: string) {
  const safeName = path.basename(sourcePath);
  if (!safeName || safeName !== sourcePath || safeName.includes("..")) {
    return null;
  }
  return path.join(uploadRoot(), safeName);
}

export async function saveKnowledgeSourceFile(buffer: Buffer, mimeType: string) {
  await ensureKnowledgeUploadDir();
  const ext = EXT_BY_MIME[mimeType.toLowerCase()] ?? ".bin";
  const sourcePath = `${randomUUID()}${ext}`;
  await fs.writeFile(path.join(uploadRoot(), sourcePath), buffer);
  return { sourcePath };
}

export async function readKnowledgeSourceFile(sourcePath: string) {
  const resolved = resolveKnowledgeSourcePath(sourcePath);
  if (!resolved) {
    return null;
  }
  try {
    return await fs.readFile(resolved);
  } catch {
    return null;
  }
}
