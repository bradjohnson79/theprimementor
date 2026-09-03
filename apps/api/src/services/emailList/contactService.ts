import { createHttpError } from "../booking/errors.js";
import { buildExportCsv, exportHasOnlyAllowedColumns } from "./csv.js";
import { displayEmail, isValidEmail, normalizeEmail } from "./emailNormalize.js";
import type { ContactPatch, ContactRow, ContactSource, EmailListStore, ListContactsQuery } from "./emailListStore.js";
import { isHealthStatus } from "./emailHealthTypes.js";
import { assertNotSuppressed } from "./emailSuppressionService.js";

function sanitizeFirstName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 80);
}

export function serializeContact(row: Pick<ContactRow, "id" | "first_name" | "email" | "source" | "created_at" | "health_status" | "health_checked_at" | "health_source" | "health_reason" | "bounce_count" | "soft_bounce_count">) {
  return {
    id: row.id,
    firstName: row.first_name,
    email: row.email,
    source: row.source,
    createdAt: row.created_at.toISOString(),
    healthStatus: row.health_status,
    healthCheckedAt: row.health_checked_at?.toISOString() ?? null,
    healthSource: row.health_source,
    healthReason: row.health_reason,
    bounceCount: row.bounce_count,
    softBounceCount: row.soft_bounce_count,
  };
}

export async function dedupeStoredContacts(store: EmailListStore) {
  const rows = await store.listAllContacts();
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = normalizeEmail(row.email);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  let removed = 0;
  for (const [key, list] of groups) {
    list.sort((left, right) => left.created_at.getTime() - right.created_at.getTime());
    const keeper = list[0];
    if (!keeper) continue;
    const firstName = list.find((row) => row.first_name)?.first_name ?? keeper.first_name;
    if (keeper.email_normalized !== key || (firstName && !keeper.first_name)) {
      await store.updateContact(keeper.id, {
        email_normalized: key,
        first_name: keeper.first_name ?? firstName,
      });
    }
    for (const extra of list.slice(1)) {
      if (await store.deleteContact(extra.id)) removed += 1;
    }
  }
  return { removed };
}

export async function listEmailContacts(store: EmailListStore, query: ListContactsQuery) {
  await dedupeStoredContacts(store);
  const result = await store.listContacts(query);
  return {
    contacts: result.rows.map(serializeContact),
    pagination: {
      page: Math.max(1, query.page ?? 1),
      pageSize: Math.min(100, Math.max(1, query.pageSize ?? 25)),
      total: result.total,
    },
  };
}

export async function createManualContact(
  store: EmailListStore,
  userId: string,
  input: { email?: string; firstName?: string | null },
) {
  const email = displayEmail(input.email ?? "");
  if (!isValidEmail(email)) {
    throw createHttpError(400, "A valid email address is required");
  }
  const emailNormalized = normalizeEmail(email);
  await assertNotSuppressed(store, emailNormalized);
  const existing = await store.getContactByNormalized(emailNormalized);
  if (existing) {
    throw createHttpError(409, "That email is already on the master list");
  }
  const created = await store.insertContact({
    first_name: sanitizeFirstName(input.firstName),
    email,
    email_normalized: emailNormalized,
    source: "manual",
    source_reference: null,
    imported_by_user_id: userId,
  });
  return serializeContact(created);
}

export async function updateEmailContact(
  store: EmailListStore,
  id: string,
  input: { email?: string; firstName?: string | null },
) {
  const current = await store.getContactById(id);
  if (!current) throw createHttpError(404, "Contact not found");
  const patch: ContactPatch = {};
  if (input.firstName !== undefined) {
    patch.first_name = sanitizeFirstName(input.firstName);
  }
  if (input.email !== undefined) {
    const email = displayEmail(input.email);
    if (!isValidEmail(email)) {
      throw createHttpError(400, "A valid email address is required");
    }
    const emailNormalized = normalizeEmail(email);
    await assertNotSuppressed(store, emailNormalized);
    const clash = await store.getContactByNormalized(emailNormalized);
    if (clash && clash.id !== id) {
      throw createHttpError(409, "That email is already on the master list");
    }
    patch.email = email;
    patch.email_normalized = emailNormalized;
    if (emailNormalized !== current.email_normalized) {
      patch.health_status = "unchecked";
      patch.health_checked_at = null;
      patch.health_source = null;
      patch.health_reason = null;
      patch.last_bounce_at = null;
      patch.bounce_count = 0;
      patch.soft_bounce_count = 0;
      patch.last_soft_bounce_at = null;
    }
  }
  const updated = await store.updateContact(id, patch);
  if (!updated) throw createHttpError(404, "Contact not found");
  return serializeContact(updated);
}

export async function deleteEmailContact(store: EmailListStore, id: string) {
  const deleted = await store.deleteContact(id);
  if (!deleted) throw createHttpError(404, "Contact not found");
  return { deleted: true };
}

export async function bulkDeleteEmailContacts(store: EmailListStore, ids: unknown) {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    throw createHttpError(400, "ids must be an array of contact ids");
  }
  const deleted = await store.deleteContacts(ids as string[]);
  return { deleted };
}

export async function exportEmailContactsCsv(store: EmailListStore) {
  const suppressed = await store.existingSuppressedEmails();
  const rows = (await store.listAllContacts()).filter((row) => (
    !suppressed.has(row.email_normalized)
    && row.health_status !== "hard_bounce"
    && row.health_status !== "invalid"
  ));
  const csv = buildExportCsv(rows.map((row) => ({ email: row.email, firstName: row.first_name })));
  if (!exportHasOnlyAllowedColumns(csv)) {
    throw createHttpError(500, "Export columns are invalid");
  }
  return csv;
}

export function parseContactListQuery(query: Record<string, unknown>): ListContactsQuery {
  const source = typeof query.source === "string" ? query.source : "";
  const healthStatus = typeof query.healthStatus === "string" ? query.healthStatus : "";
  return {
    search: typeof query.search === "string" ? query.search : "",
    source: source === "gmail" || source === "csv" || source === "manual" ? source as ContactSource : "",
    healthStatus: isHealthStatus(healthStatus) ? healthStatus : "",
    sort: query.sort === "oldest" || query.sort === "email" || query.sort === "name" ? query.sort : "newest",
    page: Number(query.page ?? 1) || 1,
    pageSize: Number(query.pageSize ?? query.limit ?? 25) || 25,
  };
}
