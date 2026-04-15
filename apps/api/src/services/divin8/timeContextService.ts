import { PLATFORM_TIMEZONE } from "@wisdom/utils";
import { formatInTimeZone } from "date-fns-tz";

export type Divin8TimezoneSource = "timeline" | "profile" | "user" | "platform";

export interface ResolveTimezoneInput {
  timelineTimezone?: string | null;
  profileTimezone?: string | null;
  userTimezone?: string | null;
}

export interface Divin8CurrentTimeContext {
  currentDate: string;
  currentTime: string;
  currentDateTime: string;
  timezone: string;
  source: Divin8TimezoneSource;
}

function isValidIanaTimezone(value: string | null | undefined): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeTimezone(value: string | null | undefined): string | null {
  return isValidIanaTimezone(value) ? value.trim() : null;
}

export function resolveTimezone(input: ResolveTimezoneInput): string {
  return normalizeTimezone(input.timelineTimezone)
    ?? normalizeTimezone(input.profileTimezone)
    ?? normalizeTimezone(input.userTimezone)
    ?? PLATFORM_TIMEZONE;
}

export function resolveTimezoneSource(input: ResolveTimezoneInput): Divin8TimezoneSource {
  if (normalizeTimezone(input.timelineTimezone)) {
    return "timeline";
  }
  if (normalizeTimezone(input.profileTimezone)) {
    return "profile";
  }
  if (normalizeTimezone(input.userTimezone)) {
    return "user";
  }
  return "platform";
}

export function buildCurrentTimeContext(input: ResolveTimezoneInput, now = new Date()): Divin8CurrentTimeContext {
  const timezone = resolveTimezone(input);
  return {
    currentDate: formatInTimeZone(now, timezone, "yyyy-MM-dd"),
    currentTime: formatInTimeZone(now, timezone, "HH:mm"),
    currentDateTime: formatInTimeZone(now, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX"),
    timezone,
    source: resolveTimezoneSource(input),
  };
}
