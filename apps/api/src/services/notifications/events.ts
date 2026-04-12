export type NotificationEvent =
  | "payment.succeeded"
  | "payment.failed"
  | "booking.created"
  | "booking.confirmed"
  | "report.generated"
  | "admin.payment.received"
  | "admin.new.booking"
  | "admin.new.user"
  | "admin.test";

export type NotificationRecipientType = "user" | "admin";

export interface NotificationPayloadMap {
  "payment.succeeded": {
    entityId: string;
    paymentId: string;
    amount: number;
    currency: string;
    product: string;
    orderId?: string | null;
  };
  "payment.failed": {
    entityId: string;
    paymentId: string;
    amount: number;
    currency: string;
    product: string;
    reason: string;
    orderId?: string | null;
  };
  "booking.created": {
    entityId: string;
    bookingId: string;
    bookingType: string;
    fullName?: string | null;
    timezone: string;
    eventId?: string | null;
    eventTitle?: string | null;
  };
  "booking.confirmed": {
    entityId: string;
    bookingId: string;
    bookingType: string;
    startTimeUtc: string;
    endTimeUtc: string;
    timezone: string;
    eventId?: string | null;
    eventTitle?: string | null;
    joinUrl?: string | null;
    accessPagePath?: string | null;
  };
  "report.generated": {
    entityId: string;
    orderId: string;
    reportId: string;
    title: string;
    reportTier?: string | null;
  };
  "admin.payment.received": {
    entityId: string;
    paymentId: string;
    amount: number;
    currency: string;
    product: string;
    userEmail?: string | null;
  };
  "admin.new.booking": {
    entityId: string;
    bookingId: string;
    bookingType: string;
    userEmail?: string | null;
    fullName?: string | null;
    eventId?: string | null;
    eventTitle?: string | null;
    startTimeUtc?: string | null;
    timezone?: string | null;
  };
  "admin.new.user": {
    entityId: string;
    clerkId: string;
    email: string;
    name?: string | null;
  };
  "admin.test": {
    entityId: string;
    message?: string | null;
    initiatedByUserId?: string | null;
  };
}

export type NotificationPayload<TEvent extends NotificationEvent> = NotificationPayloadMap[TEvent];

export type NotificationRequest<TEvent extends NotificationEvent = NotificationEvent> = {
  event: TEvent;
  userId?: string | null;
  payload: NotificationPayload<TEvent>;
};

export type NotificationPreviewRequest<TEvent extends NotificationEvent = NotificationEvent> = {
  event: TEvent;
  payload: NotificationPayload<TEvent>;
};

export const USER_NOTIFICATION_EVENTS = [
  "payment.succeeded",
  "payment.failed",
  "booking.created",
  "booking.confirmed",
  "report.generated",
] as const satisfies readonly NotificationEvent[];

export const ADMIN_NOTIFICATION_EVENTS = [
  "admin.payment.received",
  "admin.new.booking",
  "admin.new.user",
  "admin.test",
] as const satisfies readonly NotificationEvent[];

export const CONFIGURABLE_NOTIFICATION_EVENTS = [
  "payment.succeeded",
  "payment.failed",
  "booking.created",
  "booking.confirmed",
  "report.generated",
  "admin.payment.received",
  "admin.new.booking",
  "admin.new.user",
] as const satisfies readonly NotificationEvent[];

export type ConfigurableNotificationEvent = typeof CONFIGURABLE_NOTIFICATION_EVENTS[number];

export const ALL_NOTIFICATION_EVENTS = [
  ...CONFIGURABLE_NOTIFICATION_EVENTS,
  "admin.test",
] as const satisfies readonly NotificationEvent[];

export function getNotificationRecipientType(event: NotificationEvent): NotificationRecipientType {
  return event.startsWith("admin.") ? "admin" : "user";
}

export function getNotificationEntityId<TEvent extends NotificationEvent>(
  _event: TEvent,
  payload: NotificationPayload<TEvent>,
) {
  return payload.entityId;
}
