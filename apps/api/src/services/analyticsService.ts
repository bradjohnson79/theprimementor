import {
  bookings,
  clients,
  orders,
  subscriptions,
  users,
  type Database,
} from "@wisdom/db";
import { desc } from "drizzle-orm";
import { createHttpError } from "./booking/errors.js";
import {
  fetchGoatCounterJson,
  formatGoatCounterRange,
  getGoatCounterDashboardUrl,
  getGoatCounterSiteUrl,
  goatCounterFailureMessage,
  metricRowsFromHits,
  metricRowsFromStats,
  pageviewCountFromTotal,
  seriesFromGoatCounterStats,
  visitorCountFromTotal,
  type GoatCounterFailureReason,
  type GoatCounterFetchResult,
  type GoatCounterHitsResponse,
  type GoatCounterStatsResponse,
  type GoatCounterTotalResponse,
} from "./goatcounterClient.js";
import {
  fetchUmamiActiveVisitors,
  fetchUmamiEventStats,
  fetchUmamiExpandedMetrics,
  fetchUmamiPageviewSeries,
  fetchUmamiStats,
  isUmamiConfigured,
  probeUmamiHealth,
  umamiFailureMessage,
  type UmamiFailureReason,
  type UmamiHealthSnapshot,
} from "./umamiClient.js";

export type AnalyticsRange = "24h" | "7d" | "30d";
export type AnalyticsStatus = "ok" | "degraded" | "unconfigured";

interface AnalyticsActor {
  actorRole: string;
  actorUserId?: string | null;
}

export interface AnalyticsLogger {
  warn: (payload: Record<string, unknown>, message: string) => void;
}

export interface AnalyticsRangeWindow {
  range: AnalyticsRange;
  startAt: number;
  endAt: number;
  previousStartAt: number;
  previousEndAt: number;
  unit: "hour" | "day";
  timezone: string;
}

interface LegacyMetricRow {
  x?: string;
  y?: number;
  name?: string;
  pageviews?: number;
  visitors?: number;
  visits?: number;
  bounces?: number;
}

type TrendDirection = "up" | "down" | "neutral";
type InsightsSubsectionStatus = "ok" | "degraded" | "unsupported";
type InsightMetricType =
  | "path"
  | "entry"
  | "exit"
  | "device"
  | "browser"
  | "os"
  | "country"
  | "region"
  | "channel"
  | "query";

interface TrendMetric {
  current: number;
  previous: number;
  delta: number;
  deltaLabel: string;
  direction: TrendDirection;
}

export interface AnalyticsMetricRow {
  label: string;
  visitors: number;
  pageviews: number;
  visits: number;
  bounceRate: number;
  share: number;
}

export interface AnalyticsInsightSubsection {
  status: InsightsSubsectionStatus;
  warning?: string;
  metricType: InsightMetricType;
  items: AnalyticsMetricRow[];
}

export interface AnalyticsCampaignRow extends AnalyticsMetricRow {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  sourceType: "utm" | "channel";
}

export interface AnalyticsConversionPathRow extends AnalyticsMetricRow {
  path: string;
  routeLabel: string;
  note: string;
  frictionNote: string | null;
}

interface CachedEntry<T> {
  expiresAt: number;
  value: T;
}

const ANALYTICS_TIMEZONE = "America/Vancouver";
const CACHE_TTL_MS = 90 * 1000;
const analyticsCache = new Map<string, CachedEntry<unknown>>();
const ORDER_METRIC_STATUSES = new Set(["completed"]);
const SESSION_BOOKED_STATUSES = new Set(["paid", "scheduled", "completed"]);
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const CONVERSION_ROUTE_LABELS = [
  { prefix: "/sessions/manifestation", label: "Manifestation Monthly Package interest" },
  { prefix: "/sessions/regeneration", label: "Manifestation Monthly Package interest" },
  { prefix: "/subscriptions/initiate", label: "Initiate subscription interest" },
  { prefix: "/subscriptions/seeker", label: "Seeker subscription interest" },
  { prefix: "/reports", label: "Divin8 Reports interest" },
  { prefix: "/sessions", label: "Private session interest" },
  { prefix: "/sign-up", label: "Account creation step" },
  { prefix: "/sign-in", label: "Returning user login" },
  { prefix: "/checkout", label: "Purchase/checkout step" },
  { prefix: "/dashboard", label: "Member area" },
];

function assertAdminAccess(actor: AnalyticsActor) {
  if (actor.actorRole !== "admin") {
    throw createHttpError(403, "Admin analytics access required");
  }
}

