import { and, eq, sql } from "drizzle-orm";
import { bookings, bookingTypes, type Database } from "@wisdom/db";
import { calendarBusyProvider, type BusyRange } from "./calendarBusyProvider.js";
import { getBookingTypeOrThrow, serializeBookingType, type BookingTypeSummary } from "./bookingTypesService.js";
import {
  addHours,
  addMinutes,
  assertValidDateString,
  assertValidTimeZone,
  BOOKING_BASE_TIME_ZONE,
  BOOKING_MIN_LEAD_HOURS,
  BOOKING_SLOT_INCREMENT_MINUTES,
  formatDateInTimeZone,
  getDateStringInTimeZone,
  getUtcForLocalTime,
  getWeekdayNumber,
  minutesToTimeString,
} from "./timezoneService.js";
import { sessionTypeRequiresSchedule } from "./bookingConstants.js";

interface BlockedRange {
  startUtc: Date;
  endUtc: Date;
  source: "booking" | "calendar";
}

interface CandidateSlot {
  startUtc: Date;
  endUtc: Date;
  startBlockedUtc: Date;
  endBlockedUtc: Date;
}

export interface AvailabilitySlot {
  start_time_utc: string;
  end_time_utc: string;
  start_time_local: string;
  end_time_local: string;
  local_date: string;
  local_time_label: string;
}

export interface AvailabilityResponse {
  date: string;
  base_timezone: string;
  timezone: string;
  booking_type: BookingTypeSummary;
  slots: AvailabilitySlot[];
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

function getAvailabilityWindow(weekday: number) {
  switch (weekday) {
    case 1:
    case 2:
    case 4:
      return { openHour: 9, closeHour: 18 };
    case 3:
      return { openHour: 16, closeHour: 18 };
    default:
      return null;
  }
}

function buildCandidateSlots(
  date: string,
  durationMinutes: number,
  bufferBefore: number,
  bufferAfter: number,
  openHour: number,
  closeHour: number,
) {
  const slots: CandidateSlot[] = [];
  const openMinutes = openHour * 60;
  const closeMinutes = closeHour * 60;

  for (
    let startMinutes = openMinutes;
    startMinutes + durationMinutes <= closeMinutes;
    startMinutes += BOOKING_SLOT_INCREMENT_MINUTES
  ) {
    const startUtc = getUtcForLocalTime(date, minutesToTimeString(startMinutes), BOOKING_BASE_TIME_ZONE);
    const endUtc = addMinutes(startUtc, durationMinutes);

    slots.push({
      startUtc,
      endUtc,
      startBlockedUtc: addMinutes(startUtc, -bufferBefore),
      endBlockedUtc: addMinutes(endUtc, bufferAfter),
    });
  }

  return slots;
}

async function loadBlockedBookingRanges(db: Database, windowStartUtc: Date, windowEndUtc: Date): Promise<BlockedRange[]> {
  const rows = await db
    .select({
      startTimeUtc: bookings.start_time_utc,
      endTimeUtc: bookings.end_time_utc,
      bufferBeforeMinutes: bookingTypes.buffer_before_minutes,
      bufferAfterMinutes: bookingTypes.buffer_after_minutes,
    })
    .from(bookings)
    .innerJoin(bookingTypes, eq(bookings.booking_type_id, bookingTypes.id))
    .where(and(
      sql`${bookings.status} = 'scheduled'`,
      sql`(${bookings.start_time_utc} - make_interval(mins => ${bookingTypes.buffer_before_minutes})) < ${windowEndUtc}`,
      sql`(${bookings.end_time_utc} + make_interval(mins => ${bookingTypes.buffer_after_minutes})) > ${windowStartUtc}`,
    ));

  return rows.flatMap((row) => {
    if (!row.startTimeUtc || !row.endTimeUtc) {
      return [];
    }

    return [{
      startUtc: addMinutes(row.startTimeUtc, -row.bufferBeforeMinutes),
      endUtc: addMinutes(row.endTimeUtc, row.bufferAfterMinutes),
      source: "booking" as const,
    }];
  });
}

function toBlockedCalendarRanges(ranges: BusyRange[]): BlockedRange[] {
  return ranges.map((range) => ({
    startUtc: range.startUtc,
    endUtc: range.endUtc,
    source: "calendar" as const,
  }));
}

export async function getAvailabilityForDate(
  db: Database,
  input: { date: string; timezone: string; bookingTypeId: string; now?: Date },
): Promise<AvailabilityResponse> {
  const date = assertValidDateString(input.date);
  const timezone = assertValidTimeZone(input.timezone);
  const now = input.now ?? new Date();
  const bookingType = await getBookingTypeOrThrow(db, input.bookingTypeId);
  if (!sessionTypeRequiresSchedule(bookingType.session_type)) {
    return {
      date,
      base_timezone: BOOKING_BASE_TIME_ZONE,
      timezone,
      booking_type: serializeBookingType(bookingType),
      slots: [],
    };
  }

  const weekday = getWeekdayNumber(date, BOOKING_BASE_TIME_ZONE);
  const window = getAvailabilityWindow(weekday);
  if (!window) {
    return {
      date,
      base_timezone: BOOKING_BASE_TIME_ZONE,
      timezone,
      booking_type: serializeBookingType(bookingType),
      slots: [],
    };
  }

  const windowStartUtc = getUtcForLocalTime(date, `${window.openHour.toString().padStart(2, "0")}:00`, BOOKING_BASE_TIME_ZONE);
  const windowEndUtc = getUtcForLocalTime(date, `${window.closeHour.toString().padStart(2, "0")}:00`, BOOKING_BASE_TIME_ZONE);
  const candidateSlots = buildCandidateSlots(
    date,
    bookingType.duration_minutes,
    bookingType.buffer_before_minutes,
    bookingType.buffer_after_minutes,
    window.openHour,
    window.closeHour,
  );

  const [blockedBookings, blockedCalendarRanges] = await Promise.all([
    loadBlockedBookingRanges(db, addMinutes(windowStartUtc, -bookingType.buffer_before_minutes), addMinutes(windowEndUtc, bookingType.buffer_after_minutes)),
    calendarBusyProvider.getBusyRanges({ windowStartUtc, windowEndUtc }),
  ]);

  const blockedRanges = [...blockedBookings, ...toBlockedCalendarRanges(blockedCalendarRanges)];
  const nowPlusLead = addHours(now, BOOKING_MIN_LEAD_HOURS);
  const todayInLa = getDateStringInTimeZone(now, BOOKING_BASE_TIME_ZONE);

  const slots = candidateSlots
    .filter((slot) => {
      if (date === todayInLa) return false;
      if (slot.startUtc < nowPlusLead) return false;

      return !blockedRanges.some((range) =>
        overlaps(slot.startBlockedUtc, slot.endBlockedUtc, range.startUtc, range.endUtc),
      );
    })
    .map((slot) => ({
      start_time_utc: slot.startUtc.toISOString(),
      end_time_utc: slot.endUtc.toISOString(),
      start_time_local: formatDateInTimeZone(slot.startUtc, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX"),
      end_time_local: formatDateInTimeZone(slot.endUtc, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX"),
      local_date: formatDateInTimeZone(slot.startUtc, timezone, "yyyy-MM-dd"),
      local_time_label: `${formatDateInTimeZone(slot.startUtc, timezone, "h:mm a")} - ${formatDateInTimeZone(slot.endUtc, timezone, "h:mm a")}`,
    }));

  return {
    date,
    base_timezone: BOOKING_BASE_TIME_ZONE,
    timezone,
    booking_type: serializeBookingType(bookingType),
    slots,
  };
}
