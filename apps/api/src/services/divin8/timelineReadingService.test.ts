import test from "node:test";
import assert from "node:assert/strict";
import { initSwissEphemeris } from "../blueprint/swissEphemerisService.js";
import { buildTimelineReading } from "./timelineReadingService.js";

test("timeline reading returns required report sections for a global range", async () => {
  await initSwissEphemeris();
  const reading = await buildTimelineReading({
    timeline: {
      tag: "#April1-5-2026",
      system: "vedic",
      startDate: "2026-04-01",
      endDate: "2026-04-05",
    },
    profiles: [],
  });

  assert.equal(reading.mode, "global_timeline_analysis");
  assert.match(reading.rendered, /^Timeline Analysis:/);
  assert.match(reading.rendered, /Systems: Vedic Astrology/);
  assert.match(reading.rendered, /Timeline Phases/);
  assert.match(reading.rendered, /Key Transits/);
  assert.match(reading.rendered, /Thematic Interpretation/);
});

test("timeline reading switches to compatibility mode for two profiles", async () => {
  await initSwissEphemeris();
  const reading = await buildTimelineReading({
    timeline: {
      tag: "#April1-7-2026",
      system: "western",
      startDate: "2026-04-01",
      endDate: "2026-04-07",
    },
    profiles: [
      {
        id: "profile-1",
        fullName: "John Example",
        tag: "@JohnExample",
        birthDate: "1990-04-03",
        birthTime: "06:45",
        birthPlace: "Vancouver, Canada",
        lat: 49.2827,
        lng: -123.1207,
        timezone: "America/Vancouver",
        createdAt: "2026-04-01T00:00:00.000Z",
      },
      {
        id: "profile-2",
        fullName: "Jane Example",
        tag: "@JaneExample",
        birthDate: "1991-09-10",
        birthTime: "08:15",
        birthPlace: "Toronto, Canada",
        lat: 43.6532,
        lng: -79.3832,
        timezone: "America/Toronto",
        createdAt: "2026-04-01T00:00:00.000Z",
      },
    ],
  });

  assert.equal(reading.mode, "compatibility_timeline_analysis");
  assert.match(reading.rendered, /@JohnExample and @JaneExample/);
});

test("timeline reading promotes multi-system compatibility mode for two profiles", async () => {
  await initSwissEphemeris();
  const reading = await buildTimelineReading({
    timeline: {
      tag: "#April1-7-2026",
      system: "vedic",
      startDate: "2026-04-01",
      endDate: "2026-04-07",
    },
    systems: ["vedic", "numerology", "chinese"],
    profiles: [
      {
        id: "profile-1",
        fullName: "John Example",
        tag: "@JohnExample",
        birthDate: "1990-04-03",
        birthTime: "06:45",
        birthPlace: "Vancouver, Canada",
        lat: 49.2827,
        lng: -123.1207,
        timezone: "America/Vancouver",
        createdAt: "2026-04-01T00:00:00.000Z",
      },
      {
        id: "profile-2",
        fullName: "Jane Example",
        tag: "@JaneExample",
        birthDate: "1991-09-10",
        birthTime: "08:15",
        birthPlace: "Toronto, Canada",
        lat: 43.6532,
        lng: -79.3832,
        timezone: "America/Toronto",
        createdAt: "2026-04-01T00:00:00.000Z",
      },
    ],
  });

  assert.equal(reading.mode, "timeline_multi_compatibility");
  assert.deepEqual(reading.systemsUsed, ["vedic", "numerology", "chinese"]);
  assert.match(reading.rendered, /Systems: Vedic Astrology \+ Numerology \+ Chinese Astrology/);
  assert.match(reading.rendered, /Numerology:/);
  assert.match(reading.rendered, /Chinese Astrology:/);
});
