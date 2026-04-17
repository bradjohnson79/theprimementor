import { and, desc, eq, sql } from "drizzle-orm";
import { bookings, bookingTypes, users, type Database } from "@wisdom/db";
import { logger } from "@wisdom/utils";
import { getBookingTypeForSessionTypeOrThrow, getBookingTypeOrThrow } from "./bookingTypesService.js";
import { createHttpError } from "./errors.js";
import {
  sendAdminNewBookingNotification,
  sendBookingCancelledNotification,
  sendBookingConfirmedNotification,
  sendBookingCreatedNotification,
} from "./notificationService.js";
import {
  createPaymentRecordForBooking,
  createPaymentRecordForEntity,
  getReusablePaymentForEntity,
  getReusablePaymentForBooking,
} from "../payments/paymentsService.js";
import {
  addMinutes,
  assertValidTimeZone,
  getDateStringInTimeZone,
  getUtcForLocalTime,
  getWeekdayNumber,
  toUtcIso,
} from "./timezoneService.js";
import {
  BOOKING_AVAILABILITY_DAYS,
  BOOKING_AVAILABILITY_SLOTS,
  FOCUS_TOPICS,
  MENTORING_GOALS,
  createEmptyBookingAvailability,
  type BookingHealthFocusArea,
  isBookingSessionType,
  type BookingAvailability,
  type BookingAvailabilityDay,
  sessionTypeRequiresSchedule,
  type BookingIntakePayload,
  type BookingSessionType,
  type BookingStatus,
} from "./bookingConstants.js";
import { normalizeStructuredBirthplace } from "../intake/placeSelection.js";
import {
  MENTORING_CIRCLE_BOOKING_TYPE_ID,
  getMentoringCircleEventOrThrow,
} from "../mentoringCircleService.js";

