import { createHttpError } from "../booking/errors.js";
import { normalizeEmail } from "./emailNormalize.js";
import type { EmailListStore, SuppressionRow } from "./emailListStore.js";
import type { SuppressionReason, SuppressionSource } from "./emailHealthTypes.js";

export const SUPPRESSED_IMPORT_REASON = "Previously removed due to hard bounce.";

export async function getSuppression(
  store: EmailListStore,
  email: string,
): Promise<SuppressionRow | null> {
  return store.getSuppressionByNormalized(normalizeEmail(email));
}

export async function isSuppressed(store: EmailListStore, email: string): Promise<boolean> {
  return Boolean(await getSuppression(store, email));
}

export async function assertNotSuppressed(store: EmailListStore, email: string): Promise<void> {
  if (await isSuppressed(store, email)) {
    throw createHttpError(409, SUPPRESSED_IMPORT_REASON);
  }
}

export async function listEmailSuppressions(store: EmailListStore) {
  const rows = await store.listSuppressions();
  return {
    suppressions: rows.map(serializeSuppression),
  };
}

export function serializeSuppression(row: SuppressionRow) {
  return {
    id: row.id,
    email: row.email_normalized,
    reason: row.reason,
    source: row.source,
    providerEventId: row.provider_event_id,
    suppressedAt: row.suppressed_at.toISOString(),
  };
}

export async function restoreSuppression(
  store: EmailListStore,
  id: string,
  body: { confirm?: unknown },
) {
  if (body.confirm !== true) {
    throw createHttpError(400, "Restoration requires confirm: true");
  }
  const current = await store.getSuppressionById(id);
  if (!current) {
    throw createHttpError(404, "Suppression not found");
  }
  const deleted = await store.deleteSuppression(id);
  if (!deleted) {
    throw createHttpError(404, "Suppression not found");
  }
  return { restored: true, email: current.email_normalized };
}

export async function upsertSuppression(
  store: EmailListStore,
  input: {
    emailNormalized: string;
    reason: SuppressionReason;
    source: SuppressionSource;
    providerEventId?: string | null;
    createdByUserId?: string | null;
  },
): Promise<SuppressionRow> {
  const existing = await store.getSuppressionByNormalized(input.emailNormalized);
  if (existing) return existing;
  return store.insertSuppression({
    email_normalized: input.emailNormalized,
    reason: input.reason,
    source: input.source,
    provider_event_id: input.providerEventId ?? null,
    created_by_user_id: input.createdByUserId ?? null,
  });
}
