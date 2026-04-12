import type { Database } from "@wisdom/db";
import { logger } from "@wisdom/utils";
import { sendNotification } from "../notifications/notificationService.js";

export interface BookingNotificationPayload {
  bookingId: string;
  userId: string;
  bookingType: string;
  timezone: string;
  fullName?: string | null;
  email?: string | null;
  startTimeUtc?: string;
  endTimeUtc?: string;
  eventId?: string | null;
  eventTitle?: string | null;
  joinUrl?: string | null;
  accessPagePath?: string | null;
}

export async function sendBookingCreatedNotification(
  db: Database,
  payload: BookingNotificationPayload,
): Promise<void> {
  await sendNotification(db, {
    event: "booking.created",
    userId: payload.userId,
    payload: {
      entityId: payload.bookingId,
      bookingId: payload.bookingId,
      bookingType: payload.bookingType,
      fullName: payload.fullName ?? null,
      timezone: payload.timezone,
      eventId: payload.eventId ?? null,
      eventTitle: payload.eventTitle ?? null,
    },
  });
}

export async function sendAdminNewBookingNotification(
  db: Database,
  payload: BookingNotificationPayload,
): Promise<void> {
  await sendNotification(db, {
    event: "admin.new.booking",
    payload: {
      entityId: payload.bookingId,
      bookingId: payload.bookingId,
      bookingType: payload.bookingType,
      userEmail: payload.email ?? null,
      fullName: payload.fullName ?? null,
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

  await sendNotification(db, {
    event: "booking.confirmed",
    userId: payload.userId,
    payload: {
      entityId: payload.bookingId,
      bookingId: payload.bookingId,
      bookingType: payload.bookingType,
      startTimeUtc: payload.startTimeUtc,
      endTimeUtc: payload.endTimeUtc,
      timezone: payload.timezone,
      eventId: payload.eventId ?? null,
      eventTitle: payload.eventTitle ?? null,
      joinUrl: payload.joinUrl ?? null,
      accessPagePath: payload.accessPagePath ?? null,
    },
  });
}

export async function sendBookingCancelledNotification(_payload: BookingNotificationPayload): Promise<void> {
  // Booking cancellation email delivery remains intentionally disabled until cancellation copy is approved.
}
