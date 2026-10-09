import { and, desc, eq, gte, lt } from "drizzle-orm";
import { bookings, regenerationPeriodBenefits, regenerationSubscriptions, type Database } from "@wisdom/db";
import { createHttpError } from "./booking/errors.js";

export const MANIFESTATION_CONSULTATION_SLOTS = ["alignment", "reinforcement"] as const;
export type ManifestationConsultationSlot = typeof MANIFESTATION_CONSULTATION_SLOTS[number];

const CONSULTATION_STATUSES = new Set(["available", "scheduled", "completed"]);
const IDEOGRAM_STATUSES = new Set(["pending", "completed", "delivered"]);
const IDEOGRAM_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"]);
const MAX_IDEOGRAM_BYTES = 8 * 1024 * 1024;

export function isManifestationConsultationSlot(value: string): value is ManifestationConsultationSlot {
  return (MANIFESTATION_CONSULTATION_SLOTS as readonly string[]).includes(value);
}

export function periodBenefitKey(subscriptionId: string, periodStart: Date) {
  return `${subscriptionId}:${periodStart.toISOString()}`;
}

export function assertConsultationAvailable(status: string) {
  if (status !== "available") {
    throw createHttpError(409, "This consultation has already been scheduled for the current monthly period.");
  }
}

interface PeriodRow {
  id: string;
  subscriptionId: string;
  userId: string;
  periodStart: Date;
  periodEnd: Date | null;
  alignmentStatus: string;
  alignmentBookingId: string | null;
  alignmentAvailability: unknown;
  alignmentScheduledAt: Date | null;
  reinforcementStatus: string;
  reinforcementBookingId: string | null;
  reinforcementAvailability: unknown;
  reinforcementScheduledAt: Date | null;
  ideogramStatus: string;
  ideogramFileName: string | null;
  ideogramContentType: string | null;
  ideogramByteSize: number | null;
  ideogramDeliveredAt: Date | null;
  safeguardingIncluded: boolean;
}

function serialize(row: PeriodRow) {
  return {
    id: row.id,
    subscriptionId: row.subscriptionId,
    userId: row.userId,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd?.toISOString() ?? null,
    consultations: {
      alignment: {
        role: "Manifestation Alignment",
        timing: "Beginning of the monthly period",
        durationMinutes: 15,
        status: row.alignmentStatus,
        bookingId: row.alignmentBookingId,
        availability: row.alignmentAvailability,
        scheduledAt: row.alignmentScheduledAt?.toISOString() ?? null,
      },
      reinforcement: {
        role: "Manifestation Reinforcement",
        timing: "About halfway through the monthly period",
        durationMinutes: 15,
        status: row.reinforcementStatus,
        bookingId: row.reinforcementBookingId,
        availability: row.reinforcementAvailability,
        scheduledAt: row.reinforcementScheduledAt?.toISOString() ?? null,
      },
    },
    ideogram: {
      status: row.ideogramStatus,
      fileName: row.ideogramFileName,
      contentType: row.ideogramContentType,
      byteSize: row.ideogramByteSize,
      deliveredAt: row.ideogramDeliveredAt?.toISOString() ?? null,
      downloadable: row.ideogramStatus === "delivered" && Boolean(row.ideogramFileName),
    },
    safeguardingIncluded: row.safeguardingIncluded,
  };
}

const periodColumns = {
  id: regenerationPeriodBenefits.id,
  subscriptionId: regenerationPeriodBenefits.subscription_id,
  userId: regenerationPeriodBenefits.user_id,
  periodStart: regenerationPeriodBenefits.period_start,
  periodEnd: regenerationPeriodBenefits.period_end,
  alignmentStatus: regenerationPeriodBenefits.alignment_status,
  alignmentBookingId: regenerationPeriodBenefits.alignment_booking_id,
  alignmentAvailability: regenerationPeriodBenefits.alignment_availability,
  alignmentScheduledAt: regenerationPeriodBenefits.alignment_scheduled_at,
  reinforcementStatus: regenerationPeriodBenefits.reinforcement_status,
  reinforcementBookingId: regenerationPeriodBenefits.reinforcement_booking_id,
  reinforcementAvailability: regenerationPeriodBenefits.reinforcement_availability,
  reinforcementScheduledAt: regenerationPeriodBenefits.reinforcement_scheduled_at,
  ideogramStatus: regenerationPeriodBenefits.ideogram_status,
  ideogramFileName: regenerationPeriodBenefits.ideogram_file_name,
  ideogramContentType: regenerationPeriodBenefits.ideogram_content_type,
  ideogramByteSize: regenerationPeriodBenefits.ideogram_byte_size,
  ideogramDeliveredAt: regenerationPeriodBenefits.ideogram_delivered_at,
  safeguardingIncluded: regenerationPeriodBenefits.safeguarding_included,
};

