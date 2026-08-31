import { createHttpError } from "../booking/errors.js";
import type { EmailListStore, ExclusionRow } from "./emailListStore.js";
import { parseExclusionInput } from "./exclusionRules.js";

export function isDuplicateKey(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const record = current as { code?: unknown; cause?: unknown; message?: unknown };
    if (record.code === "23505") return true;
    if (typeof record.message === "string" && /duplicate key|unique constraint/i.test(record.message)) return true;
    current = record.cause;
  }
  return false;
}

export function serializeExclusion(row: ExclusionRow) {
  return {
    id: row.id,
    kind: row.kind,
    value: row.value,
    pattern: row.pattern,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listExclusionRules(store: EmailListStore) {
  const rows = await store.listExclusions();
  return { exclusions: rows.map(serializeExclusion) };
}

export async function createExclusionRule(
  store: EmailListStore,
  userId: string,
  input: { pattern?: string },
) {
  let parsed;
  try {
    parsed = parseExclusionInput(input.pattern ?? "");
  } catch (error) {
    throw createHttpError(400, error instanceof Error ? error.message : "Enter an email or a domain like @facebook.com");
  }

  const existing = await store.listExclusions();
  if (existing.some((row) => row.kind === parsed.kind && row.value === parsed.value)) {
    throw createHttpError(409, "That exclusion is already on the list");
  }

  try {
    const created = await store.insertExclusion({
      kind: parsed.kind,
      value: parsed.value,
      pattern: parsed.pattern,
      created_by_user_id: userId,
    });
    return serializeExclusion(created);
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw createHttpError(409, "That exclusion is already on the list");
    }
    throw createHttpError(500, "Could not save that exclusion filter");
  }
}

export async function deleteExclusionRule(store: EmailListStore, id: string) {
  const deleted = await store.deleteExclusion(id);
  if (!deleted) throw createHttpError(404, "Exclusion not found");
  return { deleted: true };
}