interface BookingRow {
  id: string;
  userId: string;
  archived: boolean;
  userEmail?: string;
  userRole?: string;
  bookingTypeId: string;
  bookingTypeName: string;
  sessionType: BookingSessionType;
  eventKey?: string | null;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  startTimeUtc: Date | null;
  endTimeUtc: Date | null;
  timezone: string;
  status: BookingStatus;
  availability: unknown;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  birthTime: string;
  birthPlace: string | null;
  birthPlaceName: string | null;
  birthLat: number | null;
  birthLng: number | null;
  birthTimezone: string | null;
  consentGiven: boolean;
  intake: unknown;
  intakeSnapshot: unknown;
  joinUrl: string | null;
  startUrl: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface BookingSummary {
  id: string;
  user_id: string;
  archived: boolean;
  session_type: BookingSessionType;
  event_key?: string | null;
  start_time_utc: string | null;
  end_time_utc: string | null;
  timezone: string;
  status: BookingStatus;
  availability: BookingAvailability | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  birth_time: string;
  birth_place: string | null;
  birth_place_name: string | null;
  birth_lat: number | null;
  birth_lng: number | null;
  birth_timezone: string | null;
  consent_given: boolean;
  intake: BookingIntakePayload | null;
  intake_snapshot: Record<string, unknown> | null;
  join_url: string | null;
  start_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  can_cancel: boolean;
  booking_type: {
    id: string;
    name: string;
    session_type: BookingSessionType;
    duration_minutes: number;
    price_cents: number;
    currency: string;
    buffer_before_minutes: number;
    buffer_after_minutes: number;
  };
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export interface CreateBookingInput {
  actorUserId: string;
  actorRole: string;
  bookingTypeId?: string;
  sessionType?: string;
  availability?: unknown;
  timezone?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  birthPlaceName?: string;
  birthLat?: number;
  birthLng?: number;
  birthTimezone?: string;
  timezoneSource?: "user" | "suggested" | "fallback";
  consentGiven?: boolean;
  intake?: unknown;
  notes?: string;
  userId?: string;
  now?: Date;
}

export interface ConfirmBookingAvailabilityInput {
  bookingId: string;
  actorUserId: string;
  actorRole: string;
  availabilityDay: string;
  availabilityTime: string;
  now?: Date;
}

interface BookingIntakeSnapshot {
  bookingTypeId: string;
  sessionType: BookingSessionType;
  timezone: string;
  availability: BookingAvailability | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  birthTime: string;
  birthPlace: string | null;
  birthPlaceName: string;
  birthLat: number;
  birthLng: number;
  birthTimezone: string | null;
  timezoneSource: "user" | "suggested" | "fallback";
  consentGiven: boolean;
  intake: BookingIntakePayload;
  notes: string | null;
}

function serializeBooking(row: BookingRow, now: Date): BookingSummary {
  const intake = parseStoredIntake(row.intake);
  const intakeSnapshot = parseObject(row.intakeSnapshot);
  const canCancel = row.status !== "cancelled"
    && row.status !== "completed"
    && (row.startTimeUtc ? row.startTimeUtc > now : true);

  return {
    id: row.id,
    user_id: row.userId,
    archived: row.archived,
    session_type: row.sessionType,
    event_key: row.eventKey ?? null,
    start_time_utc: toUtcIso(row.startTimeUtc),
    end_time_utc: toUtcIso(row.endTimeUtc),
    timezone: row.timezone,
    status: row.status,
    availability: parseStoredAvailability(row.availability),
    full_name: row.fullName,
    email: row.email,
    phone: row.phone,
    birth_date: row.birthDate,
    birth_time: row.birthTime,
    birth_place: row.birthPlace,
    birth_place_name: row.birthPlaceName,
    birth_lat: row.birthLat,
    birth_lng: row.birthLng,
    birth_timezone: row.birthTimezone,
    consent_given: row.consentGiven,
    intake,
    intake_snapshot: intakeSnapshot,
    join_url: row.joinUrl,
    start_url: row.startUrl,
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
    updated_at: toUtcIso(row.updatedAt),
    can_cancel: canCancel,
    booking_type: {
      id: row.bookingTypeId,
      name: row.bookingTypeName,
      session_type: row.sessionType,
      duration_minutes: row.durationMinutes,
      price_cents: row.priceCents,
      currency: row.currency,
      buffer_before_minutes: row.bufferBeforeMinutes,
      buffer_after_minutes: row.bufferAfterMinutes,
    },
    user: row.userEmail && row.userRole
      ? {
          id: row.userId,
          email: row.userEmail,
          role: row.userRole,
        }
      : undefined,
  };
}

async function getBookingSummaryById(db: Database, bookingId: string): Promise<BookingRow | null> {
  const [row] = await db
    .select({
      id: bookings.id,
      userId: bookings.user_id,
      archived: bookings.archived,
      userEmail: users.email,
      userRole: users.role,
      bookingTypeId: bookingTypes.id,
      bookingTypeName: bookingTypes.name,
      sessionType: bookings.session_type,
      eventKey: bookings.event_key,
      durationMinutes: bookingTypes.duration_minutes,
      priceCents: bookingTypes.price_cents,
      currency: bookingTypes.currency,
      bufferBeforeMinutes: bookingTypes.buffer_before_minutes,
      bufferAfterMinutes: bookingTypes.buffer_after_minutes,
      startTimeUtc: bookings.start_time_utc,
      endTimeUtc: bookings.end_time_utc,
      timezone: bookings.timezone,
      status: bookings.status,
      availability: bookings.availability,
      fullName: bookings.full_name,
      email: bookings.email,
      phone: bookings.phone,
      birthDate: bookings.birth_date,
      birthTime: bookings.birth_time,
      birthPlace: bookings.birth_place,
      birthPlaceName: bookings.birth_place_name,
      birthLat: bookings.birth_lat,
      birthLng: bookings.birth_lng,
      birthTimezone: bookings.birth_timezone,
      consentGiven: bookings.consent_given,
      intake: bookings.intake,
      intakeSnapshot: bookings.intake_snapshot,
      joinUrl: bookings.join_url,
      startUrl: bookings.start_url,
      notes: bookings.notes,
      createdAt: bookings.created_at,
      updatedAt: bookings.updated_at,
    })
    .from(bookings)
    .innerJoin(bookingTypes, eq(bookings.booking_type_id, bookingTypes.id))
    .innerJoin(users, eq(bookings.user_id, users.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  return row ?? null;
}

function normalizeNotes(notes?: string): string | null {
  if (typeof notes !== "string") return null;
  const trimmed = notes.trim();
  return trimmed ? trimmed : null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const email = normalized.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createHttpError(400, "A valid email address is required");
  }
  return email;
}

function normalizeBirthDate(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw createHttpError(400, "birthDate must use YYYY-MM-DD");
  }
  return normalized;
}

function normalizeBirthTime(value: unknown): string {
  const normalized = normalizeText(value);
  if (!normalized) return "00:00";
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(normalized)) {
    throw createHttpError(400, "birthTime must use HH:MM");
  }
  return normalized.slice(0, 5);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => Boolean(item));
}

export function normalizeHealthFocusAreas(
  value: unknown,
  options: { requireAtLeastOne: boolean },
): BookingHealthFocusArea[] {
  if (value == null) {
    if (options.requireAtLeastOne) {
      throw createHttpError(400, "Please enter at least one health focus area.");
    }
    return [];
  }
  if (!Array.isArray(value)) {
    throw createHttpError(400, "healthFocusAreas must be an array");
  }

  const normalized = value
    .slice(0, 5)
    .flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return [];
      }
      const row = item as Record<string, unknown>;
      const name = normalizeText(row.name);
      if (!name) {
        return [];
      }
      const severity = typeof row.severity === "number" ? row.severity : Number(row.severity);
      if (!Number.isInteger(severity) || severity < 1 || severity > 10) {
        throw createHttpError(400, "Health focus severity must be between 1 and 10.");
      }
      return [{ name, severity }];
    });

  if (options.requireAtLeastOne && normalized.length === 0) {
    throw createHttpError(400, "Please enter at least one health focus area.");
  }

  return normalized;
}

