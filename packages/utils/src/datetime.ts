/**
 * Prime Mentor platform clock: all stored instants are UTC (ISO with `Z`);
 * all user-facing timestamps use this IANA zone unless a feature explicitly
 * formats in another zone (e.g. booking slot preview in the member’s zone).
 */
export const PLATFORM_TIMEZONE = "America/Los_Angeles";

/** Serialize a Date as ISO-8601 UTC with `Z` suffix (single conversion, no offset drift). */
export function toUtcIsoString(date: Date): string {
  return date.toISOString();
}

interface PacificDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function parsePacificDateTimeParts(date: string, time: string): PacificDateTimeParts {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!dateMatch) {
    throw new Error("Expiration date must use YYYY-MM-DD.");
  }
  if (!timeMatch) {
    throw new Error("Expiration time must use HH:MM.");
  }

  const parts = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  };
  const canonicalDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    parts.month < 1
    || parts.month > 12
    || parts.day < 1
    || parts.day > 31
    || canonicalDate.getUTCFullYear() !== parts.year
    || canonicalDate.getUTCMonth() !== parts.month - 1
    || canonicalDate.getUTCDate() !== parts.day
  ) {
    throw new Error("Expiration date is invalid.");
  }
  if (parts.hour < 0 || parts.hour > 23 || parts.minute < 0 || parts.minute > 59) {
    throw new Error("Expiration time is invalid.");
  }
  return parts;
}

function getPacificParts(date: Date): PacificDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PLATFORM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function partsToUtcMs(parts: PacificDateTimeParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

function samePacificParts(left: PacificDateTimeParts, right: PacificDateTimeParts) {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute;
}

/**
 * Convert an admin-entered Pacific wall-clock date/time into a UTC ISO instant.
 *
 * The conversion uses `Intl` with the IANA zone instead of a fixed offset, so
 * daylight saving transitions are handled by the JavaScript runtime's timezone
 * database. Nonexistent local times (for example during spring-forward) fail
 * because the resolved instant does not round-trip to the requested wall time.
 */
export function pacificDateTimeToUtcIso(date: string, time: string): string {
  const target = parsePacificDateTimeParts(date, time);
  const naiveUtcMs = partsToUtcMs(target);
  const resolvedAtNaive = getPacificParts(new Date(naiveUtcMs));
  const offsetMs = partsToUtcMs(target) - partsToUtcMs(resolvedAtNaive);
  const candidate = new Date(naiveUtcMs + offsetMs);
  const roundTrip = getPacificParts(candidate);
  if (!samePacificParts(target, roundTrip)) {
    throw new Error("Expiration date/time is not a valid Pacific time.");
  }
  return candidate.toISOString();
}

export function formatPromoExpirationPacific(expiresAt: string | null): string {
  if (!expiresAt) return "No expiration";
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: PLATFORM_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.month} ${parts.day}, ${parts.year} at ${parts.hour}:${parts.minute} ${parts.dayPeriod} ${parts.timeZoneName}`;
}

/**
 * Full event-style line in Pacific Time, e.g.
 * `Sunday, April 26, 2026 at 9:00 AM PDT`
 *
 * Uses `Intl` with explicit fields so `timeZoneName` can appear (ICU does not allow
 * `timeZoneName` together with `dateStyle`/`timeStyle` in many engines).
 */
export function formatPacificTime(dateString: string): string {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PLATFORM_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

/** Calendar date only in Pacific (no time-of-day). */
export function formatPacificDateOnly(dateString: string): string {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PLATFORM_TIMEZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/** Dense tables / chat sidebar: `Apr 26` in Pacific. */
export function formatPacificMonthDay(dateString: string): string {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PLATFORM_TIMEZONE,
    month: "short",
    day: "numeric",
  }).format(d);
}

/** Chat bubbles: clock + short zone in Pacific. */
export function formatPacificClock(dateString: string): string {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PLATFORM_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

/** Timeline rows: `Apr 26, 9:00 AM PDT` style. */
export function formatPacificTimeCompact(dateString: string): string {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PLATFORM_TIMEZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}
