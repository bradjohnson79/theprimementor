import { mentorTrainingOrders, bookings, users, type Database } from "@wisdom/db";
import type { MentorTrainingPackageType } from "@wisdom/utils";
import { MENTOR_TRAINING_PACKAGE_LIST } from "@wisdom/utils";
import { and, desc, eq, sql } from "drizzle-orm";
import { createHttpError } from "./booking/errors.js";
import { createPaymentRecordForEntity, getReusablePaymentForEntity } from "./payments/paymentsService.js";
import { resolveMemberAccess } from "./divin8/memberAccessService.js";

export type MentorTrainingOrderStatus =
  | "pending_payment"
  | "paid"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface MentorTrainingEligibility {
  isInitiate: boolean;
  hasCompletedMentoringSession: boolean;
  isEligible: boolean;
}

export interface MentorTrainingOrderSummary {
  id: string;
  userId: string;
  packageType: MentorTrainingPackageType;
  status: MentorTrainingOrderStatus;
  timezone: string | null;
  locationInput: string | null;
  lat: number | null;
  lng: number | null;
  eligibilityVerifiedAt: string;
  createdAt: string;
  updatedAt: string | null;
  archived: boolean;
}

interface CompletedMentoringContext {
  bookingId: string;
  timezone: string | null;
  locationInput: string | null;
  lat: number | null;
  lng: number | null;
}

type PendingOrderOutcome =
  | { kind: "pending"; order: MentorTrainingOrderSummary }
  | { kind: "already_paid"; order: MentorTrainingOrderSummary };
type TrainingOrderReader = Pick<Database, "select">;

function mapTrainingOrder(row: {
  id: string;
  userId: string;
  packageType: MentorTrainingPackageType;
  status: MentorTrainingOrderStatus;
  timezone: string | null;
  locationInput: string | null;
  lat: number | null;
  lng: number | null;
  eligibilityVerifiedAt: Date;
  createdAt: Date;
  updatedAt: Date | null;
  archived: boolean;
}): MentorTrainingOrderSummary {
  return {
    id: row.id,
    userId: row.userId,
    packageType: row.packageType,
    status: row.status,
    timezone: row.timezone,
    locationInput: row.locationInput,
    lat: row.lat,
    lng: row.lng,
    eligibilityVerifiedAt: row.eligibilityVerifiedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
    archived: row.archived,
  };
}

async function assertInitiateAccess(db: Database, userId: string) {
  const memberAccess = await resolveMemberAccess(db, userId);
  if (!memberAccess || memberAccess.tier !== "initiate") {
    throw createHttpError(403, "Initiate membership is required for mentor training.");
  }

  return memberAccess;
}

async function getCompletedMentoringContext(db: Database, userId: string): Promise<CompletedMentoringContext | null> {
  const [row] = await db
    .select({
      bookingId: bookings.id,
      timezone: bookings.timezone,
      birthPlaceName: bookings.birth_place_name,
      birthPlace: bookings.birth_place,
      birthLat: bookings.birth_lat,
      birthLng: bookings.birth_lng,
    })
    .from(bookings)
    .where(and(
      eq(bookings.user_id, userId),
      eq(bookings.session_type, "mentoring"),
      eq(bookings.status, "completed"),
    ))
    .orderBy(desc(bookings.updated_at), desc(bookings.created_at))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    bookingId: row.bookingId,
    timezone: row.timezone,
    locationInput: row.birthPlaceName ?? row.birthPlace ?? null,
    lat: row.birthLat ?? null,
    lng: row.birthLng ?? null,
  };
}

async function getTrainingOrderById(db: TrainingOrderReader, orderId: string) {
  const [row] = await db
    .select({
      id: mentorTrainingOrders.id,
      userId: mentorTrainingOrders.user_id,
      packageType: mentorTrainingOrders.package_type,
      status: mentorTrainingOrders.status,
      timezone: mentorTrainingOrders.timezone,
      locationInput: mentorTrainingOrders.location_input,
      lat: mentorTrainingOrders.lat,
      lng: mentorTrainingOrders.lng,
      eligibilityVerifiedAt: mentorTrainingOrders.eligibility_verified_at,
      createdAt: mentorTrainingOrders.created_at,
      updatedAt: mentorTrainingOrders.updated_at,
      archived: mentorTrainingOrders.archived,
    })
    .from(mentorTrainingOrders)
    .where(eq(mentorTrainingOrders.id, orderId))
    .limit(1);

  return row ?? null;
}

export async function getMentorTrainingEligibility(
  db: Database,
  userId: string,
): Promise<MentorTrainingEligibility> {
  await assertInitiateAccess(db, userId);
  const completedMentoring = await getCompletedMentoringContext(db, userId);

  return {
    isInitiate: true,
    hasCompletedMentoringSession: Boolean(completedMentoring),
    isEligible: Boolean(completedMentoring),
  };
}

export async function getMentorTrainingPageData(db: Database, userId: string) {
  const eligibility = await getMentorTrainingEligibility(db, userId);
  return {
    eligibility,
    packages: MENTOR_TRAINING_PACKAGE_LIST,
  };
}

