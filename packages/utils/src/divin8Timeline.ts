export const MAX_DIVIN8_TIMELINES_PER_MESSAGE = 1;

export const DIVIN8_TIMELINE_SYSTEMS = ["western", "vedic"] as const;

export type Divin8TimelineSystem = typeof DIVIN8_TIMELINE_SYSTEMS[number];

export interface Divin8TimelineRequest {
  tag: string;
  system: Divin8TimelineSystem;
  startDate: string;
  endDate: string;
}

export interface Divin8TimelineValidationResult {
  tag: string;
  startDate: string;
  endDate: string;
  startMonthIndex: number;
  endMonthIndex: number;
  year: number;
}

const TIMELINE_TAG_REGEX = /\B#[A-Z][a-z]+\d{1,2}-\d{1,2}-\d{4}\b/g;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, monthIndex: number) {
  switch (monthIndex) {
    case 1:
      return isLeapYear(year) ? 29 : 28;
    case 3:
    case 5:
    case 8:
    case 10:
      return 30;
    default:
      return 31;
  }
}

function toIsoDate(year: number, monthIndex: number, day: number) {
  return `${year.toString().padStart(4, "0")}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseIsoDateParts(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  return {
    year: Number(match[1]),
    monthIndex: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}

export function extractDivin8TimelineTags(message: string) {
  const matches = message.match(TIMELINE_TAG_REGEX) ?? [];
  return [...new Set(matches)];
}

export function isDivin8TimelineSystem(value: unknown): value is Divin8TimelineSystem {
  return typeof value === "string" && (DIVIN8_TIMELINE_SYSTEMS as readonly string[]).includes(value);
}

export function buildDivin8TimelineTag(startDate: string, endDate: string) {
  const validated = validateDivin8TimelineRange(startDate, endDate);
  const month = MONTH_NAMES[validated.startMonthIndex];
  const startDay = Number(validated.startDate.slice(-2));
  const endDay = Number(validated.endDate.slice(-2));
  return `#${month}${startDay}-${endDay}-${validated.year}`;
}

export function validateDivin8TimelineRange(startDate: string, endDate: string): Divin8TimelineValidationResult {
  const parsedStart = parseIsoDateParts(startDate);
  const parsedEnd = parseIsoDateParts(endDate);

  if (!parsedStart || !parsedEnd) {
    throw new Error("Timeline startDate and endDate must be valid YYYY-MM-DD dates.");
  }

  if (
    parsedStart.monthIndex < 0
    || parsedStart.monthIndex > 11
    || parsedEnd.monthIndex < 0
    || parsedEnd.monthIndex > 11
  ) {
    throw new Error("Timeline dates must include a valid month.");
  }

  if (parsedStart.day < 1 || parsedStart.day > daysInMonth(parsedStart.year, parsedStart.monthIndex)) {
    throw new Error("Timeline startDate is invalid.");
  }

  if (parsedEnd.day < 1 || parsedEnd.day > daysInMonth(parsedEnd.year, parsedEnd.monthIndex)) {
    throw new Error("Timeline endDate is invalid.");
  }

  if (parsedStart.year !== parsedEnd.year || parsedStart.monthIndex !== parsedEnd.monthIndex) {
    throw new Error("Timeline ranges must stay within the same month.");
  }

  if (parsedEnd.day < parsedStart.day) {
    throw new Error("Timeline endDate must be on or after the startDate.");
  }

  const normalizedStart = toIsoDate(parsedStart.year, parsedStart.monthIndex, parsedStart.day);
  const normalizedEnd = toIsoDate(parsedEnd.year, parsedEnd.monthIndex, parsedEnd.day);
  const daySpan = parsedEnd.day - parsedStart.day + 1;

  if (daySpan > 31) {
    throw new Error("Timeline range cannot exceed 31 days.");
  }

  return {
    tag: `#${MONTH_NAMES[parsedStart.monthIndex]}${parsedStart.day}-${parsedEnd.day}-${parsedStart.year}`,
    startDate: normalizedStart,
    endDate: normalizedEnd,
    startMonthIndex: parsedStart.monthIndex,
    endMonthIndex: parsedEnd.monthIndex,
    year: parsedStart.year,
  };
}

export function validateDivin8TimelineRequest(input: unknown): Divin8TimelineRequest {
  if (!input || typeof input !== "object") {
    throw new Error("timeline must be an object.");
  }

  const timeline = input as Record<string, unknown>;
  const system = timeline.system;
  if (!isDivin8TimelineSystem(system)) {
    throw new Error("Timeline system must be western or vedic.");
  }

  const startDate = typeof timeline.startDate === "string" ? timeline.startDate.trim() : "";
  const endDate = typeof timeline.endDate === "string" ? timeline.endDate.trim() : "";
  const validated = validateDivin8TimelineRange(startDate, endDate);
  const tag = typeof timeline.tag === "string" ? timeline.tag.trim() : "";

  if (tag && tag !== validated.tag) {
    throw new Error("Timeline tag does not match the selected date range.");
  }

  return {
    tag: validated.tag,
    system,
    startDate: validated.startDate,
    endDate: validated.endDate,
  };
}
