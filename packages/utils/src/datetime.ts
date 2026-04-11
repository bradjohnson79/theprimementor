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
