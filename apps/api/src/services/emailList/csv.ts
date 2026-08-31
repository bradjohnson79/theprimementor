import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { matchExclusion, type ExclusionRule } from "./exclusionRules.js";
import { extractFirstName } from "./firstName.js";
import { isValidEmail, normalizeEmail } from "./emailNormalize.js";

export const EMAIL_HEADERS = ["email", "email_address", "email address", "emailaddress"];
export const FIRST_NAME_HEADERS = ["first_name", "firstname", "first name", "name"];

export interface CsvColumnMap {
  email: string;
  firstName: string | null;
}

export interface CsvPreviewRow {
  rowNumber: number;
  email: string;
  emailNormalized: string;
  firstName: string | null;
  status: "new" | "exists" | "duplicate_in_file" | "invalid" | "missing_email" | "excluded";
  reason: string | null;
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

export function recognizeCsvHeaders(headers: string[]): CsvColumnMap {
  const normalized = headers.map((header) => ({ raw: header, key: normalizeHeader(header) }));
  const email = normalized.find((header) => EMAIL_HEADERS.includes(header.key));
  const firstName = normalized.find((header) => FIRST_NAME_HEADERS.includes(header.key));
  if (!email) {
    throw new Error("CSV is missing an email column");
  }
  return { email: email.raw, firstName: firstName?.raw ?? null };
}

export function sanitizeCsvCell(value: string): string {
  const trimmed = value.replace(/^\uFEFF/, "").trim();
  if (/^[=+\-@]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

export function parseFirstNameFromCsv(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return extractFirstName(trimmed, null);
}

export function classifyCsvRow(
  rowNumber: number,
  emailValue: string | undefined,
  firstNameValue: string | undefined,
  seen: Set<string>,
  existing: Set<string>,
  exclusions: Array<Pick<ExclusionRule, "kind" | "value">> = [],
): CsvPreviewRow {
  const rawEmail = emailValue?.trim() ?? "";
  if (!rawEmail) {
    return {
      rowNumber,
      email: "",
      emailNormalized: "",
      firstName: parseFirstNameFromCsv(firstNameValue),
      status: "missing_email",
      reason: "Missing email address",
    };
  }
  if (!isValidEmail(rawEmail)) {
    return {
      rowNumber,
      email: rawEmail,
      emailNormalized: normalizeEmail(rawEmail),
      firstName: parseFirstNameFromCsv(firstNameValue),
      status: "invalid",
      reason: "Invalid email address",
    };
  }
  const emailNormalized = normalizeEmail(rawEmail);
  const exclusion = matchExclusion(rawEmail, exclusions);
  if (exclusion.filtered) {
    return {
      rowNumber,
      email: rawEmail,
      emailNormalized,
      firstName: parseFirstNameFromCsv(firstNameValue),
      status: "excluded",
      reason: exclusion.reason,
    };
  }
  if (seen.has(emailNormalized)) {
    return {
      rowNumber,
      email: rawEmail,
      emailNormalized,
      firstName: parseFirstNameFromCsv(firstNameValue),
      status: "duplicate_in_file",
      reason: "Duplicate row in file",
    };
  }
  seen.add(emailNormalized);
  if (existing.has(emailNormalized)) {
    return {
      rowNumber,
      email: rawEmail,
      emailNormalized,
      firstName: parseFirstNameFromCsv(firstNameValue),
      status: "exists",
      reason: "Already in master list",
    };
  }
  return {
    rowNumber,
    email: rawEmail,
    emailNormalized,
    firstName: parseFirstNameFromCsv(firstNameValue),
    status: "new",
    reason: null,
  };
}

export function parseCsvRecords(buffer: Buffer | string): Record<string, string>[] {
  return parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as Record<string, string>[];
}

export function buildExportCsv(rows: Array<{ email: string; firstName: string | null }>): string {
  return stringify(
    rows.map((row) => [sanitizeCsvCell(row.email), sanitizeCsvCell(row.firstName ?? "")]),
    { header: true, columns: ["email", "first_name"] },
  );
}

export function exportHasOnlyAllowedColumns(csv: string): boolean {
  const header = csv.split(/\r?\n/)[0]?.trim() ?? "";
  return header === "email,first_name";
}
