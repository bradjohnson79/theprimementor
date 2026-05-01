import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  bookingTypes,
  bookings,
  clients,
  orders,
  payments,
  type Database,
} from "@wisdom/db";
import { createHttpError } from "./booking/errors.js";
import { parseOrderId } from "./ordersService.js";

type DbExecutor = Pick<Database, "select" | "insert" | "update">;

interface PersistedSessionOrderContext {
  id: string;
  userId: string;
  sessionType: string;
  bookingTypeName: string | null;
  amountCents: number;
  currency: string;
  startTimeUtc: Date | null;
  joinUrl: string | null;
  startUrl: string | null;
  bookingStatus: string;
}

export interface MemberRecordingSummary {
  orderId: string;
  orderNumber: string;
  sessionDate: string | null;
  recordingLink: string;
  createdAt: string;
}

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeUrl(link: string) {
  const value = link.trim();
  if (!value) {
    throw createHttpError(400, "Recording link is required.");
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("unsupported");
    }
    return parsed.toString();
  } catch {
    throw createHttpError(400, "Recording link must be a valid URL.");
  }
}

function buildSessionOrderLabel(context: PersistedSessionOrderContext) {
  return context.bookingTypeName?.trim()
    || (context.sessionType === "qa_session"
      ? "Q&A Session"
      : context.sessionType
        ? `${titleCase(context.sessionType)} Session`
        : "Session");
}

async function getLatestClientIdForUser(db: DbExecutor, userId: string) {
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.user_id, userId))
    .orderBy(desc(clients.created_at))
    .limit(1);

  return client?.id ?? null;
}

async function getPersistedSessionOrderByBookingId(db: DbExecutor, bookingId: string) {
  const [existing] = await db
    .select()
    .from(orders)
    .where(and(
      eq(orders.type, "session"),
      or(
        eq(orders.id, bookingId),
        sql`coalesce(${orders.metadata}->>'bookingId', ${orders.metadata}->>'booking_id') = ${bookingId}`,
      ),
    ))
    .limit(1);

  return existing ?? null;
}

async function getPersistableSessionContext(db: DbExecutor, bookingId: string): Promise<PersistedSessionOrderContext> {
  const [booking] = await db
    .select({
      id: bookings.id,
      userId: bookings.user_id,
      sessionType: bookings.session_type,
      bookingTypeName: bookingTypes.name,
      amountCents: bookingTypes.price_cents,
      currency: bookingTypes.currency,
      startTimeUtc: bookings.start_time_utc,
      joinUrl: bookings.join_url,
      startUrl: bookings.start_url,
      bookingStatus: bookings.status,
    })
    .from(bookings)
    .innerJoin(bookingTypes, eq(bookings.booking_type_id, bookingTypes.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking) {
    throw createHttpError(404, "Order not found");
  }

  return booking;
}

async function getLatestPaidBookingPayment(db: DbExecutor, bookingId: string) {
  const [payment] = await db
    .select({
      amountCents: payments.amount_cents,
      currency: payments.currency,
      providerPaymentIntentId: payments.provider_payment_intent_id,
      metadata: payments.metadata,
      status: payments.status,
    })
    .from(payments)
    .where(and(
      eq(payments.booking_id, bookingId),
      eq(payments.status, "paid"),
    ))
    .orderBy(desc(payments.created_at))
    .limit(1);

  return payment ?? null;
}

function getCheckoutSessionId(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const raw = (metadata as Record<string, unknown>).stripeCheckoutSessionId;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function getPromoMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {
      promoCode: null,
      promoCodeId: null,
      stripePromotionCodeId: null,
    };
  }
  const raw = metadata as Record<string, unknown>;
  return {
    promoCode: typeof raw.promoCode === "string" && raw.promoCode.trim() ? raw.promoCode.trim() : null,
    promoCodeId: typeof raw.promoCodeId === "string" && raw.promoCodeId.trim() ? raw.promoCodeId.trim() : null,
    stripePromotionCodeId: typeof raw.stripePromotionCodeId === "string" && raw.stripePromotionCodeId.trim()
      ? raw.stripePromotionCodeId.trim()
      : null,
  };
}

