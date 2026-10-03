import { resolveApiUrl } from "./apiBase";
import { validateUploadableImage } from "./uploadImageAsset";

export interface SessionIntakeImageRef {
  id: string;
  fileName: string;
  contentType: string;
}

export async function uploadSessionIntakeImage(file: File, token: string | null) {
  validateUploadableImage(file);

  const form = new FormData();
  form.append("image", file);
  const res = await fetch(resolveApiUrl("/bookings/intake-images"), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Upload failed (${res.status})`);
  }

  const payload = (await res.json()) as Partial<SessionIntakeImageRef>;
  if (!payload.id || !payload.fileName || !payload.contentType) {
    throw new Error("Intake image could not be saved. Please try again.");
  }

  return {
    id: payload.id,
    fileName: payload.fileName,
    contentType: payload.contentType,
  } satisfies SessionIntakeImageRef;
}