function normalizeBookingAvailability(
  value: unknown,
  options: { requireSelection: boolean },
): BookingAvailability | null {
  if (value == null) {
    if (options.requireSelection) {
      throw createHttpError(400, "availability is required for this session type");
    }
    return null;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw createHttpError(400, "availability must be an object grouped by weekday");
  }

  const raw = value as Record<string, unknown>;
  const normalized = createEmptyBookingAvailability();

  for (const day of BOOKING_AVAILABILITY_DAYS) {
    const dayValue = raw[day];
    if (dayValue == null) {
      continue;
    }
    if (!Array.isArray(dayValue)) {
      throw createHttpError(400, `${day} availability must be an array`);
    }

    const allowed = new Set(BOOKING_AVAILABILITY_SLOTS[day]);
    const selected = Array.from(
      new Set(
        dayValue.map((item) => {
          if (typeof item !== "string") {
            throw createHttpError(400, `${day} availability entries must be time strings`);
          }
          const time = item.trim();
          if (!allowed.has(time)) {
            throw createHttpError(400, `${time} is not an allowed ${day} availability slot`);
          }
          return time;
        }),
      ),
    );

    normalized[day] = BOOKING_AVAILABILITY_SLOTS[day].filter((slot) => selected.includes(slot));
  }

  const totalSelected = BOOKING_AVAILABILITY_DAYS.reduce((sum, day) => sum + normalized[day].length, 0);
  if (options.requireSelection && totalSelected === 0) {
    throw createHttpError(400, "Select at least one availability slot");
  }

  return normalized;
}

function parseStoredIntake(value: unknown): BookingIntakePayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const type = typeof raw.type === "string" && isBookingSessionType(raw.type) ? raw.type : null;
  if (!type) return null;

  const intake: BookingIntakePayload = { type };
  const topics = normalizeStringArray(raw.topics);
  const goals = normalizeStringArray(raw.goals);
  const other = normalizeText(raw.other);
  const notes = normalizeText(raw.notes);
  const healthFocusAreas = normalizeHealthFocusAreas(raw.healthFocusAreas, { requireAtLeastOne: false });

  if (topics.length > 0) intake.topics = topics;
  if (goals.length > 0) intake.goals = goals;
  if (healthFocusAreas.length > 0) intake.healthFocusAreas = healthFocusAreas;
  if (other) intake.other = other;
  if (notes) intake.notes = notes;

  return intake;
}

function parseStoredAvailability(value: unknown): BookingAvailability | null {
  try {
    return normalizeBookingAvailability(value, { requireSelection: false });
  } catch {
    return null;
  }
}

function parseObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function resolveAvailabilityWeekdayNumber(day: BookingAvailabilityDay) {
  switch (day) {
    case "monday":
      return 1;
    case "tuesday":
      return 2;
    case "wednesday":
      return 3;
    case "thursday":
      return 4;
  }
}

function resolveNextAvailabilityStartUtc(
  day: BookingAvailabilityDay,
  time: string,
  timezone: string,
  now: Date,
) {
  const targetWeekday = resolveAvailabilityWeekdayNumber(day);

  for (let offset = 0; offset < 21; offset += 1) {
    const candidateBase = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const candidateDate = getDateStringInTimeZone(candidateBase, timezone);
    if (getWeekdayNumber(candidateDate, timezone) !== targetWeekday) {
      continue;
    }

    const candidateStartUtc = getUtcForLocalTime(candidateDate, time, timezone);
    if (candidateStartUtc.getTime() <= now.getTime()) {
      continue;
    }

    return candidateStartUtc;
  }

  throw createHttpError(400, `Could not resolve a future ${day} ${time} slot in ${timezone}`);
}

async function getTargetUserOrThrow(db: Database, userId: string) {
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw createHttpError(404, "User not found");
  }
  return user;
}

function getFallbackNameFromEmail(email: string | null) {
  if (!email) return null;
  const localPart = email.split("@")[0]?.trim();
  return localPart || null;
}

function normalizeSharedFields(
  input: CreateBookingInput,
  fallbackEmail: string | null,
  allowAdminFallbacks: boolean,
) {
  const email = normalizeEmail(input.email ?? fallbackEmail ?? undefined);
  const fullName = normalizeText(input.fullName) ?? (allowAdminFallbacks ? getFallbackNameFromEmail(email) : null);
  const phone = normalizeText(input.phone);
  const birthDate = normalizeBirthDate(input.birthDate);
  const birthTime = normalizeBirthTime(input.birthTime);
  const birthplace = normalizeStructuredBirthplace({
    birthPlaceName: input.birthPlaceName ?? input.birthPlace,
    birthLat: input.birthLat,
    birthLng: input.birthLng,
    birthTimezone: input.birthTimezone ?? input.timezone,
  });
  const consentGiven = input.consentGiven === true;
  const timezoneSource = input.timezoneSource === "suggested" || input.timezoneSource === "fallback"
    ? input.timezoneSource
    : "user";

  if (!allowAdminFallbacks) {
    if (!fullName) {
      throw createHttpError(400, "fullName is required");
    }
    if (!email) {
      throw createHttpError(400, "email is required");
    }
    if (!phone) {
      throw createHttpError(400, "phone is required");
    }
    if (!birthDate) {
      throw createHttpError(400, "birthDate is required");
    }
    if (!consentGiven) {
      throw createHttpError(400, "consentGiven must be true");
    }
  }

  return {
    fullName,
    email,
    phone,
    birthDate,
    birthTime,
    birthPlace: birthplace.name,
    birthplace,
    timezoneSource: timezoneSource as "user" | "suggested" | "fallback",
    consentGiven,
  };
}

