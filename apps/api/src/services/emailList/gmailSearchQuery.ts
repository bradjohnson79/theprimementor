import { createHttpError } from "../booking/errors.js";

export const GMAIL_SEARCH_MIN_YEAR = 2004;

export function currentSearchYear() {
  return new Date().getFullYear();
}

export function parseSearchYear(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const year = typeof value === "number" ? value : Number.parseInt(String(value).trim(), 10);
  const maxYear = currentSearchYear();
  if (!Number.isInteger(year) || year < GMAIL_SEARCH_MIN_YEAR || year > maxYear) {
    throw createHttpError(400, `Year must be between ${GMAIL_SEARCH_MIN_YEAR} and ${maxYear}`);
  }
  return year;
}

export function buildGmailSearchQuery(keyword: string, year?: number) {
  const query = keyword.trim();
  if (!query || year === undefined) return query;
  return `${query} after:${year}/01/01 before:${year + 1}/01/01`;
}
