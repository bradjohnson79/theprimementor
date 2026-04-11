export interface BookingNotificationPayload {
  bookingId: string;
  userId: string;
  bookingTypeId: string;
  startTimeUtc: string;
  endTimeUtc: string;
}

export async function sendBookingConfirmedNotification(_payload: BookingNotificationPayload): Promise<void> {
  // Email delivery is intentionally scaffolded for a later pass.
}

export async function sendBookingCancelledNotification(_payload: BookingNotificationPayload): Promise<void> {
  // Reminder/cancellation delivery is intentionally scaffolded for a later pass.
}