function buildNormalizedIntake(
  sessionType: BookingSessionType,
  rawIntake: unknown,
  legacyNotes: string | undefined,
  allowAdminFallbacks: boolean,
) {
  const intake = parseStoredIntake(rawIntake) ?? { type: sessionType };
  if (intake.type !== sessionType) {
    throw createHttpError(400, "intake.type must match sessionType");
  }

  const notes = intake.notes ?? normalizeNotes(legacyNotes) ?? undefined;
  const other = normalizeText(intake.other);
  const normalized: BookingIntakePayload = { type: sessionType };
  if (notes) normalized.notes = notes;

  if (sessionType === "focus") {
    const allowed = new Set<string>(FOCUS_TOPICS);
    const topics = (intake.topics ?? []).filter((topic) => allowed.has(topic));
    if (!allowAdminFallbacks && topics.length === 0) {
      throw createHttpError(400, "At least one focus topic is required");
    }
    if (topics.length > 1) {
      throw createHttpError(400, "Only one focus topic may be selected");
    }
    if (topics.length > 0) normalized.topics = topics.slice(0, 1);
    if (topics.includes("Other")) {
      if (!other) {
        throw createHttpError(400, "other is required when focus topics include Other");
      }
      normalized.other = other;
    }
  }

  if (sessionType === "mentoring") {
    const allowed = new Set<string>(MENTORING_GOALS);
    const goals = (intake.goals ?? []).filter((goal) => allowed.has(goal));
    if (!allowAdminFallbacks && goals.length === 0) {
      throw createHttpError(400, "At least one mentoring topic is required");
    }
    if (goals.length > 3) {
      throw createHttpError(400, "A maximum of three mentoring topics may be selected");
    }
    if (goals.length > 0) normalized.goals = goals.slice(0, 3);
    if (goals.includes("Other")) {
      if (!other) {
        throw createHttpError(400, "other is required when mentoring topics include Other");
      }
      normalized.other = other;
    }
  }

  if (sessionType === "regeneration" && other) {
    normalized.other = other;
  }

  if (sessionType === "regeneration") {
    const healthFocusAreas = normalizeHealthFocusAreas(intake.healthFocusAreas, {
      requireAtLeastOne: !allowAdminFallbacks,
    });
    if (healthFocusAreas.length > 0) {
      normalized.healthFocusAreas = healthFocusAreas;
    }
  }

  return {
    intake: normalized,
    notes: notes ?? null,
  };
}

function buildBookingIntakeSnapshot(input: {
  bookingTypeId: string;
  sessionType: BookingSessionType;
  timezone: string;
  availability: BookingAvailability | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  birthTime: string;
  birthPlace: string | null;
  birthPlaceName: string;
  birthLat: number;
  birthLng: number;
  birthTimezone: string | null;
  timezoneSource: "user" | "suggested" | "fallback";
  consentGiven: boolean;
  intake: BookingIntakePayload;
  notes: string | null;
}): BookingIntakeSnapshot {
  return {
    bookingTypeId: input.bookingTypeId,
    sessionType: input.sessionType,
    timezone: input.timezone,
    availability: input.availability,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    birthDate: input.birthDate,
    birthTime: input.birthTime,
    birthPlace: input.birthPlace,
    birthPlaceName: input.birthPlaceName,
    birthLat: input.birthLat,
    birthLng: input.birthLng,
    birthTimezone: input.birthTimezone,
    timezoneSource: input.timezoneSource,
    consentGiven: input.consentGiven,
    intake: input.intake,
    notes: input.notes,
  };
}

async function findReusablePendingPaymentBooking(
  db: Database,
  input: {
    userId: string;
    bookingTypeId: string;
    sessionType: BookingSessionType;
    intakeSnapshot: BookingIntakeSnapshot;
  },
) {
  const snapshotJson = JSON.stringify(input.intakeSnapshot);
  const [row] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(
      eq(bookings.user_id, input.userId),
      eq(bookings.booking_type_id, input.bookingTypeId),
      eq(bookings.session_type, input.sessionType),
      eq(bookings.status, "pending_payment"),
      sql`${bookings.intake_snapshot} = ${snapshotJson}::jsonb`,
    ))
    .orderBy(desc(bookings.created_at))
    .limit(1);

  return row?.id ?? null;
}

async function resolveBookingTypeAndSessionType(db: Database, input: CreateBookingInput) {
  if (input.bookingTypeId) {
    const bookingType = await getBookingTypeOrThrow(db, input.bookingTypeId);
    if (input.sessionType) {
      if (!isBookingSessionType(input.sessionType)) {
        throw createHttpError(400, "Invalid sessionType");
      }
      if (bookingType.session_type !== input.sessionType) {
        throw createHttpError(400, "bookingTypeId does not match sessionType");
      }
    }
    return { bookingType, sessionType: bookingType.session_type };
  }

  if (!input.sessionType || !isBookingSessionType(input.sessionType)) {
    throw createHttpError(400, "sessionType is required");
  }

  const bookingType = await getBookingTypeForSessionTypeOrThrow(db, input.sessionType);
  return { bookingType, sessionType: bookingType.session_type };
}

