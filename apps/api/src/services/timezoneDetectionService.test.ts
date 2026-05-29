import assert from "node:assert/strict";
import test from "node:test";
import { detectTimezoneFromHeaders } from "./timezoneDetectionService.js";

test("detectTimezoneFromHeaders uses supported edge timezone headers", () => {
  assert.deepEqual(
    detectTimezoneFromHeaders({ "x-vercel-ip-timezone": "America/Los_Angeles" }),
    {
      timezone: "America/Los_Angeles",
      source: "edge_timezone",
    },
  );
});

test("detectTimezoneFromHeaders ignores unsupported timezone headers", () => {
  assert.deepEqual(
    detectTimezoneFromHeaders({ "x-vercel-ip-timezone": "America/Detroit" }),
    {
      timezone: null,
      source: null,
    },
  );
});

test("detectTimezoneFromHeaders falls back for single-zone countries", () => {
  assert.deepEqual(
    detectTimezoneFromHeaders({ "cf-ipcountry": "NZ" }),
    {
      timezone: "Pacific/Auckland",
      source: "country_fallback",
    },
  );
});
