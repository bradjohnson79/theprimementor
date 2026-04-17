import type { NotificationEvent, NotificationPayload, NotificationPayloadMap } from "./events.js";

type SamplePayloadFactoryMap = {
  [TEvent in NotificationEvent]: () => NotificationPayload<TEvent>;
};

const SAMPLE_PAYLOAD_FACTORIES: SamplePayloadFactoryMap = {
  "payment.succeeded": () => ({
    entityId: "payment_sample_succeeded",
    paymentId: "pay_sample_succeeded",
    amount: 25,
    currency: "cad",
    product: "Mentoring Circle",
    orderId: "order_sample_succeeded",
  }),
  "payment.failed": () => ({
    entityId: "payment_sample_failed",
    paymentId: "pay_sample_failed",
    amount: 25,
    currency: "cad",
    product: "Mentoring Circle",
    reason: "Card declined",
    orderId: "order_sample_failed",
  }),
  "booking.created": () => ({
    entityId: "booking_sample_created",
    bookingId: "booking_sample_created",
    bookingType: "Mentoring Circle",
    fullName: "Brad",
    email: "brad@example.com",
    timezone: "America/Los_Angeles",
    eventId: "event_sample_created",
    eventTitle: "Mentoring Circle",
  }),
  "booking.confirmed": () => {
    const start = new Date("2026-04-26T16:00:00.000Z");
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return {
      entityId: "booking_sample_confirmed",
      bookingId: "booking_sample_confirmed",
      bookingType: "Mentoring Circle",
      startTimeUtc: start.toISOString(),
      endTimeUtc: end.toISOString(),
      timezone: "America/Los_Angeles",
      fullName: "Brad",
      email: "brad@example.com",
      eventId: "event_sample_confirmed",
      eventTitle: "Mentoring Circle",
      joinUrl: "https://zoom.us/test",
      accessPagePath: "/mentoring-circle",
    };
  },
  "mentoring_circle.confirmed": () => {
    const start = new Date("2026-04-26T16:00:00.000Z");
    const end = new Date(start.getTime() + 90 * 60 * 1000);
    return {
      entityId: "mentoring_circle_confirmed_sample",
      bookingId: "booking_mentoring_circle_confirmed",
      eventId: "2026-04-26",
      eventTitle: "Mentoring Circle: The Prime Law",
      startTimeUtc: start.toISOString(),
      endTimeUtc: end.toISOString(),
      timezone: "America/Vancouver",
      fullName: "Brad",
      email: "brad@example.com",
      joinUrl: "https://us02web.zoom.us/meeting/register/example",
      accessPagePath: "/mentoring-circle",
    };
  },
  "mentoring_circle.reminder_24h": () => ({
    entityId: "mentoring_circle_reminder_24h_sample",
    bookingId: "booking_mentoring_circle_reminder_24h",
    eventId: "2026-04-26",
    eventTitle: "Mentoring Circle: The Prime Law",
    startTimeUtc: new Date("2026-04-26T16:00:00.000Z").toISOString(),
    timezone: "America/Vancouver",
    fullName: "Brad",
    email: "brad@example.com",
    joinUrl: "https://us02web.zoom.us/meeting/register/example",
    accessPagePath: "/mentoring-circle",
  }),
  "mentoring_circle.reminder_1h": () => ({
    entityId: "mentoring_circle_reminder_1h_sample",
    bookingId: "booking_mentoring_circle_reminder_1h",
    eventId: "2026-04-26",
    eventTitle: "Mentoring Circle: The Prime Law",
    startTimeUtc: new Date("2026-04-26T16:00:00.000Z").toISOString(),
    timezone: "America/Vancouver",
    fullName: "Brad",
    email: "brad@example.com",
    joinUrl: "https://us02web.zoom.us/meeting/register/example",
    accessPagePath: "/mentoring-circle",
  }),
  "report.generated": () => ({
    entityId: "report_sample_generated",
    orderId: "order_sample_report",
    reportId: "report_sample_generated",
    title: "Blueprint Report",
    reportTier: "intro",
    fullName: "Brad",
    email: "brad@example.com",
  }),
  "admin.payment.received": () => ({
    entityId: "admin_payment_sample",
    paymentId: "pay_admin_sample",
    amount: 25,
    currency: "cad",
    product: "Mentoring Circle",
    userEmail: "test@example.com",
  }),
  "admin.new.booking": () => ({
    entityId: "admin_booking_sample",
    bookingId: "booking_admin_sample",
    bookingType: "Mentoring Circle",
    userEmail: "test@example.com",
    fullName: "Brad",
    availability: {
      monday: ["10:00", "11:00"],
      wednesday: ["15:00"],
    },
    eventId: "event_admin_booking_sample",
    eventTitle: "Mentoring Circle",
    startTimeUtc: new Date("2026-04-26T16:00:00.000Z").toISOString(),
    timezone: "America/Los_Angeles",
  }),
  "admin.new.user": () => ({
    entityId: "admin_user_sample",
    clerkId: "user_sample_clerk",
    email: "newuser@example.com",
    name: "Preview User",
  }),
  "admin.test": () => ({
    entityId: "admin_test_sample",
    message: "Notification pipeline verified.",
    initiatedByUserId: null,
  }),
};

export function getSamplePayload<TEvent extends NotificationEvent>(event: TEvent): NotificationPayload<TEvent> {
  return SAMPLE_PAYLOAD_FACTORIES[event]() as NotificationPayload<TEvent>;
}

export function getAllSamplePayloads() {
  const entries = Object.entries(SAMPLE_PAYLOAD_FACTORIES).map(([event, factory]) => [
    event,
    factory(),
  ]);

  return Object.fromEntries(entries) as { [TEvent in NotificationEvent]: NotificationPayloadMap[TEvent] };
}