async function getMentoringCircleBookingRow(
  db: Database,
  input: { userId: string; eventKey: string },
) {
  const [row] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
    })
    .from(bookings)
    .where(and(
      eq(bookings.user_id, input.userId),
      eq(bookings.booking_type_id, MENTORING_CIRCLE_BOOKING_TYPE_ID),
      eq(bookings.session_type, "mentoring_circle"),
      eq(bookings.event_key, input.eventKey),
    ))
    .orderBy(desc(bookings.created_at))
    .limit(1);

  return row ?? null;
}

export async function createOrReuseMentoringCircleBooking(
  db: Database,
  input: { userId: string; eventId?: string | null; now?: Date },
): Promise<BookingSummary> {
  const now = input.now ?? new Date();
  const event = getMentoringCircleEventOrThrow(input.eventId);
  const existing = await getMentoringCircleBookingRow(db, {
    userId: input.userId,
    eventKey: event.eventKey,
  });

  if (existing) {
    if (existing.status === "cancelled") {
      throw createHttpError(400, "Cancelled Mentoring Circle purchases require manual support before repurchase.");
    }

    const reusablePayment = await getReusablePaymentForEntity(db, {
      entityType: "mentoring_circle",
      entityId: existing.id,
    });
    if (!reusablePayment && existing.status === "pending_payment") {
      await createPaymentRecordForEntity(db, {
        userId: input.userId,
        entityType: "mentoring_circle",
        entityId: existing.id,
        bookingId: existing.id,
        amountCents: event.priceCents,
        currency: event.currency,
        status: "pending",
        metadata: {
          source: "mentoring_circle_reuse",
          eventId: event.eventId,
          eventKey: event.eventKey,
          bookingTypeId: MENTORING_CIRCLE_BOOKING_TYPE_ID,
        },
      });
    }

    const existingSummary = await getBookingSummaryById(db, existing.id);
    if (!existingSummary) {
      throw createHttpError(500, "Mentoring Circle booking could not be loaded");
    }

    return serializeBooking(existingSummary, now);
  }

  const eventStartUtc = new Date(event.eventStartAt);
  const eventEndUtc = addMinutes(eventStartUtc, event.durationMinutes);
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!user) {
    throw createHttpError(404, "User not found");
  }

  const inserted = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(bookings)
      .values({
        user_id: input.userId,
        booking_type_id: MENTORING_CIRCLE_BOOKING_TYPE_ID,
        session_type: "mentoring_circle",
        event_key: event.eventKey,
        start_time_utc: eventStartUtc,
        end_time_utc: eventEndUtc,
        timezone: event.timezone,
        status: "pending_payment",
        availability: null,
        full_name: null,
        email: user.email,
        phone: null,
        birth_date: null,
        birth_time: "00:00",
        birth_place: null,
        birth_place_name: null,
        birth_lat: null,
        birth_lng: null,
        birth_timezone: event.timezone,
        consent_given: true,
        intake: {
          type: "mentoring_circle",
          eventId: event.eventId,
          eventKey: event.eventKey,
          eventTitle: event.eventTitle,
        },
        intake_snapshot: {
          eventId: event.eventId,
          eventKey: event.eventKey,
          eventTitle: event.eventTitle,
          eventStartAt: event.eventStartAt,
        },
        join_url: null,
        notes: null,
      })
      .returning({ id: bookings.id });

    await createPaymentRecordForEntity(tx, {
      userId: input.userId,
      entityType: "mentoring_circle",
      entityId: created.id,
      bookingId: created.id,
      amountCents: event.priceCents,
      currency: event.currency,
      status: "pending",
      metadata: {
        source: "mentoring_circle_create",
        eventId: event.eventId,
        eventKey: event.eventKey,
        bookingTypeId: MENTORING_CIRCLE_BOOKING_TYPE_ID,
      },
    });

    return created;
  });

  const summary = await getBookingSummaryById(db, inserted.id);
  if (!summary) {
    throw createHttpError(500, "Mentoring Circle booking created but could not be loaded");
  }

  return serializeBooking(summary, now);
}

