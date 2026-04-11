import { resolveApiUrl } from "./apiBase";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export interface UploadedImageAsset {
  imageAssetId: string;
  previewUrl: string;
  fileName: string;
}

export function validateUploadableImage(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Please upload a JPEG, PNG, or WebP image.");
  }

  if (file.size > MAX_BYTES) {
    throw new Error(`Image must be under 5MB (yours is ${(file.size / 1024 / 1024).toFixed(1)}MB).`);
  }
}

export async function uploadImageAsset(file: File, token: string | null) {
  validateUploadableImage(file);

  const form = new FormData();
  form.append("image", file);

  const res = await fetch(resolveApiUrl("/images/upload"), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Upload failed (${res.status})`);
  }

  const payload = (await res.json()) as { imageAssetId: string };

  return {
    imageAssetId: payload.imageAssetId,
    previewUrl: URL.createObjectURL(file),
    fileName: file.name,
  } satisfies UploadedImageAsset;
}