function getRangeDurationMs(range: AnalyticsRange) {
  switch (range) {
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

export function getPreviousRange(range: AnalyticsRange, endAt = Date.now()) {
  const duration = getRangeDurationMs(range);
  return {
    startAt: endAt - duration,
    endAt,
    previousStartAt: endAt - (duration * 2),
    previousEndAt: endAt - duration,
  };
}

export function resolveAnalyticsRange(range: string | undefined): AnalyticsRange {
  if (range === "24h" || range === "7d" || range === "30d") {
    return range;
  }

  return "7d";
}

function buildRangeWindow(range: AnalyticsRange): AnalyticsRangeWindow {
  const now = Date.now();
  const { startAt, endAt, previousStartAt, previousEndAt } = getPreviousRange(range, now);
  return {
    range,
    startAt,
    endAt,
    previousStartAt,
    previousEndAt,
    unit: range === "24h" ? "hour" : "day",
    timezone: ANALYTICS_TIMEZONE,
  };
}

function getCachedValue<T>(cacheKey: string): T | null {
  const cached = analyticsCache.get(cacheKey);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt < Date.now()) {
    analyticsCache.delete(cacheKey);
    return null;
  }
  return cached.value as T;
}

function setCachedValue<T>(cacheKey: string, value: T) {
  analyticsCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

async function getCachedOrLoad<T>(
  cacheKey: string,
  loader: () => Promise<T>,
  shouldCache: (value: T) => boolean = () => true,
) {
  const cached = getCachedValue<T>(cacheKey);
  if (cached) {
    return cached;
  }

  const value = await loader();
  if (shouldCache(value)) {
    setCachedValue(cacheKey, value);
  }
  return value;
}

export function zonedDayStart(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const utcGuess = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const zoned = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utcGuess);
  const hour = Number(zoned.find((part) => part.type === "hour")?.value);
  const localAsUtc = Date.UTC(
    Number(zoned.find((part) => part.type === "year")?.value),
    Number(zoned.find((part) => part.type === "month")?.value) - 1,
    Number(zoned.find((part) => part.type === "day")?.value),
    hour === 24 ? 0 : hour,
    Number(zoned.find((part) => part.type === "minute")?.value),
    Number(zoned.find((part) => part.type === "second")?.value),
  );
  return new Date(utcGuess.getTime() - (localAsUtc - utcGuess.getTime()));
}

export function reportingCalendarBounds(now = new Date(), timeZone = ANALYTICS_TIMEZONE) {
  const startOfToday = zonedDayStart(timeZone, now);
  const startOfWeek = new Date(startOfToday.getTime() - (6 * 24 * 60 * 60 * 1000));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const startOfMonth = zonedDayStart(timeZone, new Date(`${year}-${month}-01T12:00:00.000Z`));
  return { startOfToday, startOfWeek, startOfMonth };
}

function getTrendMetric(current: number, previous: number, unitLabel: string): TrendMetric {
  const delta = previous === 0
    ? current > 0 ? 100 : 0
    : Math.round(((current - previous) / previous) * 100);
  const signedDelta = delta > 0 ? `+${delta}` : `${delta}`;
  return {
    current,
    previous,
    delta,
    deltaLabel: `${signedDelta}% vs ${unitLabel}`,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "neutral",
  };
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function buildDegradedMeta(reason: string) {
  return {
    status: "degraded" as const,
    warning: reason,
  };
}

function calculateBounceRate(row: LegacyMetricRow) {
  const visits = numberValue(row.visits);
  if (visits <= 0) {
    return 0;
  }
  return Math.round((numberValue(row.bounces) / visits) * 100);
}

function normalizeMetricLabel(row: LegacyMetricRow) {
  return stringValue(row.name ?? row.x);
}

export function normalizeExpandedRows(rows: LegacyMetricRow[] | null | undefined): AnalyticsMetricRow[] {
  const safeRows = rows ?? [];
  const totalVisitors = safeRows.reduce((sum, row) => sum + numberValue(row.visitors), 0);

  return safeRows
    .map((row) => ({
      label: normalizeMetricLabel(row),
      visitors: numberValue(row.visitors),
      pageviews: numberValue(row.pageviews),
      visits: numberValue(row.visits),
      bounceRate: calculateBounceRate(row),
      share: totalVisitors > 0 ? Math.round((numberValue(row.visitors) / totalVisitors) * 100) : 0,
    }))
    .filter((row) => row.label);
}

function getRouteLabel(path: string) {
  const normalized = path === "/" ? path : path.replace(/\/+$/, "");
  return CONVERSION_ROUTE_LABELS.find((route) =>
    normalized === route.prefix || normalized.startsWith(`${route.prefix}/`),
  )?.label ?? null;
}

export function buildConversionPathInsights(rows: AnalyticsMetricRow[]): AnalyticsConversionPathRow[] {
  return rows
    .map((row) => {
      const routeLabel = getRouteLabel(row.label);
      if (!routeLabel) {
        return null;
      }

      return {
        ...row,
        path: row.label,
        routeLabel,
        note: `${row.label} (${routeLabel}) received ${row.pageviews} pageviews and ${row.visitors} visitors with a ${row.bounceRate}% bounce rate.`,
        frictionNote: row.visitors >= 5 && row.bounceRate >= 50
          ? "Worth reviewing CTA clarity, trust signals, offer strength, and next-step visibility if this route remains important."
          : null,
      } satisfies AnalyticsConversionPathRow;
    })
    .filter((row): row is AnalyticsConversionPathRow => Boolean(row));
}

function findMetric(rows: AnalyticsMetricRow[], path: string) {
  return rows.find((row) => row.label === path || row.label.startsWith(`${path}/`));
}

export function buildStrategicRecommendations(input: {
  conversionPaths: AnalyticsConversionPathRow[];
  devices: AnalyticsMetricRow[];
  channels: AnalyticsMetricRow[];
  overview: Awaited<ReturnType<typeof getAdminAnalyticsOverview>>;
}) {
  const recommendations: string[] = [];
  const reports = findMetric(input.conversionPaths, "/reports");
  const regeneration = findMetric(input.conversionPaths, "/sessions/manifestation")
    ?? findMetric(input.conversionPaths, "/sessions/regeneration");
  const directChannel = input.channels.find((row) => /direct/i.test(row.label));
  const organicOrVideo = input.channels.find((row) => /\b(organic|search|social|video|youtube)\b/i.test(row.label));
  const mobile = input.devices.find((row) => /mobile/i.test(row.label));
  const ordersTrend = input.overview.businessMetrics.orders.trend;

  if (reports && reports.visitors >= 5 && reports.bounceRate >= 50) {
    recommendations.push(
      "Reports are receiving attention, but the bounce rate may indicate some visitors need a clearer next step. Consider improving the headline, adding a short \"which report is right for me?\" section, and placing a stronger CTA above the fold.",
    );
  }

  if (regeneration && regeneration.visitors >= 5 && ordersTrend.direction !== "up") {
    recommendations.push(
      "Regeneration traffic is present, but stronger trust signals may help. Consider clearer package explanation, testimonials, and a softer entry CTA if related orders are not rising in the current period.",
    );
  }

  if (organicOrVideo && organicOrVideo.share >= 20) {
    recommendations.push(
      "Search, social, or video channels are meaningful in this period. Worth continuing SEO pages, video descriptions, and clear calls to action back into Reports, Sessions, and Subscriptions.",
    );
  }

  if (directChannel && directChannel.share >= 35) {
    recommendations.push(
      "Direct traffic may indicate brand recall or returning visitor behavior. Make sure Reports, Sessions, and Subscriptions are easy to find quickly from the homepage and admin-promoted links.",
    );
  }

  if (mobile && mobile.share >= 55) {
    recommendations.push(
      "Mobile traffic is significant. Consider prioritizing mobile page speed, CTA visibility, shorter page sections, and a simplified checkout flow.",
    );
  }

  if (recommendations.length === 0 && input.conversionPaths.length > 0) {
    recommendations.push(
      "Conversion-intent pages are receiving measurable traffic. Continue watching bounce rate and order/session trends before making strong conclusions.",
    );
  }

  return recommendations.slice(0, 6);
}

const GOATCOUNTER_UNSUPPORTED_METRICS = new Set<InsightMetricType>(["entry", "exit", "region", "query", "os"]);
const UMAMI_METRIC_TYPES: Record<InsightMetricType, string> = {
  path: "path",
  entry: "entry",
  exit: "exit",
  device: "device",
  browser: "browser",
  os: "os",
  country: "country",
  region: "region",
  channel: "channel",
  query: "utmCampaign",
};
const GOATCOUNTER_STAT_PAGES: Partial<Record<InsightMetricType, string>> = {
  device: "systems",
  browser: "browsers",
  country: "locations",
  channel: "campaigns",
};

function goatcounterConnection(connected: boolean, reason: GoatCounterFailureReason | "ok" = connected ? "ok" : "unconfigured") {
  const siteUrl = getGoatCounterSiteUrl();
  return {
    siteUrl,
    dashboardUrl: getGoatCounterDashboardUrl(),
    connected,
    reason,
  };
}

function firstFailure(results: Array<GoatCounterFetchResult<unknown>>) {
  return results.find((result) => !result.ok) ?? null;
}

function cacheSuccessful<T extends { status: string }>(value: T) {
  return value.status === "ok";
}


function analyticsSource(input: {
  provider: "umami" | "goatcounter";
  siteUrl: string;
  dashboardUrl: string;
  connected: boolean;
  reason: string;
  health: UmamiHealthSnapshot;
}) {
  return input;
}

function averageVisitSeconds(stats: { visits: number; totaltime: number }) {
  if (stats.visits <= 0) {
    return null;
  }
  return Math.round(stats.totaltime / stats.visits);
}

function bounceRate(stats: { visits: number; bounces: number }) {
  if (stats.visits <= 0) {
    return null;
  }
  return Math.round((stats.bounces / stats.visits) * 100);
}

function pageGroups(rows: AnalyticsMetricRow[]) {
  return {
    servicePages: rows.filter((row) => /^\/(services|sessions|subscriptions|healing|mentoring)/.test(row.label)).slice(0, 8),
    webinarPages: rows.filter((row) => row.label.toLowerCase().includes("webinar")).slice(0, 8),
  };
}

async function loadUmamiInsightSubsection(input: {
  window: AnalyticsRangeWindow;
  metricType: InsightMetricType;
  limit: number;
  logger: AnalyticsLogger;
  operation: string;
  emptyWarning: string;
}): Promise<AnalyticsInsightSubsection> {
  const payload = await fetchUmamiExpandedMetrics({
    type: UMAMI_METRIC_TYPES[input.metricType],
    startAt: input.window.startAt,
    endAt: input.window.endAt,
    limit: input.limit,
    unit: input.window.unit,
    logger: input.logger,
    operation: input.operation,
  });
  if (!payload.ok) {
    input.logger.warn(
      { operation: input.operation, metricType: input.metricType, status: "degraded", reason: payload.reason },
      "analytics_insights_subsection_degraded",
    );
    return {
      status: "degraded",
      warning: umamiFailureMessage(payload.reason, "this breakdown"),
      metricType: input.metricType,
      items: [],
    };
  }
  return {
    status: "ok",
    metricType: input.metricType,
    items: normalizeExpandedRows(payload.data).slice(0, input.limit),
  };
}

function unavailableUmamiTraffic(range: AnalyticsRange, reason: UmamiFailureReason, health: UmamiHealthSnapshot) {
  return {
    range,
    status: reason === "unconfigured" ? "unconfigured" as const : "degraded" as const,
    reason,
    warning: umamiFailureMessage(reason, "the traffic summary"),
    traffic: {
      visitors: null,
      pageviews: null,
      sessions: null,
      bounces: null,
      totalTimeSeconds: null,
      averageSessionSeconds: null,
      activeVisitors: null,
      bounceRate: null,
    },
    trends: {
      visitors: null,
      pageviews: null,
      sessions: null,
    },
    source: analyticsSource({
      provider: "umami",
      siteUrl: process.env.UMAMI_BASE_URL?.trim() ?? "",
      dashboardUrl: process.env.UMAMI_BASE_URL?.trim() ?? "",
      connected: false,
      reason,
      health,
    }),
    goatcounter: {
      siteUrl: "",
      dashboardUrl: "",
      connected: false,
      reason,
    },
  };
}

export async function loadInsightsSubsection(input: {
  window: AnalyticsRangeWindow;
  metricType: InsightMetricType;
  limit: number;
  logger: AnalyticsLogger;
  operation: string;
  emptyWarning: string;
}): Promise<AnalyticsInsightSubsection> {
  if (isUmamiConfigured()) {
    return loadUmamiInsightSubsection(input);
  }
  if (GOATCOUNTER_UNSUPPORTED_METRICS.has(input.metricType)) {
    return {
      status: "unsupported",
      warning: "GoatCounter does not provide this breakdown.",
      metricType: input.metricType,
      items: [],
    };
  }

  const range = formatGoatCounterRange(input.window.startAt, input.window.endAt);

  try {
    if (input.metricType === "path") {
      const payload = await fetchGoatCounterJson<GoatCounterHitsResponse>({
        pathname: "stats/hits",
        params: { ...range, limit: input.limit },
        logger: input.logger,
        operation: input.operation,
      });
      if (!payload.ok) {
        input.logger.warn(
          { operation: input.operation, metricType: input.metricType, status: "degraded", reason: payload.reason },
          "analytics_insights_subsection_degraded",
        );
        return {
          status: "degraded",
          warning: payload.reason === "unconfigured"
            ? goatCounterFailureMessage(payload.reason, "this breakdown")
            : input.emptyWarning,
          metricType: input.metricType,
          items: [],
        };
      }
      return {
        status: "ok",
        metricType: input.metricType,
        items: metricRowsFromHits(payload.data.hits, false).slice(0, input.limit),
      };
    }

    const page = GOATCOUNTER_STAT_PAGES[input.metricType];
    if (!page) {
      return {
        status: "unsupported",
        warning: "GoatCounter does not provide this breakdown.",
        metricType: input.metricType,
        items: [],
      };
    }

    const payload = await fetchGoatCounterJson<GoatCounterStatsResponse>({
      pathname: `stats/${page}`,
      params: range,
      logger: input.logger,
      operation: input.operation,
    });
    if (!payload.ok) {
      input.logger.warn(
        { operation: input.operation, metricType: input.metricType, status: "degraded", reason: payload.reason },
        "analytics_insights_subsection_degraded",
      );
      return {
        status: "degraded",
        warning: payload.reason === "unconfigured"
          ? goatCounterFailureMessage(payload.reason, "this breakdown")
          : input.emptyWarning,
        metricType: input.metricType,
        items: [],
      };
    }

    return {
      status: "ok",
      metricType: input.metricType,
      items: metricRowsFromStats(payload.data.stats).slice(0, input.limit),
    };
  } catch (error) {
    input.logger.warn(
      {
        operation: input.operation,
        metricType: input.metricType,
        status: "degraded",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      "analytics_insights_subsection_degraded",
    );
    return {
      status: "degraded",
      warning: input.emptyWarning,
      metricType: input.metricType,
      items: [],
    };
  }
}

function parseUtmQuery(label: string) {
  const queryText = label.startsWith("?") ? label.slice(1) : label;
  const params = new URLSearchParams(queryText);
  const utmSource = params.get("utm_source");
  const utmMedium = params.get("utm_medium");
  const utmCampaign = params.get("utm_campaign");

  if (!utmSource && !utmMedium && !utmCampaign) {
    return null;
  }

  return { utmSource, utmMedium, utmCampaign };
}

function buildCampaignRows(channelRows: AnalyticsMetricRow[], queryRows: AnalyticsMetricRow[]) {
  const utmRows = queryRows
    .map((row) => {
      const utm = parseUtmQuery(row.label);
      if (!utm) {
        return null;
      }
      return {
        ...row,
        ...utm,
        sourceType: "utm" as const,
      };
    })
    .filter((row) => Boolean(row)) as AnalyticsCampaignRow[];

  if (utmRows.length > 0) {
    return {
      hasUtmData: true,
      items: utmRows,
    };
  }

  return {
    hasUtmData: false,
    items: channelRows.map((row) => ({
      ...row,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      sourceType: "channel" as const,
    })),
  };
}

function toMoney(valueInCents: number) {
  return Number((valueInCents / 100).toFixed(2));
}

async function getUmamiAdminAnalyticsSummary(
  range: AnalyticsRange,
  logger: AnalyticsLogger,
) {
  const window = buildRangeWindow(range);
  return getCachedOrLoad(`analytics:umami:summary:${range}`, async () => {
    const [stats, active, probed] = await Promise.all([
      fetchUmamiStats({
        startAt: window.startAt,
        endAt: window.endAt,
        logger,
        operation: "summary",
      }),
      fetchUmamiActiveVisitors(logger),
      probeUmamiHealth(logger),
    ]);
    if (!stats.ok) {
      return unavailableUmamiTraffic(range, stats.reason, {
        ...probed,
        reporting: "degraded",
        database: "unavailable",
      });
    }
    const current = stats.data.current;
    const previous = stats.data.previous;
    const health: UmamiHealthSnapshot = {
      ...probed,
      service: probed.service === "unconfigured" ? "degraded" : probed.service,
      database: "ok",
      reporting: "ok",
    };
    return {
      range,
      status: "ok" as const,
      traffic: {
        visitors: current.visitors,
        pageviews: current.pageviews,
        sessions: current.visits,
        bounces: current.bounces,
        totalTimeSeconds: current.totaltime,
        averageSessionSeconds: averageVisitSeconds(current),
        activeVisitors: active.ok ? active.data.visitors : null,
        bounceRate: bounceRate(current),
      },
      trends: {
        visitors: previous ? getTrendMetric(current.visitors, previous.visitors, "previous period") : null,
        pageviews: previous ? getTrendMetric(current.pageviews, previous.pageviews, "previous period") : null,
        sessions: previous ? getTrendMetric(current.visits, previous.visits, "previous period") : null,
      },
      source: analyticsSource({
        provider: "umami",
        siteUrl: process.env.UMAMI_BASE_URL?.trim() ?? "",
        dashboardUrl: process.env.UMAMI_BASE_URL?.trim() ?? "",
        connected: true,
        reason: "ok",
        health,
      }),
      goatcounter: {
        siteUrl: "",
        dashboardUrl: "",
        connected: false,
        reason: "retired",
      },
    };
  }, cacheSuccessful);
}

export async function getAdminAnalyticsSummary(
  actor: AnalyticsActor,
  range: AnalyticsRange,
  logger: AnalyticsLogger,
) {
  assertAdminAccess(actor);
  if (isUmamiConfigured()) {
    return getUmamiAdminAnalyticsSummary(range, logger);
  }
  const window = buildRangeWindow(range);
  const currentRange = formatGoatCounterRange(window.startAt, window.endAt);
  const previousRange = formatGoatCounterRange(window.previousStartAt, window.previousEndAt);

  return getCachedOrLoad(`analytics:summary:${range}`, async () => {
    const [current, previous] = await Promise.all([
      fetchGoatCounterJson<GoatCounterTotalResponse>({
        pathname: "stats/total",
        params: currentRange,
        logger,
        operation: "summary",
      }),
      fetchGoatCounterJson<GoatCounterTotalResponse>({
        pathname: "stats/total",
        params: previousRange,
        logger,
        operation: "summary_previous",
      }),
    ]);

    if (!current.ok) {
      return unavailableTraffic(range, current.reason);
    }

    const visits = visitorCountFromTotal(current.data);
    if (visits === null) {
      return unavailableTraffic(range, "invalid_response");
    }
    const previousVisits = previous.ok ? visitorCountFromTotal(previous.data) : null;
    const pageviews = pageviewCountFromTotal(current.data);
    const previousPageviews = previous.ok ? pageviewCountFromTotal(previous.data) : null;

    return {
      range,
      status: "ok" as const,
      traffic: {
        visitors: visits,
        pageviews,
        sessions: null,
        bounces: null,
        totalTimeSeconds: null,
        averageSessionSeconds: null,
        activeVisitors: null,
        bounceRate: null,
      },
      trends: {
        visitors: previousVisits === null ? null : getTrendMetric(visits, previousVisits, "previous period"),
        pageviews: pageviews === null || previousPageviews === null
          ? null
          : getTrendMetric(pageviews, previousPageviews, "previous period"),
        sessions: null,
      },
      goatcounter: goatcounterConnection(true, "ok"),
    };
  }, cacheSuccessful);
}

function unavailableTraffic(range: AnalyticsRange, reason: GoatCounterFailureReason) {
  return {
    range,
    status: reason === "unconfigured" ? "unconfigured" as const : "degraded" as const,
    reason,
    warning: goatCounterFailureMessage(reason, "the traffic summary"),
    traffic: {
      visitors: null,
      pageviews: null,
      sessions: null,
      bounces: null,
      totalTimeSeconds: null,
      averageSessionSeconds: null,
      activeVisitors: null,
      bounceRate: null,
    },
    trends: {
      visitors: null,
      pageviews: null,
      sessions: null,
    },
    goatcounter: goatcounterConnection(false, reason),
  };
}

async function getUmamiAdminAnalyticsPageviews(range: AnalyticsRange, logger: AnalyticsLogger) {
  const window = buildRangeWindow(range);
  return getCachedOrLoad(`analytics:umami:pageviews:${range}`, async () => {
    const [series, pages, entries] = await Promise.all([
      fetchUmamiPageviewSeries({
        startAt: window.startAt,
        endAt: window.endAt,
        unit: window.unit,
        logger,
      }),
      fetchUmamiExpandedMetrics({
        type: "path",
        startAt: window.startAt,
        endAt: window.endAt,
        limit: 40,
        unit: window.unit,
        logger,
        operation: "top_pages",
      }),
      fetchUmamiExpandedMetrics({
        type: "entry",
        startAt: window.startAt,
        endAt: window.endAt,
        limit: 12,
        unit: window.unit,
        logger,
        operation: "landing_pages",
      }),
    ]);
    const failure = [series, pages, entries].find((result) => !result.ok);
    if (failure && !failure.ok) {
      return {
        range,
        status: failure.reason === "unconfigured" ? "unconfigured" as const : "degraded" as const,
        reason: failure.reason,
        warning: umamiFailureMessage(failure.reason, "page metrics"),
        series: { pageviews: [], sessions: [] },
        topPages: [],
        landingPages: [],
        servicePages: [],
        webinarPages: [],
      };
    }
    if (!series.ok || !pages.ok || !entries.ok) {
      return {
        range,
        ...buildDegradedMeta(umamiFailureMessage("unavailable", "page metrics")),
        series: { pageviews: [], sessions: [] },
        topPages: [],
        landingPages: [],
        servicePages: [],
        webinarPages: [],
      };
    }
    const topPages = normalizeExpandedRows(pages.data).slice(0, 12).map((row) => ({
      path: row.label,
      visitors: row.visitors,
      pageviews: row.pageviews,
      visits: row.visits,
      bounceRate: null,
      share: row.share,
    }));
    const grouped = pageGroups(normalizeExpandedRows(pages.data));
    return {
      range,
      status: "ok" as const,
      series: {
        pageviews: series.data.pageviews.map((point) => ({ timestamp: point.x, value: point.y })),
        sessions: series.data.sessions.map((point) => ({ timestamp: point.x, value: point.y })),
      },
      topPages,
      landingPages: normalizeExpandedRows(entries.data).slice(0, 8).map((row) => ({
        path: row.label,
        visitors: row.visitors,
        pageviews: row.pageviews,
        visits: row.visits,
        share: row.share,
      })),
      servicePages: grouped.servicePages,
      webinarPages: grouped.webinarPages,
    };
  }, cacheSuccessful);
}

export async function getAdminAnalyticsPageviews(
  actor: AnalyticsActor,
  range: AnalyticsRange,
  logger: AnalyticsLogger,
) {
  assertAdminAccess(actor);
  if (isUmamiConfigured()) {
    return getUmamiAdminAnalyticsPageviews(range, logger);
  }
  const window = buildRangeWindow(range);
  const currentRange = formatGoatCounterRange(window.startAt, window.endAt);

  return getCachedOrLoad(`analytics:pageviews:${range}`, async () => {
    const [totals, hits] = await Promise.all([
      fetchGoatCounterJson<GoatCounterTotalResponse>({
        pathname: "stats/total",
        params: currentRange,
        logger,
        operation: "pageviews",
      }),
      fetchGoatCounterJson<GoatCounterHitsResponse>({
        pathname: "stats/hits",
        params: { ...currentRange, limit: 20 },
        logger,
        operation: "top_pages",
      }),
    ]);

    const failure = firstFailure([totals, hits]);
    if (failure && !failure.ok) {
      return {
        range,
        status: failure.reason === "unconfigured" ? "unconfigured" as const : "degraded" as const,
        reason: failure.reason,
        warning: goatCounterFailureMessage(failure.reason, "page metrics"),
        series: {
          pageviews: [],
          sessions: [],
        },
        topPages: [],
      };
    }
    if (!totals.ok || !hits.ok) {
      return {
        range,
        ...buildDegradedMeta(goatCounterFailureMessage("unavailable", "page metrics")),
        series: {
          pageviews: [],
          sessions: [],
        },
        topPages: [],
      };
    }

    const series = seriesFromGoatCounterStats(totals.data.stats, window.unit);

    return {
      range,
      status: "ok" as const,
      series: {
        pageviews: series,
        sessions: [],
      },
      topPages: metricRowsFromHits(hits.data.hits, false).slice(0, 8).map((row) => ({
        path: row.label,
        visitors: row.visitors,
        pageviews: row.pageviews,
        visits: row.visits,
        bounceRate: row.bounceRate,
      })),
    };
  }, cacheSuccessful);
}

async function getUmamiAdminAnalyticsEvents(range: AnalyticsRange, logger: AnalyticsLogger) {
  const window = buildRangeWindow(range);
  return getCachedOrLoad(`analytics:umami:events:${range}`, async () => {
    const [stats, events] = await Promise.all([
      fetchUmamiEventStats({
        startAt: window.startAt,
        endAt: window.endAt,
        logger,
        operation: "event_stats",
      }),
      fetchUmamiExpandedMetrics({
        type: "event",
        startAt: window.startAt,
        endAt: window.endAt,
        limit: 12,
        unit: window.unit,
        logger,
        operation: "event_metrics",
      }),
    ]);
    const failure = [stats, events].find((result) => !result.ok);
    if (failure && !failure.ok) {
      return {
        range,
        status: failure.reason === "unconfigured" ? "unconfigured" as const : "degraded" as const,
        reason: failure.reason,
        warning: umamiFailureMessage(failure.reason, "event tracking"),
        totals: {
          events: null,
          visitors: null,
          visits: null,
          uniqueEvents: null,
          comparison: { events: null, visitors: null, visits: null, uniqueEvents: null },
        },
        items: [],
        series: [],
        recent: [],
      };
    }
    if (!stats.ok || !events.ok) {
      return {
        range,
        ...buildDegradedMeta(umamiFailureMessage("unavailable", "event tracking")),
        totals: {
          events: null,
          visitors: null,
          visits: null,
          uniqueEvents: null,
          comparison: { events: null, visitors: null, visits: null, uniqueEvents: null },
        },
        items: [],
        series: [],
        recent: [],
      };
    }
    const rows = normalizeExpandedRows(events.data).slice(0, 12);
    return {
      range,
      status: "ok" as const,
      totals: {
        events: stats.data.events,
        visitors: stats.data.visitors,
        visits: stats.data.visits,
        uniqueEvents: stats.data.uniqueEvents,
        comparison: {
          events: stats.data.comparison?.events ?? null,
          visitors: stats.data.comparison?.visitors ?? null,
          visits: stats.data.comparison?.visits ?? null,
          uniqueEvents: stats.data.comparison?.uniqueEvents ?? null,
        },
      },
      items: rows.map((row) => ({
        name: row.label,
        total: row.pageviews,
        share: row.share,
      })),
      series: [],
      recent: [],
    };
  }, cacheSuccessful);
}

export async function getAdminAnalyticsEvents(
  actor: AnalyticsActor,
  range: AnalyticsRange,
  logger: AnalyticsLogger,
) {
  assertAdminAccess(actor);
  if (isUmamiConfigured()) {
    return getUmamiAdminAnalyticsEvents(range, logger);
  }
  const window = buildRangeWindow(range);
  const currentRange = formatGoatCounterRange(window.startAt, window.endAt);
  const previousRange = formatGoatCounterRange(window.previousStartAt, window.previousEndAt);

  return getCachedOrLoad(`analytics:events:${range}`, async () => {
    const [current, previous, hits] = await Promise.all([
      fetchGoatCounterJson<GoatCounterTotalResponse>({
        pathname: "stats/total",
        params: currentRange,
        logger,
        operation: "event_stats",
      }),
      fetchGoatCounterJson<GoatCounterTotalResponse>({
        pathname: "stats/total",
        params: previousRange,
        logger,
        operation: "event_stats_previous",
      }),
      fetchGoatCounterJson<GoatCounterHitsResponse>({
        pathname: "stats/hits",
        params: { ...currentRange, limit: 100 },
        logger,
        operation: "event_metrics",
      }),
    ]);

    const failure = firstFailure([current, hits]);
    if (failure && !failure.ok) {
      return {
        range,
        status: failure.reason === "unconfigured" ? "unconfigured" as const : "degraded" as const,
        reason: failure.reason,
        warning: goatCounterFailureMessage(failure.reason, "event tracking"),
        totals: {
          events: null,
          visitors: null,
          visits: null,
          uniqueEvents: null,
          comparison: {
            events: null,
            visitors: null,
            visits: null,
            uniqueEvents: null,
          },
        },
        items: [],
        series: [],
        recent: [],
      };
    }
    if (!current.ok || !hits.ok) {
      return {
        range,
        ...buildDegradedMeta(goatCounterFailureMessage("unavailable", "event tracking")),
        totals: {
          events: null,
          visitors: null,
          visits: null,
          uniqueEvents: null,
          comparison: {
            events: null,
            visitors: null,
            visits: null,
            uniqueEvents: null,
          },
        },
        items: [],
        series: [],
        recent: [],
      };
    }

    const eventRows = metricRowsFromHits(hits.data.hits, true).slice(0, 12);
    const eventHits = (hits.data.hits ?? []).filter((hit) => Boolean(hit.event));
    const currentEvents = typeof current.data.total_events === "number" ? current.data.total_events : null;
    const previousEvents = previous.ok && typeof previous.data.total_events === "number" ? previous.data.total_events : null;

    return {
      range,
      status: "ok" as const,
      totals: {
        events: currentEvents,
        visitors: currentEvents,
        visits: currentEvents,
        uniqueEvents: eventRows.length,
        comparison: {
          events: previousEvents,
          visitors: previousEvents,
          visits: previousEvents,
          uniqueEvents: 0,
        },
      },
      items: eventRows.map((row) => ({
        name: row.label,
        total: row.pageviews,
        share: row.share,
      })),
      series: eventHits.flatMap((hit) => (
        seriesFromGoatCounterStats(hit.stats, window.unit).map((point) => ({
          name: hit.path || hit.title || "event",
          timestamp: point.timestamp,
          value: point.value,
        }))
      )),
      recent: [],
    };
  }, cacheSuccessful);
}

async function getUmamiAdminAnalyticsReferrers(range: AnalyticsRange, logger: AnalyticsLogger) {
  const window = buildRangeWindow(range);
  return getCachedOrLoad(`analytics:umami:referrers:${range}`, async () => {
    const referrers = await fetchUmamiExpandedMetrics({
      type: "referrer",
      startAt: window.startAt,
      endAt: window.endAt,
      limit: 12,
      unit: window.unit,
      logger,
      operation: "referrers",
    });
    if (!referrers.ok) {
      return {
        range,
        status: referrers.reason === "unconfigured" ? "unconfigured" as const : "degraded" as const,
        reason: referrers.reason,
        warning: umamiFailureMessage(referrers.reason, "referrer data"),
        items: [],
      };
    }
    return {
      range,
      status: "ok" as const,
      items: normalizeExpandedRows(referrers.data).slice(0, 8).map((row) => ({
        referrer: row.label || "Direct",
        visitors: row.visitors,
        pageviews: row.pageviews,
        visits: row.visits,
        share: row.share,
      })),
    };
  }, cacheSuccessful);
}

export async function getAdminAnalyticsReferrers(
  actor: AnalyticsActor,
  range: AnalyticsRange,
  logger: AnalyticsLogger,
) {
  assertAdminAccess(actor);
  if (isUmamiConfigured()) {
    return getUmamiAdminAnalyticsReferrers(range, logger);
  }
  const window = buildRangeWindow(range);
  const currentRange = formatGoatCounterRange(window.startAt, window.endAt);

  return getCachedOrLoad(`analytics:referrers:${range}`, async () => {
    const referrers = await fetchGoatCounterJson<GoatCounterStatsResponse>({
      pathname: "stats/toprefs",
      params: currentRange,
      logger,
      operation: "referrers",
    });

    if (!referrers.ok) {
      return {
        range,
        status: referrers.reason === "unconfigured" ? "unconfigured" as const : "degraded" as const,
        reason: referrers.reason,
        warning: goatCounterFailureMessage(referrers.reason, "referrer data"),
        items: [],
      };
    }

    return {
      range,
      status: "ok" as const,
      items: metricRowsFromStats(referrers.data.stats).slice(0, 8).map((row) => ({
        referrer: row.label || "Direct",
        visitors: row.visitors,
        pageviews: row.pageviews,
        visits: row.visits,
        share: row.share,
      })),
    };
  }, cacheSuccessful);
}

function aggregateInsightStatus(sections: Array<{ status: InsightsSubsectionStatus }>) {
  return sections.some((section) => section.status === "degraded") ? "degraded" as const : "ok" as const;
}

export async function getAdminAnalyticsInsights(
  db: Database,
  actor: AnalyticsActor,
  range: AnalyticsRange,
  logger: AnalyticsLogger,
) {
  assertAdminAccess(actor);
  const window = buildRangeWindow(range);

  return getCachedOrLoad(`analytics:insights:${isUmamiConfigured() ? "umami" : "goatcounter"}:${range}`, async () => {
    const [
      entryPages,
      exitPages,
      devices,
      browsers,
      operatingSystems,
      countries,
      regions,
      channels,
      queries,
      conversionPathsRaw,
      overview,
    ] = await Promise.all([
      loadInsightsSubsection({
        window,
        metricType: "entry",
        limit: 12,
        logger,
        operation: "insights_entry_pages",
        emptyWarning: "Entry page data is temporarily unavailable for this period.",
      }),
      loadInsightsSubsection({
        window,
        metricType: "exit",
        limit: 12,
        logger,
        operation: "insights_exit_pages",
        emptyWarning: "Exit page data is temporarily unavailable for this period.",
      }),
      loadInsightsSubsection({
        window,
        metricType: "device",
        limit: 8,
        logger,
        operation: "insights_devices",
        emptyWarning: "Device data is temporarily unavailable for this period.",
      }),
      loadInsightsSubsection({
        window,
        metricType: "browser",
        limit: 10,
        logger,
        operation: "insights_browsers",
        emptyWarning: "Browser data is temporarily unavailable for this period.",
      }),
      loadInsightsSubsection({
        window,
        metricType: "os",
        limit: 8,
        logger,
        operation: "insights_operating_systems",
        emptyWarning: "Operating system data is temporarily unavailable for this period.",
      }),
      loadInsightsSubsection({
        window,
        metricType: "country",
        limit: 10,
        logger,
        operation: "insights_countries",
        emptyWarning: "Country data is temporarily unavailable for this period.",
      }),
      loadInsightsSubsection({
        window,
        metricType: "region",
        limit: 10,
        logger,
        operation: "insights_regions",
        emptyWarning: "Region data is temporarily unavailable for this period.",
      }),
      loadInsightsSubsection({
        window,
        metricType: "channel",
        limit: 10,
        logger,
        operation: "insights_channels",
        emptyWarning: "Campaign channel data is temporarily unavailable for this period.",
      }),
      loadInsightsSubsection({
        window,
        metricType: "query",
        limit: 30,
        logger,
        operation: "insights_queries",
        emptyWarning: "Campaign query data is temporarily unavailable for this period.",
      }),
      loadInsightsSubsection({
        window,
        metricType: "path",
        limit: 50,
        logger,
        operation: "insights_conversion_paths",
        emptyWarning: "Conversion path data is temporarily unavailable for this period.",
      }),
      getAdminAnalyticsOverview(db, actor, range),
    ]);

    const geographyStatus = aggregateInsightStatus([countries, regions]);
    const [utmSources, utmMediums] = isUmamiConfigured()
      ? await Promise.all([
        fetchUmamiExpandedMetrics({
          type: "utmSource",
          startAt: window.startAt,
          endAt: window.endAt,
          limit: 12,
          unit: window.unit,
          logger,
          operation: "insights_utm_source",
        }),
        fetchUmamiExpandedMetrics({
          type: "utmMedium",
          startAt: window.startAt,
          endAt: window.endAt,
          limit: 12,
          unit: window.unit,
          logger,
          operation: "insights_utm_medium",
        }),
      ])
      : [null, null];
    const utmRows = isUmamiConfigured()
      ? [
        ...queries.items.map((row) => ({
          ...row,
          utmSource: null,
          utmMedium: null,
          utmCampaign: row.label,
          sourceType: "utm" as const,
        })),
        ...(utmSources?.ok ? normalizeExpandedRows(utmSources.data) : []).map((row) => ({
          ...row,
          utmSource: row.label,
          utmMedium: null,
          utmCampaign: null,
          sourceType: "utm" as const,
        })),
        ...(utmMediums?.ok ? normalizeExpandedRows(utmMediums.data) : []).map((row) => ({
          ...row,
          utmSource: null,
          utmMedium: row.label,
          utmCampaign: null,
          sourceType: "utm" as const,
        })),
      ]
      : [];
    const campaignRows = utmRows.length > 0
      ? { hasUtmData: true, items: utmRows }
      : buildCampaignRows(channels.items, queries.items);
    const campaignStatus = aggregateInsightStatus([channels, queries]);
    const conversionPathItems = buildConversionPathInsights(conversionPathsRaw.items);
    const recommendations = buildStrategicRecommendations({
      conversionPaths: conversionPathItems,
      devices: devices.items,
      channels: channels.items,
      overview,
    });
    const sections = [
      entryPages,
      exitPages,
      devices,
      browsers,
      operatingSystems,
      countries,
      regions,
      channels,
      queries,
      conversionPathsRaw,
    ];
    const status = aggregateInsightStatus(sections);

    return {
      range,
      status,
      ...(status === "degraded" ? { warning: "Some analytics insight sections are temporarily unavailable." } : {}),
      supportedMetricTypes: sections
        .filter((section) => section.status === "ok")
        .map((section) => section.metricType),
      entryPages,
      exitPages,
      devices,
      browsers,
      operatingSystems,
      geography: {
        countries: countries.items,
        regions: regions.items,
        status: geographyStatus,
        ...(geographyStatus !== "ok" ? { warning: countries.warning ?? regions.warning ?? "Geographic data is temporarily unavailable." } : {}),
      },
      campaigns: {
        items: campaignRows.items,
        status: campaignStatus,
        ...(campaignStatus !== "ok" ? { warning: channels.warning ?? queries.warning ?? "Campaign tracking data is temporarily unavailable." } : {}),
        hasUtmData: campaignRows.hasUtmData,
      },
      conversionPaths: {
        items: conversionPathItems,
        status: conversionPathsRaw.status,
        ...(conversionPathsRaw.warning ? { warning: conversionPathsRaw.warning } : {}),
      },
      recommendations: {
        items: recommendations,
        status: "ok" as const,
      },
    };
  }, cacheSuccessful);
}

export async function getAdminAnalyticsOverview(
  db: Database,
  actor: AnalyticsActor,
  range: AnalyticsRange,
) {
  assertAdminAccess(actor);
  const window = buildRangeWindow(range);

  return getCachedOrLoad(`analytics:overview:${range}`, async () => {
    const [orderRows, bookingRows, subscriptionRows, userRows, clientRows] = await Promise.all([
      db.select({
        id: orders.id,
        label: orders.label,
        amount: orders.amount,
        currency: orders.currency,
        status: orders.status,
        type: orders.type,
        createdAt: orders.created_at,
      }).from(orders).orderBy(desc(orders.created_at)),
      db.select({
        id: bookings.id,
        status: bookings.status,
        sessionType: bookings.session_type,
        fullName: bookings.full_name,
        createdAt: bookings.created_at,
      }).from(bookings).orderBy(desc(bookings.created_at)),
      db.select({
        id: subscriptions.id,
        status: subscriptions.status,
        createdAt: subscriptions.created_at,
        currentPeriodEnd: subscriptions.current_period_end,
        archived: subscriptions.archived,
      }).from(subscriptions),
      db.select({
        id: users.id,
        email: users.email,
        createdAt: users.created_at,
      }).from(users).orderBy(desc(users.created_at)),
      db.select({
        id: clients.id,
        createdAt: clients.created_at,
      }).from(clients).orderBy(desc(clients.created_at)),
    ]);

    const completedOrders = orderRows.filter((row) => ORDER_METRIC_STATUSES.has(row.status));
    const currentOrders = completedOrders.filter((row) =>
      row.createdAt.getTime() >= window.startAt && row.createdAt.getTime() <= window.endAt,
    );
    const previousOrders = completedOrders.filter((row) =>
      row.createdAt.getTime() >= window.previousStartAt && row.createdAt.getTime() < window.previousEndAt,
    );

    const currentRevenueCents = currentOrders.reduce((sum, row) => sum + row.amount, 0);
    const previousRevenueCents = previousOrders.reduce((sum, row) => sum + row.amount, 0);

    const currentBookedSessions = bookingRows.filter((row) =>
      SESSION_BOOKED_STATUSES.has(row.status)
      && row.createdAt.getTime() >= window.startAt
      && row.createdAt.getTime() <= window.endAt,
    ).length;
    const previousBookedSessions = bookingRows.filter((row) =>
      SESSION_BOOKED_STATUSES.has(row.status)
      && row.createdAt.getTime() >= window.previousStartAt
      && row.createdAt.getTime() < window.previousEndAt,
    ).length;

    const activeSubscriptions = subscriptionRows.filter((row) =>
      !row.archived && ACTIVE_SUBSCRIPTION_STATUSES.has(row.status),
    ).length;
    const previousActiveSubscriptions = subscriptionRows.filter((row) =>
      !row.archived
      && ACTIVE_SUBSCRIPTION_STATUSES.has(row.status)
      && row.createdAt.getTime() < window.previousEndAt,
    ).length;

    const recentActivity = [
      ...currentOrders.slice(0, 6).map((row) => ({
        id: `order-${row.id}`,
        kind: "purchase" as const,
        title: "Order completed",
        detail: row.label,
        createdAt: row.createdAt.toISOString(),
      })),
      ...bookingRows
        .filter((row) => SESSION_BOOKED_STATUSES.has(row.status))
        .slice(0, 6)
        .map((row) => ({
          id: `booking-${row.id}`,
          kind: "booking" as const,
          title: `${row.sessionType} session booked`,
          detail: row.fullName || "Booking recorded",
          createdAt: row.createdAt.toISOString(),
        })),
      ...userRows.slice(0, 6).map((row) => ({
        id: `signup-${row.id}`,
        kind: "signup" as const,
        title: "New signup",
        detail: row.email,
        createdAt: row.createdAt.toISOString(),
      })),
    ]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 12);

    const { startOfToday, startOfWeek, startOfMonth } = reportingCalendarBounds();

    const ordersToday = completedOrders.filter((row) => row.createdAt >= startOfToday).length;
    const ordersThisWeek = completedOrders.filter((row) => row.createdAt >= startOfWeek).length;
    const revenueThisMonth = toMoney(
      completedOrders
        .filter((row) => row.createdAt >= startOfMonth)
        .reduce((sum, row) => sum + row.amount, 0),
    );

    return {
      range,
      status: "ok" as const,
      businessMetrics: {
        revenue: {
          currency: "CAD",
          value: toMoney(currentRevenueCents),
          trend: getTrendMetric(currentRevenueCents, previousRevenueCents, "previous period"),
        },
        orders: {
          value: currentOrders.length,
          trend: getTrendMetric(currentOrders.length, previousOrders.length, "previous period"),
        },
        activeSubscriptions: {
          value: activeSubscriptions,
          trend: getTrendMetric(activeSubscriptions, previousActiveSubscriptions, "previous snapshot"),
        },
        sessionsBooked: {
          value: currentBookedSessions,
          trend: getTrendMetric(currentBookedSessions, previousBookedSessions, "previous period"),
        },
      },
      recentActivity,
      conversionInsights: {
        ordersToday,
        ordersThisWeek,
        revenueThisMonth,
        totalUsers: userRows.length,
        totalClients: clientRows.length,
      },
    };
  });
}
