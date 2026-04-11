import { and, eq } from "drizzle-orm";
import { bookingTypes, type Database } from "@wisdom/db";
import { createHttpError } from "./errors.js";
import { toUtcIso } from "./timezoneService.js";
import type { BookingSessionType } from "./bookingConstants.js";

export interface BookingTypeSummary {
  id: string;
  name: string;
  session_type: BookingSessionType;
  duration_minutes: number;
  price_cents: number;
  currency: string;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export function serializeBookingType(row: typeof bookingTypes.$inferSelect): BookingTypeSummary {
  return {
    id: row.id,
    name: row.name,
    session_type: row.session_type,
    duration_minutes: row.duration_minutes,
    price_cents: row.price_cents,
    currency: row.currency,
    buffer_before_minutes: row.buffer_before_minutes,
    buffer_after_minutes: row.buffer_after_minutes,
    is_active: row.is_active,
    created_at: row.created_at.toISOString(),
    updated_at: toUtcIso(row.updated_at),
  };
}

export async function listActiveBookingTypes(db: Database): Promise<BookingTypeSummary[]> {
  const rows = await db
    .select()
    .from(bookingTypes)
    .where(eq(bookingTypes.is_active, true));

  return rows.map(serializeBookingType);
}

export async function getBookingTypeOrThrow(db: Database, bookingTypeId: string) {
  const [row] = await db
    .select()
    .from(bookingTypes)
    .where(and(eq(bookingTypes.id, bookingTypeId), eq(bookingTypes.is_active, true)))
    .limit(1);

  if (!row) {
    throw createHttpError(404, "Booking type not found");
  }

  return row;
}

export async function getBookingTypeForSessionTypeOrThrow(db: Database, sessionType: BookingSessionType) {
  const [row] = await db
    .select()
    .from(bookingTypes)
    .where(and(eq(bookingTypes.session_type, sessionType), eq(bookingTypes.is_active, true)))
    .limit(1);

  if (!row) {
    throw createHttpError(404, "Booking type not found for session type");
  }

  return row;
}
