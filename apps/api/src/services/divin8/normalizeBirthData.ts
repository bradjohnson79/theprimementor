import { normalizeBirthTimeToStorage } from "../blueprint/schemas.js";

export interface Divin8BirthDataInput {
  fullName?: string | null;
  birthDate?: string | null;
  birthTime?: string | null;
  birthLocation?: string | null;
  timezone?: string | null;
}

export interface NormalizedDivin8BirthData {
  fullName: string | null;
  birthDate: string | null;
  birthTime: string | null;
  birthLocation: string | null;
  timezone: string | null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed : null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  let trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  trimmed = trimmed.replace(/(\d+)(?:st|nd|rd|th)/gi, "$1");

  const numericMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (numericMatch) {
    const month = Number(numericMatch[1]);
    const day = Number(numericMatch[2]);
    const rawYear = Number(numericMatch[3]);
    const year = numericMatch[3].length === 2 ? (rawYear >= 30 ? 1900 + rawYear : 2000 + rawYear) : rawYear;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year > 0) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function normalizeTimezone(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  if (/^utc(?:[+-]\d{1,2}(?::\d{2})?)?$/i.test(normalized)) {
    return normalized.toUpperCase();
  }

  return normalized;
}

export function normalizeBirthData(input: Divin8BirthDataInput): NormalizedDivin8BirthData {
  return {
    fullName: normalizeText(input.fullName),
    birthDate: normalizeDate(input.birthDate),
    birthTime: normalizeBirthTimeToStorage(normalizeText(input.birthTime)),
    birthLocation: normalizeText(input.birthLocation),
    timezone: normalizeTimezone(input.timezone),
  };
}