export async function ensurePersistedSessionOrder(db: DbExecutor, bookingId: string) {
  const existing = await getPersistedSessionOrderByBookingId(db, bookingId);
  if (existing) {
    return existing;
  }

  const booking = await getPersistableSessionContext(db, bookingId);
  const payment = await getLatestPaidBookingPayment(db, bookingId);
  if (!payment) {
    throw createHttpError(400, "Paid session order not found");
  }

  const clientId = await getLatestClientIdForUser(db, booking.userId);
  const paymentReference = payment.providerPaymentIntentId
    ?? getCheckoutSessionId(payment.metadata)
    ?? `session_booking_${booking.id}`;
  const promo = getPromoMetadata(payment.metadata);

  const [created] = await db
    .insert(orders)
    .values({
      id: booking.id,
      user_id: booking.userId,
      client_id: clientId,
      invoice_id: null,
      subscription_id: null,
      type: "session",
      label: buildSessionOrderLabel(booking),
      amount: payment.amountCents ?? booking.amountCents,
      currency: payment.currency ?? booking.currency,
      status: "completed",
      payment_reference: paymentReference,
      stripe_payment_intent_id: payment.providerPaymentIntentId ?? null,
      stripe_subscription_id: null,
      metadata: {
        source: "session_purchase_alignment",
        bookingId: booking.id,
        sessionType: booking.sessionType,
        sessionTier: booking.sessionType === "qa_session" ? "entry" : null,
        upgradeEligible: booking.sessionType === "qa_session",
        upgradeTarget: booking.sessionType === "qa_session" ? ["focus", "mentoring"] : [],
        scheduledAt: booking.startTimeUtc?.toISOString() ?? null,
        meetingLink: booking.joinUrl ?? booking.startUrl ?? null,
        bookingTypeName: booking.bookingTypeName,
        bookingStatus: booking.bookingStatus,
        promoCode: promo.promoCode,
        promoCodeId: promo.promoCodeId,
        stripePromotionCodeId: promo.stripePromotionCodeId,
      },
    })
    .onConflictDoNothing({ target: orders.id })
    .returning();

  if (created) {
    return created;
  }

  const duplicate = await getPersistedSessionOrderByBookingId(db, bookingId);
  if (duplicate) {
    return duplicate;
  }

  throw new Error(`Persisted session order could not be created for booking ${bookingId}`);
}

export async function upsertOrderRecordingLink(
  db: DbExecutor,
  input: {
    orderId: string;
    link: string;
  },
) {
  const parsed = parseOrderId(input.orderId);
  if (parsed.type !== "session") {
    throw createHttpError(400, "Recordings can only be attached to session orders.");
  }

  const persistedOrder = await ensurePersistedSessionOrder(db, parsed.sourceId);
  const normalizedLink = normalizeUrl(input.link);
  const now = new Date();

  const [updated] = await db
    .update(orders)
    .set({
      recording_link: normalizedLink,
      recording_added_at: now,
      updated_at: now,
    })
    .where(eq(orders.id, persistedOrder.id))
    .returning();

  if (!updated) {
    throw createHttpError(404, "Order not found");
  }

  return updated;
}

export async function listRecordingsForUser(db: DbExecutor, userId: string): Promise<MemberRecordingSummary[]> {
  const rows = await db
    .select({
      id: orders.id,
      type: orders.type,
      recordingLink: orders.recording_link,
      recordingAddedAt: orders.recording_added_at,
      metadata: orders.metadata,
      createdAt: orders.created_at,
    })
    .from(orders)
    .where(and(
      eq(orders.user_id, userId),
      eq(orders.type, "session"),
      sql`${orders.recording_link} is not null`,
      eq(orders.archived, false),
    ))
    .orderBy(desc(orders.recording_added_at), desc(orders.created_at));

  return rows
    .filter((row): row is typeof row & { recordingLink: string } => Boolean(row.recordingLink))
    .map((row) => {
      const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata as Record<string, unknown>
        : {};
      const scheduledAt = typeof metadata.scheduledAt === "string" && metadata.scheduledAt.trim()
        ? metadata.scheduledAt
        : null;

      return {
        orderId: `${row.type}_${row.id}`,
        orderNumber: `${row.type}_${row.id}`,
        sessionDate: scheduledAt,
        recordingLink: row.recordingLink,
        createdAt: (row.recordingAddedAt ?? row.createdAt).toISOString(),
      };
    });
}
