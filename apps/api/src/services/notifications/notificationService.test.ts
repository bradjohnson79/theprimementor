import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_NOTIFICATION_EVENTS,
  getNotificationEntityId,
  getNotificationRecipientType,
} from "./events.js";
import { previewNotification } from "./notificationPreview.js";
import { getNotificationDeliveryPolicy } from "./deliveryPolicy.js";

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
  assert.equal(preview.templateVersion, "admin-test-v1");
  assert.match(preview.subject, /Admin test notification/i);
  assert.match(preview.html, /Pipeline check/i);
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
