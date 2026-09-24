import test from "node:test";
import assert from "node:assert/strict";
import {
  metricRowsFromHits,
  metricRowsFromStats,
  seriesFromGoatCounterStats,
} from "./goatcounterClient.js";

test("metricRowsFromHits keeps page paths and drops events", () => {
  const rows = metricRowsFromHits([
    { path: "/reports", title: "Reports", count: 30, event: false },
    { path: "cta_click", title: "cta", count: 12, event: true },
    { path: "/sessions", count: 10, event: false },
  ], false);

  assert.deepEqual(rows.map((row) => row.label), ["/reports", "/sessions"]);
  assert.equal(rows[0]?.share, 75);
  assert.equal(rows[0]?.bounceRate, 0);
});

test("metricRowsFromHits can isolate events", () => {
  const rows = metricRowsFromHits([
    { path: "/reports", count: 30, event: false },
    { path: "purchase", count: 4, event: true },
    { path: "cta_click", count: 6, event: true },
  ], true);

  assert.deepEqual(rows.map((row) => row.label), ["purchase", "cta_click"]);
  assert.equal(rows[1]?.share, 60);
});

test("metricRowsFromStats maps name and share", () => {
  const rows = metricRowsFromStats([
    { name: "Direct", count: 8 },
    { name: "youtube.com", count: 2 },
  ]);

  assert.equal(rows[0]?.label, "Direct");
  assert.equal(rows[0]?.share, 80);
  assert.equal(rows[1]?.visitors, 2);
});

test("seriesFromGoatCounterStats expands hourly and daily rows", () => {
  const hourly = seriesFromGoatCounterStats([
    { day: "2026-09-23", hourly: [1, 2] },
  ], "hour");
  assert.equal(hourly[1]?.timestamp, "2026-09-23T01:00:00.000Z");
  assert.equal(hourly[1]?.value, 2);

  const daily = seriesFromGoatCounterStats([
    { day: "2026-09-22", daily: 11 },
  ], "day");
  assert.equal(daily[0]?.timestamp, "2026-09-22");
  assert.equal(daily[0]?.value, 11);
});
