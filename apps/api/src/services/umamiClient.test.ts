import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getAdminAnalyticsSummary } from "./analyticsService.js";
import {
  readActiveVisitors,
  readEventStats,
  readExpandedMetrics,
  readSeries,
  readUmamiStats,
  resetUmamiClientState,
  umamiRequest,
} from "./umamiClient.js";

const logger = {
  warnings: [] as Array<{ payload: Record<string, unknown>; message: string }>,
  warn(payload: Record<string, unknown>, message: string) {
    this.warnings.push({ payload, message });
  },
};

test("umami stats keep genuine zeros and previous-period comparison", () => {
  const parsed = readUmamiStats({
    pageviews: 0,
    visitors: 0,
    visits: 0,
    bounces: 0,
    totaltime: "0",
    comparison: { pageviews: 4, visitors: 2, visits: 3, bounces: 1, totaltime: 90 },
  });
  assert.equal(parsed?.current.pageviews, 0);
  assert.equal(parsed?.current.visitors, 0);
  assert.equal(parsed?.previous?.visitors, 2);
  assert.equal(parsed?.previous?.totaltime, 90);
});

test("umami parsers reject incomplete payloads", () => {
  assert.equal(readUmamiStats({ visitors: 1 }), null);
  assert.deepEqual(readSeries({ pageviews: [{ x: "2026-10-25", y: "nope" }] }, "pageviews"), []);
  assert.deepEqual(readSeries({ pageviews: [{ x: "2026-10-25", y: 3 }], sessions: [] }, "sessions"), []);
  assert.equal(readActiveVisitors({ visitors: 5 }), 5);
  assert.equal(readEventStats({ data: { events: 2, visitors: 1, visits: 1 } }), null);
  assert.equal(readExpandedMetrics([{ name: "/webinars/prime-alchemy", pageviews: 8, visitors: 3, visits: 4, bounces: 0 }])?.[0]?.name, "/webinars/prime-alchemy");
});

describe("umami reporting", { concurrency: 1 }, () => {
test("summary maps visits, duration, bounce rate, and the previous period", async () => {
  resetUmamiClientState();
  const originalFetch = globalThis.fetch;
  const previous = {
    base: process.env.UMAMI_BASE_URL,
    user: process.env.UMAMI_USERNAME,
    password: process.env.UMAMI_PASSWORD,
    website: process.env.UMAMI_WEBSITE_ID,
  };
  process.env.UMAMI_BASE_URL = "https://analytics.example.test";
  process.env.UMAMI_USERNAME = "admin";
  process.env.UMAMI_PASSWORD = "not-logged";
  process.env.UMAMI_WEBSITE_ID = "11111111-1111-4111-8111-111111111111";
  logger.warnings = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/api/auth/login")) return Response.json({ token: "temporary-token" });
    if (url.includes("/stats")) {
      return Response.json({
        pageviews: 0,
        visitors: 0,
        visits: 2,
        bounces: 1,
        totaltime: 120,
        comparison: { pageviews: 4, visitors: 3, visits: 3, bounces: 1, totaltime: 90 },
      });
    }
    if (url.includes("/active")) return Response.json({ visitors: 1 });
    return new Response("ok", { status: 200 });
  };
  try {
    const result = await getAdminAnalyticsSummary({ actorRole: "admin" }, "24h", logger);
    assert.equal(result.status, "ok");
    assert.equal(result.traffic.visitors, 0);
    assert.equal(result.traffic.sessions, 2);
    assert.equal(result.traffic.averageSessionSeconds, 60);
    assert.equal(result.traffic.bounceRate, 50);
    assert.equal(result.traffic.activeVisitors, 1);
    assert.equal(result.trends.visitors?.previous, 3);
    assert.equal("source" in result && result.source.provider, "umami");
    assert.equal("source" in result && result.source.health.database, "ok");
    assert.match("source" in result ? result.source.health.lastSuccessAt ?? "" : "", /^\d{4}-/);
    assert.equal(JSON.stringify(logger.warnings).includes("not-logged"), false);
  } finally {
    globalThis.fetch = originalFetch;
    resetUmamiClientState();
    for (const [key, value] of Object.entries({
      UMAMI_BASE_URL: previous.base,
      UMAMI_USERNAME: previous.user,
      UMAMI_PASSWORD: previous.password,
      UMAMI_WEBSITE_ID: previous.website,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("umami login failure does not log the password", async () => {
  resetUmamiClientState();
  const originalFetch = globalThis.fetch;
  const previous = {
    base: process.env.UMAMI_BASE_URL,
    user: process.env.UMAMI_USERNAME,
    password: process.env.UMAMI_PASSWORD,
    website: process.env.UMAMI_WEBSITE_ID,
  };
  process.env.UMAMI_BASE_URL = "https://analytics.example.test";
  process.env.UMAMI_USERNAME = "admin";
  process.env.UMAMI_PASSWORD = "super-secret-password";
  process.env.UMAMI_WEBSITE_ID = "11111111-1111-4111-8111-111111111111";
  logger.warnings = [];
  globalThis.fetch = async () => new Response("no", { status: 401 });
  try {
    const result = await umamiRequest({
      pathname: "/api/websites/11111111-1111-4111-8111-111111111111/stats",
      logger,
      operation: "summary",
      parse: () => ({}),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "unauthorized");
    }
    assert.equal(JSON.stringify(logger.warnings).includes("super-secret-password"), false);
  } finally {
    globalThis.fetch = originalFetch;
    resetUmamiClientState();
    for (const [key, value] of Object.entries({
      UMAMI_BASE_URL: previous.base,
      UMAMI_USERNAME: previous.user,
      UMAMI_PASSWORD: previous.password,
      UMAMI_WEBSITE_ID: previous.website,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
});
