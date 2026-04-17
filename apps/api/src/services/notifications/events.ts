export type NotificationEvent =
  | "payment.succeeded"
  | "payment.failed"
  | "booking.created"
  | "booking.confirmed"
  | "mentoring_circle.confirmed"
  | "mentoring_circle.reminder_24h"
  | "mentoring_circle.reminder_1h"
  | "report.generated"
  | "admin.payment.received"
  | "admin.new.booking"
  | "admin.new.user"
  | "admin.test";

export type NotificationRecipientType = "user" | "admin";
export type NotificationAvailability = Partial<Record<"monday" | "tuesday" | "wednesday" | "thursday", string[]>>;

export interface NotificationEventDescriptor {
  event: NotificationEvent;
  label: string;
  recipientType: NotificationRecipientType;
  configurable: boolean;
}

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
    email?: string | null;
    timezone: string;
    availability?: NotificationAvailability | null;
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
    fullName?: string | null;
    email?: string | null;
    eventId?: string | null;
    eventTitle?: string | null;
    joinUrl?: string | null;
    accessPagePath?: string | null;
  };
  "mentoring_circle.confirmed": {
    entityId: string;
    bookingId: string;
    eventId: string;
    eventTitle: string;
    startTimeUtc: string;
    endTimeUtc: string;
    timezone: string;
    fullName?: string | null;
    email?: string | null;
    joinUrl: string;
    accessPagePath?: string | null;
  };
  "mentoring_circle.reminder_24h": {
    entityId: string;
    bookingId: string;
    eventId: string;
    eventTitle: string;
    startTimeUtc: string;
    timezone: string;
    fullName?: string | null;
    email?: string | null;
    joinUrl: string;
    accessPagePath?: string | null;
  };
  "mentoring_circle.reminder_1h": {
    entityId: string;
    bookingId: string;
    eventId: string;
    eventTitle: string;
    startTimeUtc: string;
    timezone: string;
    fullName?: string | null;
    email?: string | null;
    joinUrl: string;
    accessPagePath?: string | null;
  };
  "report.generated": {
    entityId: string;
    orderId: string;
    reportId: string;
    title: string;
    reportTier?: string | null;
    fullName?: string | null;
    email?: string | null;
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
    availability?: NotificationAvailability | null;
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
  "mentoring_circle.confirmed",
  "mentoring_circle.reminder_24h",
  "mentoring_circle.reminder_1h",
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
  "mentoring_circle.confirmed",
  "mentoring_circle.reminder_24h",
  "mentoring_circle.reminder_1h",
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

export function getNotificationEventLabel(event: NotificationEvent) {
  return event.replace(/[._]/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

export function getNotificationRecipientType(event: NotificationEvent): NotificationRecipientType {
  return event.startsWith("admin.") ? "admin" : "user";
}

export function describeNotificationEvent(event: NotificationEvent): NotificationEventDescriptor {
  return {
    event,
    label: getNotificationEventLabel(event),
    recipientType: getNotificationRecipientType(event),
    configurable: CONFIGURABLE_NOTIFICATION_EVENTS.includes(event as ConfigurableNotificationEvent),
  };
}

export function getNotificationEntityId<TEvent extends NotificationEvent>(
  _event: TEvent,
  payload: NotificationPayload<TEvent>,
) {
  return payload.entityId;
}
