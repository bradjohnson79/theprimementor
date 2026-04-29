import { eq } from "drizzle-orm";
import { bookings, reports, type Database } from "@wisdom/db";
import { createHttpError } from "./booking/errors.js";
import { normalizeHealthFocusAreas } from "./booking/bookingService.js";
import { isBookingSessionType, type BookingIntakePayload } from "./booking/bookingConstants.js";
import { parseOrderId } from "./ordersService.js";

export interface AdminOrderIntakeUpdateInput {
  phone?: unknown;
  birth_date?: unknown;
  birth_time?: unknown;
  location?: unknown;
  timezone?: unknown;
  consent_given?: unknown;
  topics?: unknown;
  goals?: unknown;
  health_focus_areas?: unknown;
  other?: unknown;
  submitted_questions?: unknown;
  notes?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeNullableText(value: unknown) {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw createHttpError(400, "Text fields must be strings.");
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeBirthDate(value: unknown) {
  const normalized = normalizeNullableText(value);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw createHttpError(400, "Birth date must use YYYY-MM-DD.");
  }
  return normalized;
}

function normalizeBirthTime(value: unknown) {
  const normalized = normalizeNullableText(value);
  if (!normalized) return "00:00";
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(normalized)) {
    throw createHttpError(400, "Birth time must use HH:MM.");
  }
  return normalized.slice(0, 5);
}

function normalizeBoolean(value: unknown) {
  if (value == null) return false;
  if (typeof value !== "boolean") {
    throw createHttpError(400, "Consent must be true or false.");
  }
  return value;
}

function normalizeStringArray(value: unknown) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw createHttpError(400, "List fields must be arrays.");
  }
  return Array.from(
    new Set(
      value
        .map((entry) => {
          if (typeof entry !== "string") {
            throw createHttpError(400, "List entries must be strings.");
          }
          return entry.trim();
        })
        .filter(Boolean),
    ),
  );
}

function parseStoredObject(value: unknown) {
  return isRecord(value) ? value : {};
}

function normalizeIntakeInput(input: AdminOrderIntakeUpdateInput) {
  return {
    phone: normalizeNullableText(input.phone),
    birthDate: normalizeBirthDate(input.birth_date),
    birthTime: normalizeBirthTime(input.birth_time),
    location: normalizeNullableText(input.location),
    timezone: normalizeNullableText(input.timezone),
    consentGiven: normalizeBoolean(input.consent_given),
    topics: normalizeStringArray(input.topics),
    goals: normalizeStringArray(input.goals),
    healthFocusAreas: normalizeHealthFocusAreas(input.health_focus_areas, { requireAtLeastOne: false }),
    other: normalizeNullableText(input.other),
    submittedQuestions: normalizeStringArray(input.submitted_questions),
    notes: normalizeNullableText(input.notes),
  };
}

export async function updateAdminOrderIntake(
  db: Database,
  orderId: string,
  input: AdminOrderIntakeUpdateInput,
) {
  const parsed = parseOrderId(orderId);
  const normalized = normalizeIntakeInput(input);

  if (parsed.type === "session") {
    const [booking] = await db
      .select({
        id: bookings.id,
        sessionType: bookings.session_type,
        intake: bookings.intake,
        intakeSnapshot: bookings.intake_snapshot,
      })
      .from(bookings)
      .where(eq(bookings.id, parsed.sourceId))
      .limit(1);

    if (!booking) {
      throw createHttpError(404, "Order not found");
    }
    if (!isBookingSessionType(booking.sessionType)) {
      throw createHttpError(400, "Unsupported booking session type.");
    }

    const existingIntake = parseStoredObject(booking.intake);
    const nextIntake: BookingIntakePayload = {
      ...existingIntake,
      type: booking.sessionType,
      topics: normalized.topics,
      goals: normalized.goals,
      healthFocusAreas: normalized.healthFocusAreas,
      other: normalized.other ?? undefined,
      notes: normalized.notes ?? undefined,
    };
    const nextSnapshot = {
      ...parseStoredObject(booking.intakeSnapshot),
      phone: normalized.phone,
      birthDate: normalized.birthDate,
      birthTime: normalized.birthTime,
      birthPlace: normalized.location,
      birthPlaceName: normalized.location,
      timezone: normalized.timezone,
      consentGiven: normalized.consentGiven,
      submittedQuestions: normalized.submittedQuestions,
      intake: nextIntake,
      notes: normalized.notes,
    };

    await db
      .update(bookings)
      .set({
        phone: normalized.phone,
        birth_date: normalized.birthDate,
        birth_time: normalized.birthTime,
        birth_place: normalized.location,
        birth_place_name: normalized.location,
        birth_timezone: normalized.timezone,
        consent_given: normalized.consentGiven,
        intake: nextIntake,
        intake_snapshot: nextSnapshot,
        notes: normalized.notes,
        updated_at: new Date(),
      })
      .where(eq(bookings.id, parsed.sourceId));
    return;
  }

  if (parsed.type === "report") {
    const [report] = await db
      .select({
        id: reports.id,
        purchaseIntake: reports.purchase_intake,
      })
      .from(reports)
      .where(eq(reports.id, parsed.sourceId))
      .limit(1);

    if (!report) {
      throw createHttpError(404, "Order not found");
    }

    const existingPurchaseIntake = parseStoredObject(report.purchaseIntake);
    const existingBirthplace = parseStoredObject(existingPurchaseIntake.birthplace);
    const primaryFocus = normalized.submittedQuestions[0] ?? normalized.other ?? null;
    const nextPurchaseIntake = {
      ...existingPurchaseIntake,
      phone: normalized.phone,
      birthDate: normalized.birthDate,
      birthTime: normalized.birthTime,
      primaryFocus,
      questions: normalized.submittedQuestions,
      consentGiven: normalized.consentGiven,
      notes: normalized.notes,
      birthplace: {
        ...existingBirthplace,
        name: normalized.location,
        timezone: normalized.timezone ?? existingBirthplace.timezone ?? null,
      },
    };

    await db
      .update(reports)
      .set({
        purchase_intake: nextPurchaseIntake,
        birth_place_name: normalized.location,
        birth_timezone: normalized.timezone,
        updated_at: new Date(),
      })
      .where(eq(reports.id, parsed.sourceId));
    return;
  }

  throw createHttpError(400, "Intake editing is only available for session and report orders.");
}
