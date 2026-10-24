import { api } from "./api";
import { resolveApiUrl } from "./apiBase";
import { validateUploadableImage } from "./uploadImageAsset";
import type { SessionIntakeImageRef } from "./uploadSessionIntakeImage";

/** Public guest pay-first intake (no sign-in). The per-order token in the URL is the only key. */

export type GuestIntakeKind = "services" | "reports";

export interface GuestIntakeView {
  kind: GuestIntakeKind;
  productLabel: string;
  paymentStatus: "paid" | "processing";
  intakeStatus: "pending" | "submitted";
  email: string | null;
  fullName: string | null;
  session?: {
    bookingTypeId: string;
    sessionType: string;
    durationMinutes: number;
    requiresAvailability: boolean;
    requiresPhone: boolean;
  };
  report?: { reportType: string };
}

function unwrap<T>(response: unknown): T {
  const record = response as { data?: unknown } | null;
  return ((record && typeof record === "object" && "data" in record && record.data) ? record.data : response) as T;
}

export async function fetchGuestIntake(token: string): Promise<GuestIntakeView> {
  return unwrap<GuestIntakeView>(await api.get(`/guest/intake/${encodeURIComponent(token)}`));
}

export async function submitGuestIntake(token: string, body: Record<string, unknown>) {
  return unwrap<{ intakeStatus: "submitted" }>(await api.post(`/guest/intake/${encodeURIComponent(token)}/submit`, body));
}

export async function uploadGuestIntakeImage(token: string, file: File): Promise<SessionIntakeImageRef> {
  validateUploadableImage(file);
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(resolveApiUrl(`/guest/intake/${encodeURIComponent(token)}/images`), {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    throw new Error(body?.message || body?.error || `Upload failed (${res.status})`);
  }
  const payload = unwrap<Partial<SessionIntakeImageRef>>(await res.json());
  if (!payload.id || !payload.fileName || !payload.contentType) {
    throw new Error("Your photo could not be saved. Please try again.");
  }
  return { id: payload.id, fileName: payload.fileName, contentType: payload.contentType };
}

export function guestIntakePath(kind: GuestIntakeKind, token: string) {
  return `/intake/${kind}/${encodeURIComponent(token)}`;
}

/** Shared shell so the thank-you page and both intake forms keep the site look. */
export const GUEST_CARD_CLASS = "glass-card rounded-3xl p-6 sm:p-8";
