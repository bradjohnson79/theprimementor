import { bookings, clients, users, type Database } from "@wisdom/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "@wisdom/utils";
import { sendNotification } from "../notifications/notificationService.js";
import type { BookingAvailability } from "./bookingConstants.js";

export interface BookingNotificationPayload {
  entityId?: string;
  bookingId: string;
  userId: string;
  bookingType: string;
  timezone: string;
  fullName?: string | null;
  email?: string | null;
  availability?: BookingAvailability | null;
  startTimeUtc?: string;
  endTimeUtc?: string;
  eventId?: string | null;
  eventTitle?: string | null;
  joinUrl?: string | null;
  accessPagePath?: string | null;
}

interface BookingNotificationContactInput {
  explicitFullName?: string | null;
  bookingFullName?: string | null;
  clientFullName?: string | null;
  explicitEmail?: string | null;
  bookingEmail?: string | null;
  userEmail?: string | null;
}

export function resolveBookingNotificationContact(input: BookingNotificationContactInput) {
  return {
    fullName: input.explicitFullName
      ?? input.bookingFullName
      ?? input.clientFullName
      ?? null,
    email: input.explicitEmail
      ?? input.bookingEmail
      ?? input.userEmail
      ?? null,
  };
}

async function getBookingNotificationContact(db: Database, payload: BookingNotificationPayload) {
  const [bookingRow, clientRow] = await Promise.all([
    db
      .select({
        bookingFullName: bookings.full_name,
        bookingEmail: bookings.email,
        userEmail: users.email,
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.user_id, users.id))
      .where(eq(bookings.id, payload.bookingId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        clientFullName: clients.full_birth_name,
      })
      .from(clients)
      .where(eq(clients.user_id, payload.userId))
      .orderBy(desc(clients.created_at))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  return resolveBookingNotificationContact({
    explicitFullName: payload.fullName,
    bookingFullName: bookingRow?.bookingFullName ?? null,
    clientFullName: clientRow?.clientFullName ?? null,
    explicitEmail: payload.email,
    bookingEmail: bookingRow?.bookingEmail ?? null,
    userEmail: bookingRow?.userEmail ?? null,
  });
}

export async function sendBookingCreatedNotification(
  db: Database,
  payload: BookingNotificationPayload,
): Promise<void> {
  const contact = await getBookingNotificationContact(db, payload);
  await sendNotification(db, {
    event: "booking.created",
    userId: payload.userId,
    payload: {
      entityId: payload.entityId ?? payload.bookingId,
      bookingId: payload.bookingId,
      bookingType: payload.bookingType,
      fullName: contact.fullName,
      email: contact.email,
      timezone: payload.timezone,
      availability: payload.availability ?? null,
      eventId: payload.eventId ?? null,
      eventTitle: payload.eventTitle ?? null,
    },
  });
}

export async function sendAdminNewBookingNotification(
  db: Database,
  payload: BookingNotificationPayload,
): Promise<void> {
  const contact = await getBookingNotificationContact(db, payload);

  await sendNotification(db, {
    event: "admin.new.booking",
    payload: {
      entityId: payload.entityId ?? payload.bookingId,
      bookingId: payload.bookingId,
      bookingType: payload.bookingType,
      userEmail: contact.email,
      fullName: contact.fullName,
      availability: payload.availability ?? null,
      eventId: payload.eventId ?? null,
      eventTitle: payload.eventTitle ?? null,
      startTimeUtc: payload.startTimeUtc ?? null,
      timezone: payload.timezone,
    },
  });
}

export async function sendBookingConfirmedNotification(
  db: Database,
  payload: BookingNotificationPayload,
): Promise<void> {
  if (!payload.startTimeUtc || !payload.endTimeUtc) {
    logger.warn("booking_notification_missing_schedule", {
      bookingId: payload.bookingId,
    });
    return;
  }

  const contact = await getBookingNotificationContact(db, payload);
  await sendNotification(db, {
    event: "booking.confirmed",
    userId: payload.userId,
    payload: {
      entityId: payload.entityId ?? payload.bookingId,
      bookingId: payload.bookingId,
      bookingType: payload.bookingType,
      startTimeUtc: payload.startTimeUtc,
      endTimeUtc: payload.endTimeUtc,
      timezone: payload.timezone,
      fullName: contact.fullName,
      email: contact.email,
      eventId: payload.eventId ?? null,
      eventTitle: payload.eventTitle ?? null,
      joinUrl: payload.joinUrl ?? null,
      accessPagePath: payload.accessPagePath ?? null,
    },
  });
}

export async function sendMentoringCircleConfirmedNotification(
  db: Database,
  payload: BookingNotificationPayload,
): Promise<void> {
  if (!payload.startTimeUtc || !payload.endTimeUtc || !payload.eventId || !payload.eventTitle || !payload.joinUrl) {
    logger.warn("mentoring_circle_notification_missing_schedule", {
      bookingId: payload.bookingId,
      eventId: payload.eventId ?? null,
    });
    return;
  }

  const contact = await getBookingNotificationContact(db, payload);
  await sendNotification(db, {
    event: "mentoring_circle.confirmed",
    userId: payload.userId,
    payload: {
      entityId: payload.entityId ?? payload.bookingId,
      bookingId: payload.bookingId,
      eventId: payload.eventId,
      eventTitle: payload.eventTitle,
      startTimeUtc: payload.startTimeUtc,
      endTimeUtc: payload.endTimeUtc,
      timezone: payload.timezone,
      fullName: contact.fullName,
      email: contact.email,
      joinUrl: payload.joinUrl,
      accessPagePath: payload.accessPagePath ?? null,
    },
  });
}

export async function sendMentoringCircleReminderNotification(
  db: Database,
  payload: BookingNotificationPayload & {
    reminderWindow: "24h" | "1h";
  },
): Promise<void> {
  if (!payload.startTimeUtc || !payload.eventId || !payload.eventTitle || !payload.joinUrl) {
    logger.warn("mentoring_circle_reminder_missing_schedule", {
      bookingId: payload.bookingId,
      eventId: payload.eventId ?? null,
      reminderWindow: payload.reminderWindow,
    });
    return;
  }

  const contact = await getBookingNotificationContact(db, payload);
  await sendNotification(db, {
    event: payload.reminderWindow === "24h"
      ? "mentoring_circle.reminder_24h"
      : "mentoring_circle.reminder_1h",
    userId: payload.userId,
    payload: {
      entityId: payload.entityId ?? `${payload.bookingId}:${payload.reminderWindow}`,
      bookingId: payload.bookingId,
      eventId: payload.eventId,
      eventTitle: payload.eventTitle,
      startTimeUtc: payload.startTimeUtc,
      timezone: payload.timezone,
      fullName: contact.fullName,
      email: contact.email,
      joinUrl: payload.joinUrl,
      accessPagePath: payload.accessPagePath ?? null,
    },
  });
}

export async function sendBookingCancelledNotification(_payload: BookingNotificationPayload): Promise<void> {
  // Booking cancellation email delivery remains intentionally disabled until cancellation copy is approved.
}
