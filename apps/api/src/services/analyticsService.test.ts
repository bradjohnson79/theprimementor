import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConversionPathInsights,
  buildStrategicRecommendations,
  getAdminAnalyticsSummary,
  loadInsightsSubsection,
  normalizeExpandedRows,
  reportingCalendarBounds,
  type AnalyticsRangeWindow,
} from "./analyticsService.js";
import { buildGoatCounterAuthHeaders } from "./goatcounterClient.js";

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
  assert.equal(rows[1]?.routeLabel, "Manifestation Monthly Package interest");
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

test("buildGoatCounterAuthHeaders uses Bearer auth", () => {
  const headers = buildGoatCounterAuthHeaders("goatcounter-test-token");
  assert.equal(headers.Authorization, "Bearer goatcounter-test-token");
  assert.equal(headers.Accept, "application/json");
});

test("loadInsightsSubsection marks entry pages unsupported without fetching", async () => {
  logger.warnings = [];
  const result = await loadInsightsSubsection({
    window,
    metricType: "entry",
    limit: 5,
    logger,
    operation: "test_entry",
    emptyWarning: "Entry page data is unavailable.",
  });

  assert.equal(result.status, "unsupported");
  assert.deepEqual(result.items, []);
  assert.equal(logger.warnings.length, 0);
});

test("loadInsightsSubsection degrades without throwing when GoatCounter returns an error", async () => {
  const originalFetch = globalThis.fetch;
  const previousToken = process.env.GOATCOUNTER_API_TOKEN;
  const previousSite = process.env.GOATCOUNTER_SITE_URL;
  process.env.GOATCOUNTER_API_TOKEN = "test-token";
  process.env.GOATCOUNTER_SITE_URL = "https://example.goatcounter.com";
  logger.warnings = [];
  globalThis.fetch = async () => new Response("unsupported", { status: 400 });

  try {
    const result = await loadInsightsSubsection({
      window,
      metricType: "path",
      limit: 5,
      logger,
      operation: "test_path",
      emptyWarning: "Path data is unavailable.",
    });

    assert.equal(result.status, "degraded");
    assert.deepEqual(result.items, []);
    assert.equal(logger.warnings.at(-1)?.message, "analytics_insights_subsection_degraded");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) {
      delete process.env.GOATCOUNTER_API_TOKEN;
    } else {
      process.env.GOATCOUNTER_API_TOKEN = previousToken;
    }
    if (previousSite === undefined) {
      delete process.env.GOATCOUNTER_SITE_URL;
    } else {
      process.env.GOATCOUNTER_SITE_URL = previousSite;
    }
  }
});

const adminActor = { actorRole: "admin" };

async function withGoatCounterFetch(
  token: string | undefined,
  fetchImpl: typeof fetch,
  run: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const previousToken = process.env.GOATCOUNTER_API_TOKEN;
  const previousSite = process.env.GOATCOUNTER_SITE_URL;
  if (token === undefined) {
    delete process.env.GOATCOUNTER_API_TOKEN;
  } else {
    process.env.GOATCOUNTER_API_TOKEN = token;
  }
  process.env.GOATCOUNTER_SITE_URL = "https://example.goatcounter.com";
  globalThis.fetch = fetchImpl;
  logger.warnings = [];
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) {
      delete process.env.GOATCOUNTER_API_TOKEN;
    } else {
      process.env.GOATCOUNTER_API_TOKEN = previousToken;
    }
    if (previousSite === undefined) {
      delete process.env.GOATCOUNTER_SITE_URL;
    } else {
      process.env.GOATCOUNTER_SITE_URL = previousSite;
    }
  }
}

test("summary stays unavailable when GoatCounter credentials are missing", async () => {
  await withGoatCounterFetch(undefined, async () => {
    throw new Error("fetch should not run");
  }, async () => {
    const result = await getAdminAnalyticsSummary(adminActor, "7d", logger);
    assert.equal(result.status, "unconfigured");
    assert.equal(result.traffic.visitors, null);
    assert.equal(result.traffic.pageviews, null);
    assert.equal(result.trends.visitors, null);
    assert.match(result.warning ?? "", /not configured/i);
  });
});

test("summary reports authentication, rate limit, timeout, and invalid payloads without zeros", async () => {
  await withGoatCounterFetch("secret-token", async () => new Response("no", { status: 401 }), async () => {
    const result = await getAdminAnalyticsSummary(adminActor, "24h", logger);
    assert.equal(result.status, "degraded");
    assert.equal(result.goatcounter.reason, "unauthorized");
    assert.equal(result.traffic.visitors, null);
    assert.equal(JSON.stringify(logger.warnings).includes("secret-token"), false);
  });

  await withGoatCounterFetch("secret-token", async () => new Response("slow", { status: 429 }), async () => {
    const result = await getAdminAnalyticsSummary(adminActor, "24h", logger);
    assert.equal(result.goatcounter.reason, "rate_limited");
    assert.equal(result.traffic.pageviews, null);
  });

  await withGoatCounterFetch("secret-token", async () => {
    const error = new Error("timed out");
    error.name = "TimeoutError";
    throw error;
  }, async () => {
    const result = await getAdminAnalyticsSummary(adminActor, "24h", logger);
    assert.equal(result.goatcounter.reason, "timeout");
    assert.equal(result.traffic.visitors, null);
  });

  await withGoatCounterFetch("secret-token", async () => new Response("not-json", { status: 200 }), async () => {
    const result = await getAdminAnalyticsSummary(adminActor, "24h", logger);
    assert.equal(result.goatcounter.reason, "invalid_response");
    assert.equal(result.traffic.visitors, null);
  });
});

test("summary keeps a genuine zero and compares it with the previous period", async () => {
  await withGoatCounterFetch("secret-token", async (input) => {
    const url = new URL(String(input));
    const start = Date.parse(url.searchParams.get("start") ?? "");
    const previous = start < Date.now() - (45 * 24 * 60 * 60 * 1000);
    return Response.json(previous
      ? { total: 4, total_events: 0 }
      : { total: 0, total_events: 0, pageviews: 0 });
  }, async () => {
    const result = await getAdminAnalyticsSummary(adminActor, "30d", logger);
    assert.equal(result.status, "ok");
    assert.equal(result.traffic.visitors, 0);
    assert.equal(result.traffic.pageviews, 0);
    assert.equal(result.trends.visitors?.previous, 4);
    assert.equal(result.trends.visitors?.direction, "down");
    assert.equal(result.goatcounter.connected, true);
  });
});

test("reporting calendar uses Pacific days", () => {
  const beforePacificMidnight = reportingCalendarBounds(new Date("2026-10-25T05:00:00.000Z"));
  assert.equal(beforePacificMidnight.startOfToday.toISOString(), "2026-10-24T07:00:00.000Z");
  assert.equal(beforePacificMidnight.startOfMonth.toISOString(), "2026-10-01T07:00:00.000Z");

  const duringPacificDay = reportingCalendarBounds(new Date("2026-10-25T16:00:00.000Z"));
  assert.equal(duringPacificDay.startOfToday.toISOString(), "2026-10-25T07:00:00.000Z");
  assert.equal(duringPacificDay.startOfWeek.toISOString(), "2026-10-19T07:00:00.000Z");
});
