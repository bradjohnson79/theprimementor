import { fromZonedTime } from "date-fns-tz";

export const EXPRESS_TIME_ZONE = "America/Vancouver";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function parseHolidayList(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => DATE_KEY.test(part));
}

export function vancouverDateKey(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EXPRESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Could not read the Vancouver date");
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function weekday(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function deadlineOnDate(dateKey: string) {
  if (!DATE_KEY.test(dateKey)) throw new Error("Choose a completion date");
  const day = weekday(dateKey);
  if (day === 0 || day === 6) throw new Error("Choose a business day");
  return {
    deliveryDate: dateKey,
    deadlineAt: fromZonedTime(`${dateKey}T23:59:00`, EXPRESS_TIME_ZONE),
  };
}

/** Next Monday–Friday at 11:59 PM Pacific, after the Vancouver calendar date of paidAt. */
export function nextBusinessDayDeadline(paidAt: Date, holidays: readonly string[] = []) {
  const holidaySet = new Set(holidays);
  let cursor = addDays(vancouverDateKey(paidAt), 1);
  for (let attempt = 0; attempt < 21; attempt += 1) {
    const day = weekday(cursor);
    if (day !== 0 && day !== 6 && !holidaySet.has(cursor)) {
      return {
        deliveryDate: cursor,
        deadlineAt: fromZonedTime(`${cursor}T23:59:00`, EXPRESS_TIME_ZONE),
      };
    }
    cursor = addDays(cursor, 1);
  }
  throw new Error("No Express delivery day within three weeks");
}
