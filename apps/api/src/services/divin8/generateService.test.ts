import assert from "node:assert/strict";
import test from "node:test";
import { validateGenerateRequest } from "../blueprint/schemas.js";
import { normalizeBlueprintBirthPlace, resolveBlueprintClient } from "./generateService.js";

test("resolveBlueprintClient uses clientId as the primary identifier", async () => {
  let emailFallbackCalls = 0;
  const client = await resolveBlueprintClient(
    { clientId: "client-123", email: "client@example.com" },
    {
      findByClientId: async (clientId) => ({
        id: clientId,
        user_id: "user-1",
        email: "client@example.com",
        full_birth_name: "Craig Stickler",
        birth_date: "1988-04-12",
        birth_time: "10:15",
        birth_location: "Vancouver, BC, Canada",
      }),
      findByEmail: async () => {
        emailFallbackCalls += 1;
        return null;
      },
    },
  );

  assert.equal(client?.id, "client-123");
  assert.equal(emailFallbackCalls, 0);
});

test("resolveBlueprintClient falls back to email when the provided clientId misses", async () => {
  const client = await resolveBlueprintClient(
    { clientId: "user-shaped-id", email: "client@example.com" },
    {
      findByClientId: async () => null,
      findByEmail: async (email) => ({
        id: "client-456",
        user_id: "user-1",
        email,
        full_birth_name: "Craig Stickler",
        birth_date: "1988-04-12",
        birth_time: "10:15",
        birth_location: "Vancouver, BC, Canada",
      }),
    },
  );

  assert.equal(client?.id, "client-456");
  assert.equal(client?.email, "client@example.com");
});

test("resolveBlueprintClient returns null cleanly when no client record exists", async () => {
  const client = await resolveBlueprintClient(
    { clientId: "missing-client", email: "missing@example.com" },
    {
      findByClientId: async () => null,
      findByEmail: async () => null,
    },
  );

  assert.equal(client, null);
});

test("validateGenerateRequest rejects client mode requests without a clientId", () => {
  const validation = validateGenerateRequest({
    mode: "client",
    email: "client@example.com",
    timezone: "America/Vancouver",
    includeSystems: ["numerology"],
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.error, "clientId (string) is required for client mode");
});

test("normalizeBlueprintBirthPlace extracts a human-readable address from JSON payloads", () => {
  const normalized = normalizeBlueprintBirthPlace(
    JSON.stringify({
      formattedAddress: "Vancouver, BC, Canada",
      latitude: 49.2827,
      longitude: -123.1207,
    }),
  );

  assert.equal(normalized, "Vancouver, BC, Canada");
});