export async function confirmMentoringCircleBooking(
  db: Database,
  input: { bookingId: string; eventId?: string | null; now?: Date },
): Promise<BookingSummary> {
  const now = input.now ?? new Date();
  const event = getMentoringCircleEventOrThrow(input.eventId);
  const booking = await getBookingSummaryById(db, input.bookingId);
  if (!booking) {
    throw createHttpError(404, "Booking not found");
  }

  if (booking.sessionType !== "mentoring_circle" || booking.eventKey !== event.eventKey) {
    throw createHttpError(400, "Booking is not a Mentoring Circle purchase");
  }

  if (!["paid", "scheduled", "completed"].includes(booking.status)) {
    throw createHttpError(400, "Booking payment must be settled before access is confirmed");
  }

  await db
    .update(bookings)
    .set({
      start_time_utc: new Date(event.eventStartAt),
      end_time_utc: addMinutes(new Date(event.eventStartAt), event.durationMinutes),
      timezone: event.timezone,
      status: "scheduled",
      join_url: event.zoomLink,
      updated_at: new Date(),
    })
    .where(eq(bookings.id, booking.id));

  const summary = await getBookingSummaryById(db, booking.id);
  if (!summary) {
    throw createHttpError(500, "Booking confirmed but could not be loaded");
  }

  return serializeBooking(summary, now);
}

export async function createBooking(db: Database, input: CreateBookingInput): Promise<BookingSummary> {
  const now = input.now ?? new Date();
  const bookingUserId = input.actorRole === "admin" && input.userId ? input.userId : input.actorUserId;
  const allowAdminFallbacks = input.actorRole === "admin";

  if (input.userId && input.actorRole !== "admin" && input.userId !== input.actorUserId) {
    throw createHttpError(403, "You cannot create bookings for another user");
  }

  const targetUser = await getTargetUserOrThrow(db, bookingUserId);
  const { bookingType, sessionType } = await resolveBookingTypeAndSessionType(db, input);
  const timezone = assertValidTimeZone(input.timezone ?? "");
  const sharedFields = normalizeSharedFields(input, targetUser.email, allowAdminFallbacks);
  const { intake, notes } = buildNormalizedIntake(sessionType, input.intake, input.notes, allowAdminFallbacks);
  const normalizedAvailability = normalizeBookingAvailability(input.availability, {
    requireSelection: sessionTypeRequiresSchedule(sessionType),
  });
  const intakeSnapshot = buildBookingIntakeSnapshot({
    bookingTypeId: bookingType.id,
    sessionType,
    timezone,
    availability: normalizedAvailability,
    fullName: sharedFields.fullName,
    email: sharedFields.email,
    phone: sharedFields.phone,
    birthDate: sharedFields.birthDate,
    birthTime: sharedFields.birthTime,
    birthPlace: sharedFields.birthPlace,
    birthPlaceName: sharedFields.birthplace.name,
    birthLat: sharedFields.birthplace.lat,
    birthLng: sharedFields.birthplace.lng,
    birthTimezone: timezone,
    timezoneSource: sharedFields.timezoneSource,
    consentGiven: sharedFields.consentGiven,
    intake,
    notes,
  });

  const reusableBookingId = await findReusablePendingPaymentBooking(db, {
    userId: bookingUserId,
    bookingTypeId: bookingType.id,
    sessionType,
    intakeSnapshot,
  });

  if (reusableBookingId) {
    const existingPayment = await getReusablePaymentForBooking(db, reusableBookingId);
    if (!existingPayment) {
      await createPaymentRecordForBooking(db, {
        userId: bookingUserId,
        bookingId: reusableBookingId,
        amountCents: bookingType.price_cents,
        currency: bookingType.currency,
        status: "pending",
        metadata: {
          source: "booking_reuse",
          bookingTypeId: bookingType.id,
        },
      });
    }

    const existingSummary = await getBookingSummaryById(db, reusableBookingId);
    if (!existingSummary) {
      throw createHttpError(500, "Reusable booking could not be loaded");
    }

    return serializeBooking(existingSummary, now);
  }

  const inserted = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(bookings)
      .values({
        user_id: bookingUserId,
        booking_type_id: bookingType.id,
        session_type: sessionType,
        start_time_utc: null,
        end_time_utc: null,
        timezone,
        status: "pending_payment",
        availability: normalizedAvailability,
        full_name: sharedFields.fullName,
        email: sharedFields.email,
        phone: sharedFields.phone,
        birth_date: sharedFields.birthDate,
        birth_time: sharedFields.birthTime,
        birth_place: sharedFields.birthPlace,
        birth_place_name: sharedFields.birthplace.name,
        birth_lat: sharedFields.birthplace.lat,
        birth_lng: sharedFields.birthplace.lng,
        birth_timezone: timezone,
        consent_given: sharedFields.consentGiven,
        intake,
        intake_snapshot: intakeSnapshot,
        notes,
      })
      .returning({ id: bookings.id });

    await createPaymentRecordForBooking(tx, {
      userId: bookingUserId,
      bookingId: created.id,
      amountCents: bookingType.price_cents,
      currency: bookingType.currency,
      status: "pending",
      metadata: {
        source: "booking_create",
        bookingTypeId: bookingType.id,
      },
    });

    return created;
  });

  const summary = await getBookingSummaryById(db, inserted.id);
  if (!summary) {
    throw createHttpError(500, "Booking created but could not be loaded");
  }

  void sendBookingCreatedNotification(db, {
    bookingId: summary.id,
    userId: summary.userId,
    bookingType: summary.bookingTypeName,
    timezone: summary.timezone,
    fullName: summary.fullName,
    email: summary.email ?? summary.userEmail ?? null,
    availability: parseStoredAvailability(summary.availability),
  }).catch((error) => {
    logger.error("booking_created_notification_failed", {
      bookingId: summary.id,
      error: error instanceof Error ? error.message : error,
    });
  });

  void sendAdminNewBookingNotification(db, {
    bookingId: summary.id,
    userId: summary.userId,
    bookingType: summary.bookingTypeName,
    timezone: summary.timezone,
    fullName: summary.fullName,
    email: summary.email ?? summary.userEmail ?? null,
    availability: parseStoredAvailability(summary.availability),
  }).catch(() => {
    logger.error("admin_booking_notification_failed", {
      bookingId: summary.id,
    });
  });

  return serializeBooking(summary, now);
}

