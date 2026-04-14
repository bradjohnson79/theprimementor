import assert from "node:assert/strict";
import test from "node:test";
import { resolveBookingNotificationContact } from "./notificationService.js";

test("resolveBookingNotificationContact prefers explicit payload values", () => {
  const resolved = resolveBookingNotificationContact({
    explicitFullName: "Explicit Name",
    bookingFullName: "Booking Name",
    clientFullName: "Client Name",
    explicitEmail: "explicit@example.com",
    bookingEmail: "booking@example.com",
    userEmail: "user@example.com",
  });

  assert.deepEqual(resolved, {
    fullName: "Explicit Name",
    email: "explicit@example.com",
  });
});

test("resolveBookingNotificationContact falls back to booking, client, and user sources", () => {
  const resolved = resolveBookingNotificationContact({
    explicitFullName: null,
    bookingFullName: null,
    clientFullName: "Client Profile Name",
    explicitEmail: null,
    bookingEmail: null,
    userEmail: "account@example.com",
  });

  assert.deepEqual(resolved, {
    fullName: "Client Profile Name",
    email: "account@example.com",
  });
});
