import { and, eq } from "drizzle-orm";
import { bookingTypes, type Database } from "@wisdom/db";
import {
  CANONICAL_SESSION_BOOKING_TYPE_IDS,
  CANONICAL_SESSION_OFFERINGS,
  isCanonicalSessionBookingTypeId,
  isGuidedSessionBookingTypeId,
} from "@wisdom/utils";
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

export async function listActiveGuidedBookingTypes(db: Database): Promise<BookingTypeSummary[]> {
  const active = await listActiveBookingTypes(db);
  const canonicalOrder = new Map<string, number>(CANONICAL_SESSION_BOOKING_TYPE_IDS.map((id, index) => [id, index]));
  return active
    .filter((row) => isGuidedSessionBookingTypeId(row.id))
    .sort((left, right) => (canonicalOrder.get(left.id) ?? 999) - (canonicalOrder.get(right.id) ?? 999));
}

export async function listActiveIntakeBookingTypes(db: Database): Promise<BookingTypeSummary[]> {
  const active = await listActiveBookingTypes(db);
  const canonicalOrder = new Map<string, number>(CANONICAL_SESSION_BOOKING_TYPE_IDS.map((id, index) => [id, index]));
  return active
    .filter((row) => isCanonicalSessionBookingTypeId(row.id))
    .sort((left, right) => (canonicalOrder.get(left.id) ?? 999) - (canonicalOrder.get(right.id) ?? 999));
}

export function validateCanonicalBookingTypeRows(active: BookingTypeSummary[]) {
  const activeById = new Map(active.map((row) => [row.id, row]));
  const errors: string[] = [];

  for (const offering of CANONICAL_SESSION_OFFERINGS) {
    const row = activeById.get(offering.bookingTypeId);
    if (!row) {
      errors.push(`Missing active booking type ${offering.bookingTypeId}`);
      continue;
    }
    if (row.session_type !== offering.sessionType) {
      errors.push(`${offering.bookingTypeId} session_type expected ${offering.sessionType}, found ${row.session_type}`);
    }
    if (row.duration_minutes !== (offering.durationMinutes ?? 0)) {
      errors.push(
        `${offering.bookingTypeId} duration_minutes expected ${offering.durationMinutes ?? 0}, found ${row.duration_minutes}`,
      );
    }
    if (row.price_cents !== offering.amountCents) {
      errors.push(`${offering.bookingTypeId} price_cents expected ${offering.amountCents}, found ${row.price_cents}`);
    }
    if (row.currency.toUpperCase() !== offering.currency) {
      errors.push(`${offering.bookingTypeId} currency expected ${offering.currency}, found ${row.currency}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export async function validateActiveCanonicalBookingTypeCatalog(db: Database) {
  return validateCanonicalBookingTypeRows(await listActiveBookingTypes(db));
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
  if (sessionType === "qa_session" || sessionType === "mentoring") {
    throw createHttpError(400, "bookingTypeId is required for sessions with multiple duration options");
  }

  // Multiple regeneration intake products can be active; prefer the monthly package for legacy calls.
  if (sessionType === "regeneration") {
    const [monthly] = await db
      .select()
      .from(bookingTypes)
      .where(and(eq(bookingTypes.id, "regeneration-session"), eq(bookingTypes.is_active, true)))
      .limit(1);
    if (monthly) {
      return monthly;
    }
  }

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
