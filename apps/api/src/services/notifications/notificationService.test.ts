import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_NOTIFICATION_EVENTS,
  describeNotificationEvent,
  getNotificationEntityId,
  getNotificationRecipientType,
} from "./events.js";
import { previewNotification } from "./notificationPreview.js";
import { getNotificationDeliveryPolicy } from "./deliveryPolicy.js";
import { getSamplePayload } from "./samplePayloads.js";
import {
  renderBookingConfirmedTemplate,
  renderBookingCreatedTemplate,
  renderReportGeneratedTemplate,
} from "./templates/userTemplates.js";
import { renderAdminNewBookingTemplate } from "./templates/adminTemplates.js";

test("notification events map to the correct recipient types", () => {
  assert.equal(getNotificationRecipientType("payment.succeeded"), "user");
  assert.equal(getNotificationRecipientType("booking.confirmed"), "user");
  assert.equal(getNotificationRecipientType("admin.payment.received"), "admin");
  assert.equal(getNotificationRecipientType("admin.test"), "admin");
  assert.equal(ALL_NOTIFICATION_EVENTS.includes("admin.test"), true);
});

test("notification previews expose template metadata", () => {
  const preview = previewNotification({
    event: "admin.test",
    payload: {
      entityId: "admin_test_preview",
      message: "Pipeline check",
    },
  });

  assert.equal(preview.recipientType, "admin");
  assert.equal(preview.templateVersion, "admin-test-v2");
  assert.match(preview.subject, /Admin test notification/i);
  assert.match(preview.html, /Pipeline check/i);
  assert.match(preview.html, /The Prime Mentor/i);
});

test("notification event descriptors expose stable UI metadata", () => {
  const descriptor = describeNotificationEvent("booking.confirmed");

  assert.equal(descriptor.event, "booking.confirmed");
  assert.equal(descriptor.label, "Booking Confirmed");
  assert.equal(descriptor.recipientType, "user");
  assert.equal(descriptor.configurable, true);
});

test("sample payloads are generated from the typed notification event map", () => {
  const payload = getSamplePayload("booking.confirmed");

  assert.equal(payload.bookingType, "Mentoring Circle");
  assert.equal(typeof payload.startTimeUtc, "string");
  assert.equal(payload.joinUrl, "https://zoom.us/test");
});

test("entity ids are derived from typed payloads", () => {
  const entityId = getNotificationEntityId("report.generated", {
    entityId: "report_123",
    orderId: "order_123",
    reportId: "report_123",
    title: "Blueprint Report",
    reportTier: "intro",
  });

  assert.equal(entityId, "report_123");
});

test("non-production delivery policy defaults to suppression", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRedirect = process.env.NOTIFICATION_REDIRECT_EMAILS;

  process.env.NODE_ENV = "development";
  delete process.env.NOTIFICATION_REDIRECT_EMAILS;

  const policy = getNotificationDeliveryPolicy();

  assert.equal(policy.mode, "suppressed");
  assert.match(policy.label, /suppressed/i);

  process.env.NODE_ENV = originalNodeEnv;
  if (originalRedirect === undefined) {
    delete process.env.NOTIFICATION_REDIRECT_EMAILS;
  } else {
    process.env.NOTIFICATION_REDIRECT_EMAILS = originalRedirect;
  }
});

test("non-production delivery policy redirects when a safe inbox is configured", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRedirect = process.env.NOTIFICATION_REDIRECT_EMAILS;

  process.env.NODE_ENV = "development";
  process.env.NOTIFICATION_REDIRECT_EMAILS = "safe@example.com";

  const policy = getNotificationDeliveryPolicy();

  assert.equal(policy.mode, "redirected");
  assert.deepEqual(policy.redirectRecipients, ["safe@example.com"]);

  process.env.NODE_ENV = originalNodeEnv;
  if (originalRedirect === undefined) {
    delete process.env.NOTIFICATION_REDIRECT_EMAILS;
  } else {
    process.env.NOTIFICATION_REDIRECT_EMAILS = originalRedirect;
  }
});

test("booking confirmed template falls back to TBD for missing schedule fields", () => {
  const rendered = renderBookingConfirmedTemplate({
    entityId: "booking_sparse",
    bookingId: "booking_sparse",
    bookingType: "Mentoring Circle",
    startTimeUtc: "",
    endTimeUtc: "",
    timezone: "",
  });

  assert.match(rendered.html, /Your session access is ready/i);
  assert.match(rendered.html, /Start[\s\S]*TBD/i);
  assert.match(rendered.html, /End[\s\S]*TBD/i);
  assert.match(rendered.html, /Timezone[\s\S]*TBD/i);
  assert.match(rendered.html, /Open Mentoring Circle Page/i);
});

test("admin booking template falls back safely when optional fields are missing", () => {
  const rendered = renderAdminNewBookingTemplate({
    entityId: "admin_booking_sparse",
    bookingId: "",
    bookingType: "",
  });

  assert.match(rendered.subject, /booking/i);
  assert.match(rendered.html, /The Prime Mentor/i);
  assert.match(rendered.html, /Customer[\s\S]*Unavailable/i);
  assert.match(rendered.html, /Booking reference[\s\S]*Unavailable/i);
  assert.match(rendered.html, /Timezone[\s\S]*TBD/i);
  assert.match(rendered.html, /Open Bookings/i);
});

test("admin booking template renders submitted availability and customer email", () => {
  const rendered = renderAdminNewBookingTemplate({
    entityId: "admin_booking_availability",
    bookingId: "booking_availability",
    bookingType: "Focus Session",
    fullName: "Craig Stickler",
    userEmail: "craig@example.com",
    timezone: "America/Vancouver",
    availability: {
      monday: ["10:00", "11:00"],
      wednesday: ["15:00"],
    },
  });

  assert.match(rendered.html, /Customer email[\s\S]*craig@example.com/i);
  assert.match(rendered.html, /Submitted availability/i);
  assert.match(rendered.html, /Monday[\s\S]*10am, 11am/i);
  assert.match(rendered.html, /Wednesday[\s\S]*3pm/i);
  assert.doesNotMatch(rendered.html, /Start[\s\S]*TBD/i);
});

test("customer booking template includes customer details", () => {
  const rendered = renderBookingCreatedTemplate({
    entityId: "booking_customer_details",
    bookingId: "booking_customer_details",
    bookingType: "Mentoring Circle",
    fullName: "Craig Stickler",
    email: "craig@example.com",
    timezone: "America/Vancouver",
    eventTitle: "Mentoring Circle Webinar",
  });

  assert.match(rendered.html, /Name[\s\S]*Craig Stickler/i);
  assert.match(rendered.html, /Email[\s\S]*craig@example.com/i);
});

test("report generated template includes customer name and email", () => {
  const rendered = renderReportGeneratedTemplate({
    entityId: "report_customer_details",
    orderId: "order_customer_details",
    reportId: "report_customer_details",
    title: "Blueprint Report",
    reportTier: "intro",
    fullName: "Craig Stickler",
    email: "craig@example.com",
  });

  assert.match(rendered.html, /Name[\s\S]*Craig Stickler/i);
  assert.match(rendered.html, /Email[\s\S]*craig@example.com/i);
});