async function loadPeriod(db: Database, subscriptionId: string, periodStart: Date) {
  const [row] = await db
    .select(periodColumns)
    .from(regenerationPeriodBenefits)
    .where(and(
      eq(regenerationPeriodBenefits.subscription_id, subscriptionId),
      eq(regenerationPeriodBenefits.period_start, periodStart),
    ))
    .limit(1);
  return row ?? null;
}

async function linkExistingAlignmentBooking(db: Database, row: PeriodRow) {
  if (row.alignmentStatus !== "available" || row.alignmentBookingId) return row;
  const periodEnd = row.periodEnd ?? new Date(row.periodStart.getTime() + 32 * 24 * 60 * 60 * 1000);
  const [booking] = await db
    .select({
      id: bookings.id,
      availability: bookings.availability,
    })
    .from(bookings)
    .where(and(
      eq(bookings.user_id, row.userId),
      eq(bookings.booking_type_id, "regeneration-session"),
      gte(bookings.created_at, row.periodStart),
      lt(bookings.created_at, periodEnd),
    ))
    .orderBy(desc(bookings.created_at))
    .limit(1);
  if (!booking) return row;

  const [updated] = await db
    .update(regenerationPeriodBenefits)
    .set({
      alignment_booking_id: booking.id,
      alignment_availability: booking.availability,
      alignment_status: "scheduled",
      alignment_scheduled_at: new Date(),
      updated_at: new Date(),
    })
    .where(and(
      eq(regenerationPeriodBenefits.id, row.id),
      eq(regenerationPeriodBenefits.alignment_status, "available"),
    ))
    .returning(periodColumns);
  return updated ?? row;
}

