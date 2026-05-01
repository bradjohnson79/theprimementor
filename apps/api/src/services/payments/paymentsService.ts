import { and, desc, eq, notInArray } from "drizzle-orm";
import { bookingTypes, bookings, mentorTrainingOrders, payments, reports, subscriptions, users, type Database } from "@wisdom/db";
import { getPaymentProvider } from "./providerFactory.js";
import { createHttpError } from "./errors.js";

type PaymentDbLike = Database | {
  select: Database["select"];
  insert: Database["insert"];
  update: Database["update"];
};
type PaymentReader = Pick<Database, "select">;

export type PaymentEntityType =
  | "session"
  | "report"
  | "subscription"
  | "mentor_training"
  | "mentoring_circle"
  | "regeneration_subscription";
type PaymentStatus = "pending" | "requires_payment" | "paid" | "failed" | "refunded";

interface PaymentRow {
  id: string;
  userId: string;
  userEmail?: string;
  userRole?: string;
  entityType: string;
  entityId: string;
  bookingId: string | null;
  bookingStartTimeUtc: Date | null;
  bookingStatus: string | null;
  bookingTypeId: string | null;
  bookingTypeName: string | null;
  amountCents: number;
  currency: string;
  status: string;
  provider: string;
  providerPaymentIntentId: string | null;
  providerCustomerId: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface PaymentSummary {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  provider: string;
  provider_payment_intent_id: string | null;
  provider_customer_id: string | null;
  metadata: Record<string, unknown> | null;
  booking_id: string | null;
  created_at: string;
  updated_at: string | null;
  user?: {
    id: string;
    email: string;
    role: string;
  };
  booking?: {
    id: string;
    start_time_utc: string;
    status: string;
    booking_type?: {
      id: string;
      name: string;
    };
  };
}

export interface CreatePaymentForBookingInput {
  bookingId: string;
  actorUserId: string;
  actorRole: string;
  metadata?: Record<string, unknown> | null;
}

function isPaymentMetadata(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMetadata(
  ...parts: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> | null {
  const merged = Object.assign({}, ...parts.filter((part) => part && Object.keys(part).length > 0));
  return Object.keys(merged).length > 0 ? merged : null;
}

function serializePayment(row: PaymentRow): PaymentSummary {
  const metadata = isPaymentMetadata(row.metadata) ? row.metadata : null;

  return {
    id: row.id,
    user_id: row.userId,
    entity_type: row.entityType,
    entity_id: row.entityId,
    amount_cents: row.amountCents,
    currency: row.currency,
    status: row.status,
    provider: row.provider,
    provider_payment_intent_id: row.providerPaymentIntentId,
    provider_customer_id: row.providerCustomerId,
    metadata,
    booking_id: row.bookingId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt ? row.updatedAt.toISOString() : null,
    user: row.userEmail && row.userRole
      ? {
          id: row.userId,
          email: row.userEmail,
          role: row.userRole,
        }
      : undefined,
    booking: row.bookingId && row.bookingStartTimeUtc && row.bookingStatus
      ? {
          id: row.bookingId,
          start_time_utc: row.bookingStartTimeUtc.toISOString(),
          status: row.bookingStatus,
          booking_type: row.bookingTypeId && row.bookingTypeName
            ? {
                id: row.bookingTypeId,
                name: row.bookingTypeName,
              }
            : undefined,
        }
      : undefined,
  };
}

async function getPaymentById(db: Database, paymentId: string): Promise<PaymentRow | null> {
  const [row] = await db
    .select({
      id: payments.id,
      userId: payments.user_id,
      userEmail: users.email,
      userRole: users.role,
      entityType: payments.entity_type,
      entityId: payments.entity_id,
      bookingId: payments.booking_id,
      bookingStartTimeUtc: bookings.start_time_utc,
      bookingStatus: bookings.status,
      bookingTypeId: bookingTypes.id,
      bookingTypeName: bookingTypes.name,
      amountCents: payments.amount_cents,
      currency: payments.currency,
      status: payments.status,
      provider: payments.provider,
      providerPaymentIntentId: payments.provider_payment_intent_id,
      providerCustomerId: payments.provider_customer_id,
      metadata: payments.metadata,
      createdAt: payments.created_at,
      updatedAt: payments.updated_at,
    })
    .from(payments)
    .innerJoin(users, eq(payments.user_id, users.id))
    .leftJoin(bookings, eq(payments.booking_id, bookings.id))
    .leftJoin(bookingTypes, eq(bookings.booking_type_id, bookingTypes.id))
    .where(eq(payments.id, paymentId))
    .limit(1);

  return row ?? null;
}

async function getBookingForPaymentCreation(db: Database, bookingId: string) {
  const [row] = await db
    .select({
      id: bookings.id,
      userId: bookings.user_id,
      bookingStatus: bookings.status,
      bookingTypeId: bookingTypes.id,
      amountCents: bookingTypes.price_cents,
      currency: bookingTypes.currency,
    })
    .from(bookings)
    .innerJoin(bookingTypes, eq(bookings.booking_type_id, bookingTypes.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!row) {
    throw createHttpError(404, "Booking not found");
  }

  return row;
}

async function getReusablePaymentForBooking(db: Database, bookingId: string) {
  return getReusablePaymentForEntity(db, { entityType: "session", entityId: bookingId });
}

export async function getReusablePaymentForEntity(
  db: PaymentReader,
  input: { entityType: PaymentEntityType; entityId: string },
) {
  const [row] = await db
    .select({
      id: payments.id,
      status: payments.status,
      metadata: payments.metadata,
    })
    .from(payments)
    .where(and(
      eq(payments.entity_type, input.entityType),
      eq(payments.entity_id, input.entityId),
      notInArray(payments.status, ["failed", "refunded"]),
    ))
    .orderBy(desc(payments.created_at))
    .limit(1);

  return row ?? null;
}

function resolveBookingStatusAfterPayment(startTimeUtc: Date | null) {
  return startTimeUtc ? "scheduled" : "paid";
}

async function applyPaidStatusToLinkedEntity(db: Database, current: PaymentRow) {
  if (
    (current.entityType === "session"
      || current.entityType === "mentoring_circle"
      || current.entityType === "regeneration_subscription")
    && current.bookingId
  ) {
    await db
      .update(bookings)
      .set({
        status: resolveBookingStatusAfterPayment(current.bookingStartTimeUtc),
        updated_at: new Date(),
      })
      .where(eq(bookings.id, current.bookingId));
    return;
  }

  if (current.entityType === "report") {
    await db
      .update(reports)
      .set({
        member_status: "paid",
        updated_at: new Date(),
      })
      .where(eq(reports.id, current.entityId));
    return;
  }

  if (current.entityType === "subscription") {
    await db
      .update(subscriptions)
      .set({
        status: "active",
        updated_at: new Date(),
      })
      .where(eq(subscriptions.id, current.entityId));
    return;
  }

  if (current.entityType === "mentor_training") {
    await db
      .update(mentorTrainingOrders)
      .set({
        status: "paid",
        updated_at: new Date(),
      })
      .where(eq(mentorTrainingOrders.id, current.entityId));
    return;
  }
}

async function applyPaidStatusToPayment(
  db: Database,
  current: PaymentRow,
  options: {
    providerPaymentIntentId?: string | null;
    providerCustomerId?: string | null;
    metadata?: Record<string, unknown> | null;
    manual?: boolean;
    actorRole?: string;
  },
) {
  if (current.status === "paid") {
    return serializePayment(current);
  }

  if (current.status === "refunded") {
    throw createHttpError(400, "Refunded payments cannot be confirmed");
  }

  await db
    .update(payments)
    .set({
      status: "paid",
      provider_payment_intent_id: options.providerPaymentIntentId ?? current.providerPaymentIntentId,
      provider_customer_id: options.providerCustomerId ?? current.providerCustomerId,
      metadata: normalizeMetadata(
        isPaymentMetadata(current.metadata) ? current.metadata : null,
        options.metadata,
        options.manual && options.actorRole === "admin" ? { manuallyMarkedPaid: true } : null,
      ),
      updated_at: new Date(),
    })
    .where(eq(payments.id, current.id));

  await applyPaidStatusToLinkedEntity(db, current);

  const refreshed = await getPaymentById(db, current.id);
  if (!refreshed) {
    throw createHttpError(500, "Payment could not be loaded");
  }

  return serializePayment(refreshed);
}

export async function createPaymentRecordForEntity(
  db: PaymentDbLike,
  input: {
    userId: string;
    entityType: PaymentEntityType;
    entityId: string;
    amountCents: number;
    currency: string;
    bookingId?: string | null;
    status?: PaymentStatus;
    metadata?: Record<string, unknown> | null;
  },
) {
  const [created] = await db
    .insert(payments)
    .values({
      user_id: input.userId,
      booking_id: input.bookingId ?? null,
      entity_type: input.entityType,
      entity_id: input.entityId,
      amount_cents: input.amountCents,
      currency: input.currency,
      status: input.status ?? "pending",
      provider: "stripe",
      metadata: input.metadata ?? null,
    })
    .returning({ id: payments.id });

  return created;
}

export async function createPaymentRecordForBooking(
  db: PaymentDbLike,
  input: {
    userId: string;
    bookingId: string;
    amountCents: number;
    currency: string;
    status?: PaymentStatus;
    metadata?: Record<string, unknown> | null;
  },
) {
  return createPaymentRecordForEntity(db, {
    userId: input.userId,
    entityType: "session",
    entityId: input.bookingId,
    bookingId: input.bookingId,
    amountCents: input.amountCents,
    currency: input.currency,
    status: input.status,
    metadata: normalizeMetadata({ source: "booking_create" }, input.metadata),
  });
}

export { getReusablePaymentForBooking };

export async function listPaymentsForUser(db: Database, userId: string): Promise<PaymentSummary[]> {
  const rows = await db
    .select({
      id: payments.id,
      userId: payments.user_id,
      entityType: payments.entity_type,
      entityId: payments.entity_id,
      bookingId: payments.booking_id,
      bookingStartTimeUtc: bookings.start_time_utc,
      bookingStatus: bookings.status,
      bookingTypeId: bookingTypes.id,
      bookingTypeName: bookingTypes.name,
      amountCents: payments.amount_cents,
      currency: payments.currency,
      status: payments.status,
      provider: payments.provider,
      providerPaymentIntentId: payments.provider_payment_intent_id,
      providerCustomerId: payments.provider_customer_id,
      metadata: payments.metadata,
      createdAt: payments.created_at,
      updatedAt: payments.updated_at,
    })
    .from(payments)
    .leftJoin(bookings, eq(payments.booking_id, bookings.id))
    .leftJoin(bookingTypes, eq(bookings.booking_type_id, bookingTypes.id))
    .where(eq(payments.user_id, userId))
    .orderBy(desc(payments.created_at));

  return rows.map((row) => serializePayment(row));
}

export async function listPaymentsForAdmin(db: Database): Promise<PaymentSummary[]> {
  const rows = await db
    .select({
      id: payments.id,
      userId: payments.user_id,
      userEmail: users.email,
      userRole: users.role,
      entityType: payments.entity_type,
      entityId: payments.entity_id,
      bookingId: payments.booking_id,
      bookingStartTimeUtc: bookings.start_time_utc,
      bookingStatus: bookings.status,
      bookingTypeId: bookingTypes.id,
      bookingTypeName: bookingTypes.name,
      amountCents: payments.amount_cents,
      currency: payments.currency,
      status: payments.status,
      provider: payments.provider,
      providerPaymentIntentId: payments.provider_payment_intent_id,
      providerCustomerId: payments.provider_customer_id,
      metadata: payments.metadata,
      createdAt: payments.created_at,
      updatedAt: payments.updated_at,
    })
    .from(payments)
    .innerJoin(users, eq(payments.user_id, users.id))
    .leftJoin(bookings, eq(payments.booking_id, bookings.id))
    .leftJoin(bookingTypes, eq(bookings.booking_type_id, bookingTypes.id))
    .orderBy(desc(payments.created_at));

  return rows.map((row) => serializePayment(row));
}

export async function createPaymentForBooking(db: Database, input: CreatePaymentForBookingInput): Promise<PaymentSummary> {
  const booking = await getBookingForPaymentCreation(db, input.bookingId);

  if (input.actorRole !== "admin" && booking.userId !== input.actorUserId) {
    throw createHttpError(404, "Booking not found");
  }

  const reusable = await getReusablePaymentForBooking(db, input.bookingId);
  const paymentId = reusable
    ? reusable.id
    : (
        await createPaymentRecordForBooking(db, {
          userId: booking.userId,
          bookingId: booking.id,
          amountCents: booking.amountCents,
          currency: booking.currency,
          status: "pending",
          metadata: normalizeMetadata({ source: "payments_route" }, input.metadata),
        })
      ).id;

  const current = await getPaymentById(db, paymentId);
  if (!current) {
    throw createHttpError(500, "Payment could not be loaded");
  }

  if (!current.providerPaymentIntentId && current.status !== "paid") {
    const provider = getPaymentProvider();
    const providerResult = await provider.createPaymentIntent({
      paymentId: current.id,
      amountCents: current.amountCents,
      currency: current.currency,
      metadata: isPaymentMetadata(current.metadata) ? current.metadata : null,
    });

    await db
      .update(payments)
      .set({
        status: current.status,
        provider_payment_intent_id: providerResult.providerPaymentIntentId ?? null,
        provider_customer_id: providerResult.providerCustomerId ?? null,
        metadata: normalizeMetadata(
          isPaymentMetadata(current.metadata) ? current.metadata : null,
          providerResult.metadata,
        ),
        updated_at: new Date(),
      })
      .where(eq(payments.id, current.id));
  }

  const refreshed = await getPaymentById(db, paymentId);
  if (!refreshed) {
    throw createHttpError(500, "Payment could not be loaded");
  }

  return serializePayment(refreshed);
}

export async function confirmPayment(
  db: Database,
  input: { paymentId: string; actorUserId: string; actorRole: string; manual?: boolean },
): Promise<PaymentSummary> {
  const current = await getPaymentById(db, input.paymentId);
  if (!current) {
    throw createHttpError(404, "Payment not found");
  }

  if (input.actorRole !== "admin" && current.userId !== input.actorUserId) {
    throw createHttpError(404, "Payment not found");
  }

  let providerResult: { providerPaymentIntentId?: string | null; providerCustomerId?: string | null; metadata?: Record<string, unknown> | null } = {};
  if (!input.manual) {
    providerResult = await getPaymentProvider().confirmPayment({
      paymentId: current.id,
      providerPaymentIntentId: current.providerPaymentIntentId,
      metadata: isPaymentMetadata(current.metadata) ? current.metadata : null,
    });
  }

  return applyPaidStatusToPayment(db, current, {
    providerPaymentIntentId: providerResult.providerPaymentIntentId ?? null,
    providerCustomerId: providerResult.providerCustomerId ?? null,
    metadata: providerResult.metadata ?? null,
    manual: input.manual,
    actorRole: input.actorRole,
  });
}

export async function markPaymentPaidFromWebhook(
  db: Database,
  input: {
    paymentId: string;
    providerPaymentIntentId?: string | null;
    providerCustomerId?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<PaymentSummary> {
  const current = await getPaymentById(db, input.paymentId);
  if (!current) {
    throw createHttpError(404, "Payment not found");
  }

  return applyPaidStatusToPayment(db, current, {
    providerPaymentIntentId: input.providerPaymentIntentId ?? null,
    providerCustomerId: input.providerCustomerId ?? null,
    metadata: input.metadata ?? null,
  });
}

export async function refundPayment(
  db: Database,
  input: { paymentId: string; actorUserId: string; actorRole: string },
): Promise<PaymentSummary> {
  if (input.actorRole !== "admin") {
    throw createHttpError(403, "Admin access required");
  }

  const current = await getPaymentById(db, input.paymentId);
  if (!current) {
    throw createHttpError(404, "Payment not found");
  }

  if (current.status !== "paid") {
    throw createHttpError(400, "Only paid payments can be refunded");
  }

  const providerResult = await getPaymentProvider().refundPayment({
    paymentId: current.id,
    providerPaymentIntentId: current.providerPaymentIntentId,
    metadata: isPaymentMetadata(current.metadata) ? current.metadata : null,
  });

  await db
    .update(payments)
    .set({
      status: "refunded",
      metadata: normalizeMetadata(
        isPaymentMetadata(current.metadata) ? current.metadata : null,
        providerResult.metadata,
        { refunded: true },
      ),
      updated_at: new Date(),
    })
    .where(eq(payments.id, current.id));

  const refreshed = await getPaymentById(db, current.id);
  if (!refreshed) {
    throw createHttpError(500, "Payment could not be loaded");
  }

  return serializePayment(refreshed);
}

export function parsePaymentMetadata(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  if (!isPaymentMetadata(value)) {
    throw createHttpError(400, "metadata must be an object");
  }
  return value;
}
