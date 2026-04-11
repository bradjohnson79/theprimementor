import { PLATFORM_TIMEZONE } from "@wisdom/utils";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { createHttpError } from "./errors.js";

export const BOOKING_BASE_TIME_ZONE = PLATFORM_TIMEZONE;
export const BOOKING_WINDOW_START_HOUR = 9;
export const BOOKING_WINDOW_END_HOUR = 18;
export const BOOKING_SLOT_INCREMENT_MINUTES = 30;
export const BOOKING_MIN_LEAD_HOURS = 12;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function assertValidTimeZone(timezone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    throw createHttpError(400, "Invalid timezone. Use a valid IANA timezone.");
  }
}

export function assertValidDateString(date: string): string {
  if (!DATE_PATTERN.test(date)) {
    throw createHttpError(400, "Invalid date. Use YYYY-MM-DD.");
  }

  const utcNoon = fromZonedTime(`${date}T12:00:00`, BOOKING_BASE_TIME_ZONE);
  const normalized = formatInTimeZone(utcNoon, BOOKING_BASE_TIME_ZONE, "yyyy-MM-dd");
  if (normalized !== date) {
    throw createHttpError(400, "Invalid date. Use YYYY-MM-DD.");
  }

  return date;
}

export function parseUtcDate(value: string, fieldName: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, `Invalid ${fieldName}. Use an ISO-8601 UTC timestamp.`);
  }
  return parsed;
}

export function getUtcForLocalTime(date: string, time: string, timeZone: string): Date {
  return fromZonedTime(`${date}T${time}:00`, timeZone);
}

export function formatDateInTimeZone(date: Date, timeZone: string, format: string): string {
  return formatInTimeZone(date, timeZone, format);
}

export function toUtcIso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addHours(date: Date, hours: number): Date {
  return addMinutes(date, hours * 60);
}

export function getWeekdayNumber(date: string, timeZone: string): number {
  const utcNoon = getUtcForLocalTime(date, "12:00", timeZone);
  return Number(formatInTimeZone(utcNoon, timeZone, "i"));
}

export function getDateStringInTimeZone(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "yyyy-MM-dd");
}

export function minutesToTimeString(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}