export async function ensureRegenerationPeriodBenefit(
  db: Database,
  input: {
    subscriptionId: string;
    userId: string;
    periodStart: Date | null;
    periodEnd: Date | null;
    accessState: string;
  },
) {
  if (!input.periodStart) return null;
  if (input.accessState === "inactive") return null;

  await db
    .insert(regenerationPeriodBenefits)
    .values({
      subscription_id: input.subscriptionId,
      user_id: input.userId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      alignment_status: "available",
      reinforcement_status: "available",
      ideogram_status: "pending",
      safeguarding_included: true,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .onConflictDoNothing({
      target: [regenerationPeriodBenefits.subscription_id, regenerationPeriodBenefits.period_start],
    });

  const row = await loadPeriod(db, input.subscriptionId, input.periodStart);
  if (!row) return null;
  return serialize(await linkExistingAlignmentBooking(db, row));
}

export async function ensureCurrentPeriodBenefitForUser(db: Database, userId: string) {
  const [subscription] = await db
    .select({
      id: regenerationSubscriptions.id,
      userId: regenerationSubscriptions.user_id,
      periodStart: regenerationSubscriptions.current_period_start,
      periodEnd: regenerationSubscriptions.current_period_end,
      accessState: regenerationSubscriptions.access_state,
    })
    .from(regenerationSubscriptions)
    .where(eq(regenerationSubscriptions.user_id, userId))
    .limit(1);
  if (!subscription) return null;
  return ensureRegenerationPeriodBenefit(db, {
    subscriptionId: subscription.id,
    userId: subscription.userId,
    periodStart: subscription.periodStart,
    periodEnd: subscription.periodEnd,
    accessState: subscription.accessState,
  });
}

export async function getRegenerationPeriodBenefitForUser(db: Database, userId: string) {
  await ensureCurrentPeriodBenefitForUser(db, userId);
  const [row] = await db
    .select(periodColumns)
    .from(regenerationPeriodBenefits)
    .where(eq(regenerationPeriodBenefits.user_id, userId))
    .orderBy(desc(regenerationPeriodBenefits.period_start))
    .limit(1);
  return row ? serialize(row) : null;
}

export async function scheduleManifestationConsultation(
  db: Database,
  input: {
    userId: string;
    slot: ManifestationConsultationSlot;
    availability: Record<string, string[]>;
    timezone: string;
  },
) {
  await ensureCurrentPeriodBenefitForUser(db, input.userId);
  const selected = Object.values(input.availability).some((times) => times.length > 0);
  if (!selected) {
    throw createHttpError(400, "Select at least one availability window.");
  }
  const [row] = await db
    .select(periodColumns)
    .from(regenerationPeriodBenefits)
    .where(eq(regenerationPeriodBenefits.user_id, input.userId))
    .orderBy(desc(regenerationPeriodBenefits.period_start))
    .limit(1);
  if (!row) {
    throw createHttpError(404, "No active Manifestation Monthly Package period was found.");
  }

  const status = input.slot === "alignment" ? row.alignmentStatus : row.reinforcementStatus;
  assertConsultationAvailable(status);
  const now = new Date();
  const patch = input.slot === "alignment"
    ? {
      alignment_status: "scheduled",
      alignment_availability: { ...input.availability, timezone: input.timezone },
      alignment_scheduled_at: now,
      updated_at: now,
    }
    : {
      reinforcement_status: "scheduled",
      reinforcement_availability: { ...input.availability, timezone: input.timezone },
      reinforcement_scheduled_at: now,
      updated_at: now,
    };
  const statusColumn = input.slot === "alignment"
    ? regenerationPeriodBenefits.alignment_status
    : regenerationPeriodBenefits.reinforcement_status;
  const [updated] = await db
    .update(regenerationPeriodBenefits)
    .set(patch)
    .where(and(
      eq(regenerationPeriodBenefits.id, row.id),
      eq(statusColumn, "available"),
    ))
    .returning(periodColumns);
  if (!updated) {
    throw createHttpError(409, "This consultation has already been scheduled for the current monthly period.");
  }
  return serialize(updated);
}

export async function updateManifestationPeriodFulfillment(
  db: Database,
  input: {
    userId: string;
    alignmentStatus?: string;
    reinforcementStatus?: string;
    ideogramStatus?: string;
  },
) {
  if (input.alignmentStatus && !CONSULTATION_STATUSES.has(input.alignmentStatus)) {
    throw createHttpError(400, "Invalid consultation status.");
  }
  if (input.reinforcementStatus && !CONSULTATION_STATUSES.has(input.reinforcementStatus)) {
    throw createHttpError(400, "Invalid consultation status.");
  }
  if (input.ideogramStatus && !IDEOGRAM_STATUSES.has(input.ideogramStatus)) {
    throw createHttpError(400, "Invalid ideogram status.");
  }
  const [row] = await db
    .select(periodColumns)
    .from(regenerationPeriodBenefits)
    .where(eq(regenerationPeriodBenefits.user_id, input.userId))
    .orderBy(desc(regenerationPeriodBenefits.period_start))
    .limit(1);
  if (!row) throw createHttpError(404, "No Manifestation Monthly Package period was found.");
  const [updated] = await db
    .update(regenerationPeriodBenefits)
    .set({
      alignment_status: input.alignmentStatus ?? row.alignmentStatus,
      reinforcement_status: input.reinforcementStatus ?? row.reinforcementStatus,
      ideogram_status: input.ideogramStatus ?? row.ideogramStatus,
      updated_at: new Date(),
    })
    .where(eq(regenerationPeriodBenefits.id, row.id))
    .returning(periodColumns);
  return serialize(updated);
}

export async function saveManifestationIdeogram(
  db: Database,
  input: {
    userId: string;
    fileName: string;
    contentType: string;
    data: Buffer;
  },
) {
  if (!IDEOGRAM_TYPES.has(input.contentType)) {
    throw createHttpError(400, "Upload a JPEG, PNG, WebP, or PDF ideogram circuit.");
  }
  if (input.data.length === 0 || input.data.length > MAX_IDEOGRAM_BYTES) {
    throw createHttpError(400, "The ideogram file must be under 8 MB.");
  }
  const [row] = await db
    .select({ id: regenerationPeriodBenefits.id })
    .from(regenerationPeriodBenefits)
    .where(eq(regenerationPeriodBenefits.user_id, input.userId))
    .orderBy(desc(regenerationPeriodBenefits.period_start))
    .limit(1);
  if (!row) throw createHttpError(404, "No Manifestation Monthly Package period was found.");
  const now = new Date();
  await db
    .update(regenerationPeriodBenefits)
    .set({
      ideogram_status: "delivered",
      ideogram_file_name: input.fileName.slice(0, 180),
      ideogram_content_type: input.contentType,
      ideogram_byte_size: input.data.length,
      ideogram_data: input.data,
      ideogram_delivered_at: now,
      updated_at: now,
    })
    .where(eq(regenerationPeriodBenefits.id, row.id));
  const [updated] = await db
    .select(periodColumns)
    .from(regenerationPeriodBenefits)
    .where(eq(regenerationPeriodBenefits.id, row.id))
    .limit(1);
  return serialize(updated);
}

export async function readManifestationIdeogram(db: Database, userId: string) {
  const [row] = await db
    .select({
      fileName: regenerationPeriodBenefits.ideogram_file_name,
      contentType: regenerationPeriodBenefits.ideogram_content_type,
      data: regenerationPeriodBenefits.ideogram_data,
      status: regenerationPeriodBenefits.ideogram_status,
    })
    .from(regenerationPeriodBenefits)
    .where(eq(regenerationPeriodBenefits.user_id, userId))
    .orderBy(desc(regenerationPeriodBenefits.period_start))
    .limit(1);
  if (!row?.data || row.status !== "delivered" || !row.fileName || !row.contentType) {
    throw createHttpError(404, "Your ideogram circuit is not ready yet.");
  }
  return {
    fileName: row.fileName,
    contentType: row.contentType,
    data: row.data,
  };
}