export async function confirmBookingAvailability(
  db: Database,
  input: ConfirmBookingAvailabilityInput,
): Promise<BookingSummary> {
  if (input.actorRole !== "admin") {
    throw createHttpError(403, "Admin access required");
  }

  const now = input.now ?? new Date();
  const booking = await getBookingSummaryById(db, input.bookingId);
  if (!booking) {
    throw createHttpError(404, "Booking not found");
  }

  if (!sessionTypeRequiresSchedule(booking.sessionType)) {
    throw createHttpError(400, "This booking does not use availability scheduling");
  }

  if (booking.status === "cancelled" || booking.status === "completed") {
    throw createHttpError(400, `Cannot confirm a ${booking.status} booking`);
  }

  if (booking.status === "pending_payment") {
    throw createHttpError(400, "Booking payment must be completed before scheduling");
  }

  if (booking.status === "scheduled") {
    throw createHttpError(400, "Booking is already scheduled");
  }

  const availability = parseStoredAvailability(booking.availability);
  if (!availability) {
    throw createHttpError(400, "Booking does not contain confirmable availability");
  }

  const availabilityDay = input.availabilityDay.trim().toLowerCase() as BookingAvailabilityDay;
  if (!BOOKING_AVAILABILITY_DAYS.includes(availabilityDay)) {
    throw createHttpError(400, "availabilityDay must be monday, tuesday, wednesday, or thursday");
  }

  const availabilityTime = input.availabilityTime.trim();
  if (!availability[availabilityDay].includes(availabilityTime)) {
    throw createHttpError(400, "Admin can only confirm a time submitted in client availability");
  }

  const scheduledStartUtc = resolveNextAvailabilityStartUtc(availabilityDay, availabilityTime, booking.timezone, now);
  const scheduledEndUtc = addMinutes(scheduledStartUtc, booking.durationMinutes);

  await db.transaction(async (tx) => {
    const overlapping = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .innerJoin(bookingTypes, eq(bookings.booking_type_id, bookingTypes.id))
      .where(and(
        sql`${bookings.status} = 'scheduled'`,
        sql`${bookings.id} <> ${booking.id}`,
        sql`(${bookings.start_time_utc} - make_interval(mins => ${bookingTypes.buffer_before_minutes})) < ${addMinutes(scheduledEndUtc, booking.bufferAfterMinutes)}`,
        sql`(${bookings.end_time_utc} + make_interval(mins => ${bookingTypes.buffer_after_minutes})) > ${addMinutes(scheduledStartUtc, -booking.bufferBeforeMinutes)}`,
      ))
      .limit(1);

    if (overlapping.length > 0) {
      throw createHttpError(409, "That availability slot conflicts with another scheduled booking");
    }

    await tx
      .update(bookings)
      .set({
        start_time_utc: scheduledStartUtc,
        end_time_utc: scheduledEndUtc,
        status: "scheduled",
        updated_at: new Date(),
      })
      .where(eq(bookings.id, booking.id));
  });

  const summary = await getBookingSummaryById(db, booking.id);
  if (!summary) {
    throw createHttpError(500, "Booking scheduled but could not be loaded");
  }

  if (summary.startTimeUtc && summary.endTimeUtc) {
    void sendBookingConfirmedNotification(db, {
      bookingId: summary.id,
      userId: summary.userId,
      bookingType: summary.bookingTypeName,
      timezone: summary.timezone,
      startTimeUtc: summary.startTimeUtc.toISOString(),
      endTimeUtc: summary.endTimeUtc.toISOString(),
    }).catch((error) => {
      logger.error("booking_confirmed_notification_failed", {
        bookingId: summary.id,
        error: error instanceof Error ? error.message : error,
      });
    });
  }

  return serializeBooking(summary, now);
}