export async function prepareMentorTrainingOrderForCheckout(
  db: Database,
  input: { userId: string; packageType: MentorTrainingPackageType },
): Promise<PendingOrderOutcome> {
  await assertInitiateAccess(db, input.userId);

  const mentoringContext = await getCompletedMentoringContext(db, input.userId);
  if (!mentoringContext) {
    throw createHttpError(403, "User not eligible for mentor training");
  }

  const packageDefinition = MENTOR_TRAINING_PACKAGE_LIST.find((item) => item.type === input.packageType);
  if (!packageDefinition) {
    throw createHttpError(400, "Invalid mentor training package");
  }

  const now = new Date();

  const outcome = await db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT id
      FROM users
      WHERE id = ${input.userId}
      FOR UPDATE
    `);

    const [existing] = await tx
      .select({
        id: mentorTrainingOrders.id,
        userId: mentorTrainingOrders.user_id,
        packageType: mentorTrainingOrders.package_type,
        status: mentorTrainingOrders.status,
        timezone: mentorTrainingOrders.timezone,
        locationInput: mentorTrainingOrders.location_input,
        lat: mentorTrainingOrders.lat,
        lng: mentorTrainingOrders.lng,
        eligibilityVerifiedAt: mentorTrainingOrders.eligibility_verified_at,
        createdAt: mentorTrainingOrders.created_at,
        updatedAt: mentorTrainingOrders.updated_at,
        archived: mentorTrainingOrders.archived,
      })
      .from(mentorTrainingOrders)
      .where(and(
        eq(mentorTrainingOrders.user_id, input.userId),
        eq(mentorTrainingOrders.package_type, input.packageType),
      ))
      .orderBy(desc(mentorTrainingOrders.created_at))
      .limit(1);

    if (existing && existing.status === "pending_payment") {
      await tx
        .update(mentorTrainingOrders)
        .set({
          timezone: mentoringContext.timezone,
          location_input: mentoringContext.locationInput,
          lat: mentoringContext.lat,
          lng: mentoringContext.lng,
          eligibility_verified_at: now,
          updated_at: now,
        })
        .where(eq(mentorTrainingOrders.id, existing.id));

      const payment = await getReusablePaymentForEntity(tx, {
        entityType: "mentor_training",
        entityId: existing.id,
      });
      if (!payment) {
        await createPaymentRecordForEntity(tx, {
          userId: input.userId,
          entityType: "mentor_training",
          entityId: existing.id,
          amountCents: packageDefinition.priceCad * 100,
          currency: "CAD",
          status: "pending",
          metadata: {
            source: "mentor_training_reuse",
            packageType: input.packageType,
            completedMentoringBookingId: mentoringContext.bookingId,
          },
        });
      }

      const refreshed = await getTrainingOrderById(tx, existing.id);
      if (!refreshed) {
        throw createHttpError(500, "Mentor training order could not be loaded");
      }
      return { kind: "pending" as const, order: mapTrainingOrder(refreshed) };
    }

    if (existing && (existing.status === "paid" || existing.status === "in_progress" || existing.status === "completed")) {
      return { kind: "already_paid" as const, order: mapTrainingOrder(existing) };
    }

    const [created] = await tx
      .insert(mentorTrainingOrders)
      .values({
        user_id: input.userId,
        package_type: input.packageType,
        status: "pending_payment",
        timezone: mentoringContext.timezone,
        location_input: mentoringContext.locationInput,
        lat: mentoringContext.lat,
        lng: mentoringContext.lng,
        eligibility_verified_at: now,
      })
      .returning({ id: mentorTrainingOrders.id });

    await createPaymentRecordForEntity(tx, {
      userId: input.userId,
      entityType: "mentor_training",
      entityId: created.id,
      amountCents: packageDefinition.priceCad * 100,
      currency: "CAD",
      status: "pending",
      metadata: {
        source: "mentor_training_create",
        packageType: input.packageType,
        completedMentoringBookingId: mentoringContext.bookingId,
      },
    });

    const inserted = await getTrainingOrderById(tx, created.id);
    if (!inserted) {
      throw createHttpError(500, "Mentor training order could not be loaded");
    }
    return { kind: "pending" as const, order: mapTrainingOrder(inserted) };
  });

  return outcome;
}

export async function getMentorTrainingOrderForCheckout(db: Database, orderId: string) {
  const order = await getTrainingOrderById(db, orderId);
  if (!order) {
    throw createHttpError(404, "Mentor training order not found");
  }

  return mapTrainingOrder(order);
}

export async function updateMentorTrainingOrderStatus(
  db: Database,
  input: {
    orderId: string;
    status: Extract<MentorTrainingOrderStatus, "in_progress" | "completed">;
  },
): Promise<MentorTrainingOrderSummary> {
  const current = await getTrainingOrderById(db, input.orderId);
  if (!current) {
    throw createHttpError(404, "Mentor training order not found");
  }

  if (current.status === "cancelled") {
    throw createHttpError(400, "Cancelled mentor training orders cannot be updated.");
  }

  await db
    .update(mentorTrainingOrders)
    .set({
      status: input.status,
      updated_at: new Date(),
    })
    .where(eq(mentorTrainingOrders.id, input.orderId));

  const refreshed = await getTrainingOrderById(db, input.orderId);
  if (!refreshed) {
    throw createHttpError(500, "Mentor training order could not be loaded");
  }

  return mapTrainingOrder(refreshed);
}
