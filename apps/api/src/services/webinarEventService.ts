import { and, desc, eq } from "drizzle-orm";
import { bookings, mentoringCircleRegistrations, payments, type Database } from "@wisdom/db";
import {
  ADRONIS_WEBINAR_BOOKING_TYPE_ID,
  ADRONIS_WEBINAR_THANK_YOU_PATH,
  formatAdronisWebinarPrice,
  getAdronisWebinarPublicCatalog,
} from "@wisdom/utils";
import { createHttpError } from "./booking/errors.js";
import {
  ADRONIS_WEBINAR_EVENT,
  getWebinarEventById,
  isWebinarRegistrationOpen,
  listWebinarEvents,
  type WebinarEventDefinition,
} from "../config/webinarEvents.js";

export const WEBINAR_EVENT_BOOKING_TYPE_ID = ADRONIS_WEBINAR_BOOKING_TYPE_ID;

export type WebinarPurchaseStatus = "not_started" | "pending_payment" | "confirmed";
export type WebinarAccessStatus = "locked" | "pending_payment" | "confirmed";

export interface WebinarPublicCatalog {
  eventId: string;
  eventKey: string;
  title: string;
  presenter: string;
  description: string;
  featureBullets: string[];
  startsAt: string;
  registrationClosesAt: string;
  displayDate: string;
  displayTime: string;
  timezone: string;
  priceCents: number;
  currency: string;
  displayPrice: string;
  posterPath: string;
  posterAlt: string;
  checkoutPath: string;
  thankYouPath: string;
  registrationOpen: boolean;
}

export interface WebinarEventState extends WebinarPublicCatalog {
  bookingId: string | null;
  paymentId: string | null;
  paymentStatus: string | null;
  purchaseStatus: WebinarPurchaseStatus;
  accessStatus: WebinarAccessStatus;
  joinEligible: boolean;
  registered: boolean;
  zoomRegistrationUrl: string | null;
}

type RegistrationRow = typeof mentoringCircleRegistrations.$inferSelect;

export interface WebinarBookingAccessRow {
  bookingId: string;
  eventKey: string | null;
  status: string;
  joinUrl: string | null;
  paymentId: string | null;
  paymentStatus: string | null;
}

const CONFIRMED_BOOKING_STATUSES = new Set(["paid", "scheduled", "completed"]);

export function getWebinarEventOrThrow(eventId?: string | null): WebinarEventDefinition {
  const event = getWebinarEventById(eventId) ?? (eventId ? null : ADRONIS_WEBINAR_EVENT);
  if (!event) {
    throw createHttpError(404, "Webinar event not found");
  }
  return event;
}

export function toPublicWebinarCatalog(event: WebinarEventDefinition, now = new Date()): WebinarPublicCatalog {
  const catalog = event.eventId === ADRONIS_WEBINAR_EVENT.eventId
    ? getAdronisWebinarPublicCatalog(now)
    : {
      eventId: event.eventId,
      eventKey: event.eventKey,
      title: event.eventTitle,
      presenter: event.presenter,
      description: event.description,
      featureBullets: event.featureBullets,
      startsAt: event.eventStartAt,
      registrationClosesAt: event.registrationClosesAt,
      displayDate: event.displayDate,
      displayTime: event.displayTime,
      timezone: event.timezone,
      priceCents: event.priceCents,
      currency: event.currency,
      displayPrice: formatAdronisWebinarPrice(event.priceCents, event.currency),
      posterPath: event.posterPath,
      posterAlt: event.posterAlt,
      checkoutPath: `/webinars/${event.eventId}`,
      thankYouPath: event.thankYouPath,
      registrationOpen: isWebinarRegistrationOpen(event, now),
    };

  return catalog;
}

export function listPublicWebinarCatalog(now = new Date()) {
  return listWebinarEvents()
    .filter((event) => event.active && isWebinarRegistrationOpen(event, now))
    .map((event) => toPublicWebinarCatalog(event, now));
}

export function buildWebinarEventState(
  event: WebinarEventDefinition,
  booking: WebinarBookingAccessRow | null,
  registration: RegistrationRow | null,
  now = new Date(),
): WebinarEventState {
  const confirmed = booking ? CONFIRMED_BOOKING_STATUSES.has(booking.status) : false;
  const pending = booking?.status === "pending_payment" || booking?.paymentStatus === "pending";
  const joinEligible = confirmed;

  return {
    ...toPublicWebinarCatalog(event, now),
    bookingId: booking?.bookingId ?? null,
    paymentId: booking?.paymentId ?? null,
    paymentStatus: booking?.paymentStatus ?? null,
    purchaseStatus: confirmed ? "confirmed" : pending ? "pending_payment" : "not_started",
    accessStatus: confirmed ? "confirmed" : pending ? "pending_payment" : "locked",
    joinEligible,
    registered: confirmed,
    zoomRegistrationUrl: joinEligible ? (registration?.join_url ?? booking?.joinUrl ?? event.zoomRegistrationUrl) : null,
  };
}