export async function listBookingsForUser(db: Database, userId: string, now = new Date()): Promise<BookingSummary[]> {
  const rows = await db
    .select({
      id: bookings.id,
      userId: bookings.user_id,
      archived: bookings.archived,
      bookingTypeId: bookingTypes.id,
      bookingTypeName: bookingTypes.name,
      sessionType: bookings.session_type,
      eventKey: bookings.event_key,
      durationMinutes: bookingTypes.duration_minutes,
      priceCents: bookingTypes.price_cents,
      currency: bookingTypes.currency,
      bufferBeforeMinutes: bookingTypes.buffer_before_minutes,
      bufferAfterMinutes: bookingTypes.buffer_after_minutes,
      startTimeUtc: bookings.start_time_utc,
      endTimeUtc: bookings.end_time_utc,
      timezone: bookings.timezone,
      status: bookings.status,
      availability: bookings.availability,
      fullName: bookings.full_name,
      email: bookings.email,
      phone: bookings.phone,
      birthDate: bookings.birth_date,
      birthTime: bookings.birth_time,
      birthPlace: bookings.birth_place,
      birthPlaceName: bookings.birth_place_name,
      birthLat: bookings.birth_lat,
      birthLng: bookings.birth_lng,
      birthTimezone: bookings.birth_timezone,
      consentGiven: bookings.consent_given,
      intake: bookings.intake,
      intakeSnapshot: bookings.intake_snapshot,
      joinUrl: bookings.join_url,
      startUrl: bookings.start_url,
      notes: bookings.notes,
      createdAt: bookings.created_at,
      updatedAt: bookings.updated_at,
    })
    .from(bookings)
    .innerJoin(bookingTypes, eq(bookings.booking_type_id, bookingTypes.id))
    .where(eq(bookings.user_id, userId))
    .orderBy(sql`coalesce(${bookings.start_time_utc}, ${bookings.created_at}) desc`);

  return rows.map((row) => serializeBooking(row, now));
}

export async function listBookingsForAdmin(
  db: Database,
  now = new Date(),
  options: { showArchived?: boolean } = {},
): Promise<BookingSummary[]> {
  const showArchived = options.showArchived === true;
  const rows = await db
    .select({
      id: bookings.id,
      userId: bookings.user_id,
      archived: bookings.archived,
      userEmail: users.email,
      userRole: users.role,
      bookingTypeId: bookingTypes.id,
      bookingTypeName: bookingTypes.name,
      sessionType: bookings.session_type,
      eventKey: bookings.event_key,
      durationMinutes: bookingTypes.duration_minutes,
      priceCents: bookingTypes.price_cents,
      currency: bookingTypes.currency,
      bufferBeforeMinutes: bookingTypes.buffer_before_minutes,
      bufferAfterMinutes: bookingTypes.buffer_after_minutes,
      startTimeUtc: bookings.start_time_utc,
      endTimeUtc: bookings.end_time_utc,
      timezone: bookings.timezone,
      status: bookings.status,
      availability: bookings.availability,
      fullName: bookings.full_name,
      email: bookings.email,
      phone: bookings.phone,
      birthDate: bookings.birth_date,
      birthTime: bookings.birth_time,
      birthPlace: bookings.birth_place,
      birthPlaceName: bookings.birth_place_name,
      birthLat: bookings.birth_lat,
      birthLng: bookings.birth_lng,
      birthTimezone: bookings.birth_timezone,
      consentGiven: bookings.consent_given,
      intake: bookings.intake,
      intakeSnapshot: bookings.intake_snapshot,
      joinUrl: bookings.join_url,
      startUrl: bookings.start_url,
      notes: bookings.notes,
      createdAt: bookings.created_at,
      updatedAt: bookings.updated_at,
    })
    .from(bookings)
    .innerJoin(bookingTypes, eq(bookings.booking_type_id, bookingTypes.id))
    .innerJoin(users, eq(bookings.user_id, users.id))
    .where(showArchived ? sql`true` : eq(bookings.archived, false))
    .orderBy(sql`coalesce(${bookings.start_time_utc}, ${bookings.created_at}) desc`);

  return rows.map((row) => serializeBooking(row, now));
}

export async function cancelBooking(
  db: Database,
  input: { bookingId: string; actorUserId: string; actorRole: string; now?: Date },
): Promise<BookingSummary> {
  const now = input.now ?? new Date();
  const booking = await getBookingSummaryById(db, input.bookingId);

  if (!booking) {
    throw createHttpError(404, "Booking not found");
  }

  if (input.actorRole !== "admin" && booking.userId !== input.actorUserId) {
    throw createHttpError(404, "Booking not found");
  }

  if (booking.status === "cancelled") {
    throw createHttpError(400, "Booking is already cancelled");
  }

  if (booking.status === "completed") {
    throw createHttpError(400, "Completed bookings cannot be cancelled");
  }

  const [updated] = await db
    .update(bookings)
    .set({
      status: "cancelled",
      updated_at: new Date(),
    })
    .where(eq(bookings.id, input.bookingId))
    .returning({ id: bookings.id });

  if (!updated) {
    throw createHttpError(404, "Booking not found");
  }

  const summary = await getBookingSummaryById(db, input.bookingId);
  if (!summary) {
    throw createHttpError(500, "Booking cancelled but could not be loaded");
  }

  if (summary.startTimeUtc && summary.endTimeUtc) {
    await sendBookingCancelledNotification({
      bookingId: summary.id,
      userId: summary.userId,
      bookingType: summary.bookingTypeName,
      timezone: summary.timezone,
      startTimeUtc: summary.startTimeUtc.toISOString(),
      endTimeUtc: summary.endTimeUtc.toISOString(),
    });
  }

  return serializeBooking(summary, now);
}
