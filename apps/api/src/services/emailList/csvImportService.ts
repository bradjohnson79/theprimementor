import { createHttpError } from "../booking/errors.js";
import { dedupeStoredContacts } from "./contactService.js";
import { isDuplicateKey } from "./exclusionService.js";
import {
  classifyCsvRow,
  parseCsvRecords,
  recognizeCsvHeaders,
  type CsvPreviewRow,
} from "./csv.js";
import type { EmailListStore } from "./emailListStore.js";

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_CSV_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
]);

export function rejectForgedCsvCommit(body: Record<string, unknown>) {
  if ("rows" in body || "contacts" in body || "emails" in body) {
    throw createHttpError(400, "Commit accepts only importSessionId");
  }
}

export function assertCsvUpload(file: { filename: string; mimetype: string; size: number }) {
  const name = file.filename.toLowerCase();
  if (file.size > MAX_CSV_BYTES) {
    throw createHttpError(400, "CSV must be 2MB or smaller");
  }
  if (!ALLOWED_MIME.has(file.mimetype) && !name.endsWith(".csv")) {
    throw createHttpError(400, "Upload a CSV file");
  }
}

export async function previewCsvImport(
  store: EmailListStore,
  userId: string,
  file: { filename: string; mimetype: string; buffer: Buffer },
) {
  await dedupeStoredContacts(store);
  assertCsvUpload({ filename: file.filename, mimetype: file.mimetype, size: file.buffer.length });
  let records: Record<string, string>[];
  try {
    records = parseCsvRecords(file.buffer);
  } catch {
    throw createHttpError(400, "CSV could not be parsed");
  }
  if (records.length === 0) {
    throw createHttpError(400, "CSV does not contain any rows");
  }
  const headers = Object.keys(records[0] ?? {});
  let columnMap;
  try {
    columnMap = recognizeCsvHeaders(headers);
  } catch (error) {
    throw createHttpError(400, error instanceof Error ? error.message : "CSV is missing an email column");
  }

  const existing = await store.existingNormalizedEmails();
  const exclusions = await store.listExclusions();
  const seen = new Set<string>();
  const rows = records.map((record, index) =>
    classifyCsvRow(
      index + 2,
      record[columnMap.email],
      columnMap.firstName ? record[columnMap.firstName] : undefined,
      seen,
      existing,
      exclusions,
    ),
  );

  const session = await store.insertCsvSession({
    user_id: userId,
    column_map: columnMap,
    rows,
    expires_at: new Date(Date.now() + SESSION_TTL_MS),
  });

  return {
    importSessionId: session.id,
    preview: {
      columnMap,
      rows,
      summary: summarizeRows(rows),
    },
  };
}

export async function commitCsvImport(
  store: EmailListStore,
  userId: string,
  body: Record<string, unknown>,
) {
  rejectForgedCsvCommit(body);
  const importSessionId = typeof body.importSessionId === "string" ? body.importSessionId : "";
  if (!importSessionId) {
    throw createHttpError(400, "importSessionId is required");
  }
  const session = await store.getCsvSession(userId, importSessionId);
  if (!session) {
    throw createHttpError(404, "Import session not found");
  }

  await dedupeStoredContacts(store);
  const existing = await store.existingNormalizedEmails();
  const exclusions = await store.listExclusions();
  const seen = new Set<string>();
  const revalidated = session.rows.map((row) =>
    classifyCsvRow(row.rowNumber, row.email, row.firstName ?? undefined, seen, existing, exclusions),
  );

  let added = 0;
  let alreadyExisted = 0;
  let duplicateInFile = 0;
  let invalid = 0;
  let skipped = 0;
  const importedThisRun = new Set<string>();

  for (const row of revalidated) {
    if (row.status === "new") {
      if (importedThisRun.has(row.emailNormalized)) {
        duplicateInFile += 1;
        continue;
      }
      if (existing.has(row.emailNormalized)) {
        alreadyExisted += 1;
        continue;
      }
      try {
        await store.insertContact({
          first_name: row.firstName,
          email: row.email,
          email_normalized: row.emailNormalized,
          source: "csv",
          source_reference: session.id,
          imported_by_user_id: userId,
        });
        importedThisRun.add(row.emailNormalized);
        existing.add(row.emailNormalized);
        added += 1;
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        alreadyExisted += 1;
      }
      continue;
    }
    if (row.status === "exists") alreadyExisted += 1;
    else if (row.status === "duplicate_in_file") duplicateInFile += 1;
    else if (row.status === "invalid" || row.status === "missing_email") invalid += 1;
    else if (row.status === "excluded") skipped += 1;
    else skipped += 1;
  }

  return {
    added,
    alreadyExisted,
    duplicateInFile,
    invalid,
    skipped,
  };
}

function summarizeRows(rows: CsvPreviewRow[]) {
  return {
    total: rows.length,
    new: rows.filter((row) => row.status === "new").length,
    exists: rows.filter((row) => row.status === "exists").length,
    duplicateInFile: rows.filter((row) => row.status === "duplicate_in_file").length,
    invalid: rows.filter((row) => row.status === "invalid" || row.status === "missing_email").length,
    excluded: rows.filter((row) => row.status === "excluded").length,
  };
}
