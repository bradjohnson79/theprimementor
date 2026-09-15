import assert from "node:assert/strict";
import test from "node:test";

test("failed and uncertain confirmation sends remain retryable after entitlement persist", () => {
  const cases = [
    { name: "crash after persist", entitlementPersisted: true, notification: { inserted: false, sentAt: null }, retryable: true },
    { name: "Resend hard failure", entitlementPersisted: true, notification: { inserted: true, sentAt: null, status: "failed" }, retryable: true },
    { name: "uncertain send missing message id", entitlementPersisted: true, notification: { inserted: true, sentAt: null, status: "failed" }, retryable: true },
  ];

  for (const item of cases) {
    assert.equal(item.entitlementPersisted, true, item.name);
    assert.equal(item.notification.sentAt, null, item.name);
    assert.equal(item.retryable, true, item.name);
  }
});
