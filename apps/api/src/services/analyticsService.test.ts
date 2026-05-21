import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConversionPathInsights,
  buildStrategicRecommendations,
  loadInsightsSubsection,
  normalizeExpandedRows,
  type AnalyticsRangeWindow,
} from "./analyticsService.js";

const window: AnalyticsRangeWindow = {
  range: "7d",
  startAt: 1,
  endAt: 2,
  previousStartAt: -1,
  previousEndAt: 0,
  unit: "day",
  timezone: "America/Vancouver",
};

const logger = {
  warnings: [] as Array<{ payload: Record<string, unknown>; message: string }>,
  warn(payload: Record<string, unknown>, message: string) {
    this.warnings.push({ payload, message });
  },
};

function makeOverview(overrides: Record<string, unknown> = {}) {
  return {
    range: "7d" as const,
    status: "ok" as const,
    businessMetrics: {
      revenue: {
        currency: "CAD",
        value: 0,
        trend: { current: 0, previous: 0, delta: 0, deltaLabel: "0% vs previous period", direction: "neutral" as const },
      },
      orders: {
        value: 0,
        trend: { current: 0, previous: 1, delta: -100, deltaLabel: "-100% vs previous period", direction: "down" as const },
      },
      activeSubscriptions: {
        value: 0,
        trend: { current: 0, previous: 0, delta: 0, deltaLabel: "0% vs previous snapshot", direction: "neutral" as const },
      },
      sessionsBooked: {
        value: 0,
        trend: { current: 0, previous: 0, delta: 0, deltaLabel: "0% vs previous period", direction: "neutral" as const },
      },
    },
    recentActivity: [],
    conversionInsights: {
      ordersToday: 0,
      ordersThisWeek: 0,
      revenueThisMonth: 0,
      totalUsers: 0,
      totalClients: 0,
    },
    ...overrides,
  };
}

test("normalizeExpandedRows calculates share and bounce rate defensively", () => {
  const rows = normalizeExpandedRows([
    { name: "/reports", visitors: 30, pageviews: 80, visits: 40, bounces: 20 },
    { name: "/sessions", visitors: 10, pageviews: 25, visits: 0, bounces: 5 },
  ]);

  assert.equal(rows[0]?.share, 75);
  assert.equal(rows[0]?.bounceRate, 50);
  assert.equal(rows[1]?.share, 25);
  assert.equal(rows[1]?.bounceRate, 0);
});

test("buildConversionPathInsights keeps only configured routes and applies labels", () => {
  const rows = buildConversionPathInsights(normalizeExpandedRows([
    { name: "/reports", visitors: 12, pageviews: 30, visits: 15, bounces: 9 },
    { name: "/blog/how-to-meditate", visitors: 20, pageviews: 50, visits: 24, bounces: 2 },
    { name: "/sessions/regeneration", visitors: 8, pageviews: 18, visits: 10, bounces: 6 },
  ]));

  assert.deepEqual(rows.map((row) => row.path), ["/reports", "/sessions/regeneration"]);
  assert.equal(rows[0]?.routeLabel, "Divin8 Reports interest");
  assert.equal(rows[1]?.routeLabel, "Regeneration Monthly Package interest");
  assert.match(rows[1]?.frictionNote ?? "", /Worth reviewing/);
});

test("buildStrategicRecommendations uses soft factual wording", () => {
  const conversionPaths = buildConversionPathInsights(normalizeExpandedRows([
    { name: "/reports", visitors: 25, pageviews: 75, visits: 30, bounces: 18 },
    { name: "/sessions/regeneration", visitors: 14, pageviews: 40, visits: 18, bounces: 10 },
  ]));
  const recommendations = buildStrategicRecommendations({
    conversionPaths,
    devices: normalizeExpandedRows([{ name: "Mobile", visitors: 70 }, { name: "Desktop", visitors: 30 }]),
    channels: normalizeExpandedRows([{ name: "Direct", visitors: 50 }, { name: "Organic Search", visitors: 30 }]),
    overview: makeOverview(),
  });

  assert.ok(recommendations.some((item) => item.includes("may indicate")));
  assert.ok(recommendations.some((item) => item.includes("Consider")));
  assert.ok(recommendations.every((item) => !/converting poorly/i.test(item)));
});

test("loadInsightsSubsection degrades without throwing when Umami returns an error", async () => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.UMAMI_API_KEY;
  process.env.UMAMI_API_KEY = "test-key";
  logger.warnings = [];
  globalThis.fetch = async () => new Response("unsupported", { status: 400 });

  try {
    const result = await loadInsightsSubsection({
      window,
      metricType: "entry",
      limit: 5,
      logger,
      operation: "test_entry",
      emptyWarning: "Entry page data is unavailable.",
    });

    assert.equal(result.status, "degraded");
    assert.deepEqual(result.items, []);
    assert.equal(logger.warnings.at(-1)?.message, "analytics_insights_subsection_degraded");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) {
      delete process.env.UMAMI_API_KEY;
    } else {
      process.env.UMAMI_API_KEY = previousKey;
    }
  }
});