async function getExistingRegistration(db: Database, userId: string, eventKey: string) {
  const [row] = await db
    .select()
    .from(mentoringCircleRegistrations)
    .where(and(
      eq(mentoringCircleRegistrations.user_id, userId),
      eq(mentoringCircleRegistrations.event_key, eventKey),
    ))
    .limit(1);
  return row ?? null;
}

export async function getLatestWebinarBookingAccessRow(
  db: Database,
  input: { userId: string; eventKey: string },
): Promise<WebinarBookingAccessRow | null> {
  const [row] = await db
    .select({
      bookingId: bookings.id,
      eventKey: bookings.event_key,
      status: bookings.status,
      joinUrl: bookings.join_url,
      paymentId: payments.id,
      paymentStatus: payments.status,
    })
    .from(bookings)
    .leftJoin(payments, eq(payments.booking_id, bookings.id))
    .where(and(
      eq(bookings.user_id, input.userId),
      eq(bookings.booking_type_id, WEBINAR_EVENT_BOOKING_TYPE_ID),
      eq(bookings.event_key, input.eventKey),
    ))
    .orderBy(desc(bookings.created_at), desc(payments.created_at))
    .limit(1);

  return row ?? null;
}

async function buildStateForEvent(
  db: Database,
  input: { userId: string; event: WebinarEventDefinition; now?: Date },
): Promise<WebinarEventState> {
  const booking = await getLatestWebinarBookingAccessRow(db, {
    userId: input.userId,
    eventKey: input.event.eventKey,
  });
  let registration = await getExistingRegistration(db, input.userId, input.event.eventKey);
  if (booking && CONFIRMED_BOOKING_STATUSES.has(booking.status) && !registration) {
    registration = await upsertWebinarRegistrationProjection(db, { bookingId: booking.bookingId });
  }

  return buildWebinarEventState(input.event, booking, registration, input.now);
}

export async function upsertWebinarRegistrationProjection(
  db: Database,
  input: { bookingId: string },
): Promise<RegistrationRow> {
  const [booking] = await db
    .select({
      bookingId: bookings.id,
      userId: bookings.user_id,
      eventKey: bookings.event_key,
      status: bookings.status,
      joinUrl: bookings.join_url,
    })
    .from(bookings)
    .where(eq(bookings.id, input.bookingId))
    .limit(1);

  if (!booking) {
    throw createHttpError(404, "Webinar booking not found");
  }

  const event = getWebinarEventOrThrow(booking.eventKey);
  if (!CONFIRMED_BOOKING_STATUSES.has(booking.status)) {
    throw createHttpError(400, "Webinar access is not confirmed");
  }

  const [upserted] = await db
    .insert(mentoringCircleRegistrations)
    .values({
      user_id: booking.userId,
      event_key: event.eventKey,
      event_title: event.eventTitle,
      event_start_at: new Date(event.eventStartAt),
      timezone: event.timezone,
      status: "registered",
      join_url: booking.joinUrl ?? event.zoomRegistrationUrl,
    })
    .onConflictDoUpdate({
      target: [mentoringCircleRegistrations.user_id, mentoringCircleRegistrations.event_key],
      set: {
        event_title: event.eventTitle,
        event_start_at: new Date(event.eventStartAt),
        timezone: event.timezone,
        status: "registered",
        join_url: booking.joinUrl ?? event.zoomRegistrationUrl,
        updated_at: new Date(),
      },
    })
    .returning();

  if (!upserted) {
    throw createHttpError(500, "Webinar registration could not be written");
  }

  return upserted;
}

export async function getWebinarStateForUser(
  db: Database,
  userId: string,
  eventId?: string | null,
): Promise<WebinarEventState> {
  const event = getWebinarEventOrThrow(eventId);
  return buildStateForEvent(db, { userId, event });
}

export async function getWebinarAccessForUser(
  db: Database,
  userId: string,
  eventId?: string | null,
): Promise<WebinarEventState> {
  const state = await getWebinarStateForUser(db, userId, eventId);
  if (!state.joinEligible || !state.zoomRegistrationUrl) {
    throw createHttpError(403, "Webinar access requires a verified purchase.");
  }
  return state;
}

export function getWebinarThankYouPath(eventId?: string | null) {
  const event = getWebinarEventOrThrow(eventId);
  return event.thankYouPath || ADRONIS_WEBINAR_THANK_YOU_PATH;
}
