import assert from "node:assert/strict";
import test from "node:test";
import { clearBirthLocationResolutionCache, resolveBirthLocationContext } from "./locationResolver.js";

test("resolveBirthLocationContext normalizes IST for Indian birthplaces", async () => {
  clearBirthLocationResolutionCache();

  const result = await resolveBirthLocationContext({
    birthLocation: "Belgaum, India",
    birthDate: "1987-10-01",
    birthTime: "04:58",
    timezone: "IST",
    coordinates: {
      latitude: 15.8497,
      longitude: 74.4977,
      formattedAddress: "Belgaum, Karnataka, India",
    },
  });

  assert.equal(result.timezone, "Asia/Kolkata");
  assert.equal(result.utcOffsetMinutes, 330);
});
