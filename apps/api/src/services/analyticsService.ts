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

export type AnalyticsRange = "24h" | "7d" | "30d";
export type AnalyticsStatus = "ok" | "degraded";

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

interface UmamiStatsResponse {
  pageviews?: number;
  visitors?: number;
  visits?: number;
  bounces?: number;
  totaltime?: number;
  comparison?: {
    pageviews?: number;
    visitors?: number;
    visits?: number;
    bounces?: number;
    totaltime?: number;
  };
}

interface UmamiMetricRow {
  x?: string;
  y?: number;
  name?: string;
  country?: string;
  pageviews?: number;
  visitors?: number;
  visits?: number;
  bounces?: number;
  totaltime?: number;
}

interface UmamiPageviewsResponse {
  pageviews?: Array<{ x?: string; y?: number }>;
  sessions?: Array<{ x?: string; y?: number }>;
}

interface UmamiEventStatsResponse {
  data?: {
    events?: number;
    visitors?: number;
    visits?: number;
    uniqueEvents?: number;
    comparison?: {
      events?: number;
      visitors?: number;
      visits?: number;
      uniqueEvents?: number;
    };
  };
}

interface UmamiEventListResponse {
  data?: Array<{
    id?: string;
    createdAt?: string;
    urlPath?: string;
    pageTitle?: string;
    eventName?: string;
    referrerDomain?: string;
  }>;
}

type TrendDirection = "up" | "down" | "neutral";
type InsightsSubsectionStatus = "ok" | "degraded" | "unsupported";
type UmamiExpandedMetricType =
  | "path"
  | "entry"
  | "exit"
  | "device"
  | "browser"
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
  metricType: UmamiExpandedMetricType;
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
const DEFAULT_UMAMI_WEBSITE_ID = "db9c7631-014a-4dc3-b9c2-967afed009f7";
const DEFAULT_UMAMI_DASHBOARD_URL = "https://cloud.umami.is";
const DEFAULT_UMAMI_API_URL = "https://api.umami.is/v1";
const CONVERSION_ROUTE_LABELS = [
  { prefix: "/sessions/regeneration", label: "Regeneration Monthly Package interest" },
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

function getUmamiApiKey() {
  return process.env.UMAMI_API_KEY?.trim() || process.env.UMANI_API_KEY?.trim() || "";
}

function getUmamiWebsiteId() {
  return process.env.UMAMI_WEBSITE_ID?.trim() || DEFAULT_UMAMI_WEBSITE_ID;
}

function getUmamiApiUrl() {
  const configured = process.env.UMAMI_API_URL?.trim();
  if (!configured) {
    return DEFAULT_UMAMI_API_URL;
  }

  try {
    const normalized = new URL(configured);
    if (normalized.hostname === "cloud.umami.is" && /^\/api\/?$/.test(normalized.pathname)) {
      return DEFAULT_UMAMI_API_URL;
    }
  } catch {
    return configured;
  }

  return configured;
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

async function getCachedOrLoad<T>(cacheKey: string, loader: () => Promise<T>) {
  const cached = getCachedValue<T>(cacheKey);
  if (cached) {
    return cached;
  }

  const value = await loader();
  setCachedValue(cacheKey, value);
  return value;
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

function calculateBounceRate(row: UmamiMetricRow) {
  const visits = numberValue(row.visits);
  if (visits <= 0) {
    return 0;
  }
  return Math.round((numberValue(row.bounces) / visits) * 100);
}

function normalizeMetricLabel(row: UmamiMetricRow) {
  return stringValue(row.name ?? row.x);
}

export function normalizeExpandedRows(rows: UmamiMetricRow[] | null | undefined): AnalyticsMetricRow[] {
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
  const regeneration = findMetric(input.conversionPaths, "/sessions/regeneration");
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

function buildUmamiRequestUrl(pathname: string, params: Record<string, string | number | undefined>) {
  const baseUrl = getUmamiApiUrl();
  if (!baseUrl) {
    return null;
  }

  const url = new URL(pathname.replace(/^\//, ""), `${baseUrl.replace(/\/+$/, "")}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }
    url.searchParams.set(key, String(value));
  }
  return url;
}

async function fetchUmamiJson<T>(
  input: {
    pathname: string;
    params?: Record<string, string | number | undefined>;
    logger: AnalyticsLogger;
    operation: string;
  },
): Promise<T | null> {
  const apiKey = getUmamiApiKey();
  const websiteId = getUmamiWebsiteId();
  const url = buildUmamiRequestUrl(`websites/${websiteId ?? ""}/${input.pathname}`, input.params ?? {});

  if (!apiKey || !websiteId || !url) {
    input.logger.warn(
      {
        operation: input.operation,
        hasApiKey: Boolean(apiKey),
        hasWebsiteId: Boolean(websiteId),
        hasApiUrl: Boolean(getUmamiApiUrl()),
      },
      "Umami analytics running in degraded mode",
    );
    return null;
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "x-umami-api-key": apiKey,
      },
    });

    if (!response.ok) {
      input.logger.warn(
        {
          operation: input.operation,
          status: response.status,
          url: url.toString(),
        },
        "Umami analytics request failed",
      );
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    input.logger.warn(
      {
        operation: input.operation,
        error: error instanceof Error ? error.message : "unknown_error",
      },
      "Umami analytics request failed",
    );
    return null;
  }
}

function normalizeSeries(values: Array<{ x?: string; y?: number }> | undefined) {
  return (values ?? []).map((entry) => ({
    timestamp: stringValue(entry.x),
    value: numberValue(entry.y),
  }));
}

async function fetchUmamiExpandedMetrics(input: {
  window: AnalyticsRangeWindow;
  metricType: UmamiExpandedMetricType;
  limit: number;
  logger: AnalyticsLogger;
  operation: string;
}) {
  return fetchUmamiJson<UmamiMetricRow[]>({
    pathname: "metrics/expanded",
    params: {
      startAt: input.window.startAt,
      endAt: input.window.endAt,
      type: input.metricType,
      limit: input.limit,
    },
    logger: input.logger,
    operation: input.operation,
  });
}

export async function loadInsightsSubsection(input: {
  window: AnalyticsRangeWindow;
  metricType: UmamiExpandedMetricType;
  limit: number;
  logger: AnalyticsLogger;
  operation: string;
  emptyWarning: string;
}): Promise<AnalyticsInsightSubsection> {
  try {
    const rows = await fetchUmamiExpandedMetrics(input);
    if (!rows) {
      input.logger.warn(
        { operation: input.operation, metricType: input.metricType, status: "degraded" },
        "analytics_insights_subsection_degraded",
      );
      return {
        status: "degraded",
        warning: input.emptyWarning,
        metricType: input.metricType,
        items: [],
      };
    }

    return {
      status: "ok",
      metricType: input.metricType,
      items: normalizeExpandedRows(rows),
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

export async function getAdminAnalyticsSummary(
  actor: AnalyticsActor,
  range: AnalyticsRange,
  logger: AnalyticsLogger,
) {
  assertAdminAccess(actor);
  const window = buildRangeWindow(range);
  const websiteId = getUmamiWebsiteId();

  return getCachedOrLoad(`analytics:summary:${range}`, async () => {
    const stats = await fetchUmamiJson<UmamiStatsResponse>({
      pathname: "stats",
      params: {
        startAt: window.startAt,
        endAt: window.endAt,
      },
      logger,
      operation: "summary",
    });

    if (!stats) {
      return {
        range,
        ...buildDegradedMeta("Umami traffic summary is temporarily unavailable."),
        traffic: {
          visitors: 0,
          pageviews: 0,
          sessions: 0,
          bounces: 0,
          totalTimeSeconds: 0,
          averageSessionSeconds: 0,
          activeVisitors: 0,
        },
        trends: {
          visitors: getTrendMetric(0, 0, "previous period"),
          pageviews: getTrendMetric(0, 0, "previous period"),
          sessions: getTrendMetric(0, 0, "previous period"),
        },
        umami: {
          websiteId,
          dashboardUrl: DEFAULT_UMAMI_DASHBOARD_URL,
          connected: false,
        },
      };
    }

    const active = await fetchUmamiJson<{ visitors?: number }>({
      pathname: "active",
      logger,
      operation: "active_users",
    });

    const totalTimeSeconds = Math.round(numberValue(stats.totaltime));
    const sessions = numberValue(stats.visits);

    return {
      range,
      status: "ok" as const,
      traffic: {
        visitors: numberValue(stats.visitors),
        pageviews: numberValue(stats.pageviews),
        sessions,
        bounces: numberValue(stats.bounces),
        totalTimeSeconds,
        averageSessionSeconds: sessions > 0 ? Math.round(totalTimeSeconds / sessions) : 0,
        activeVisitors: numberValue(active?.visitors),
      },
      trends: {
        visitors: getTrendMetric(numberValue(stats.visitors), numberValue(stats.comparison?.visitors), "previous period"),
        pageviews: getTrendMetric(numberValue(stats.pageviews), numberValue(stats.comparison?.pageviews), "previous period"),
        sessions: getTrendMetric(numberValue(stats.visits), numberValue(stats.comparison?.visits), "previous period"),
      },
      umami: {
        websiteId,
        dashboardUrl: DEFAULT_UMAMI_DASHBOARD_URL,
        connected: true,
      },
    };
  });
}

export async function getAdminAnalyticsPageviews(
  actor: AnalyticsActor,
  range: AnalyticsRange,
  logger: AnalyticsLogger,
) {
  assertAdminAccess(actor);
  const window = buildRangeWindow(range);

  return getCachedOrLoad(`analytics:pageviews:${range}`, async () => {
    const [pageviews, topPages] = await Promise.all([
      fetchUmamiJson<UmamiPageviewsResponse>({
        pathname: "pageviews",
        params: {
          startAt: window.startAt,
          endAt: window.endAt,
          unit: window.unit,
          timezone: window.timezone,
          compare: "prev",
        },
        logger,
        operation: "pageviews",
      }),
      fetchUmamiJson<UmamiMetricRow[]>({
        pathname: "metrics/expanded",
        params: {
          startAt: window.startAt,
          endAt: window.endAt,
          type: "path",
          limit: 8,
        },
        logger,
        operation: "top_pages",
      }),
    ]);

    if (!pageviews || !topPages) {
      return {
        range,
        ...buildDegradedMeta("Umami pageview metrics are temporarily unavailable."),
        series: {
          pageviews: [],
          sessions: [],
        },
        topPages: [],
      };
    }

    return {
      range,
      status: "ok" as const,
      series: {
        pageviews: normalizeSeries(pageviews.pageviews),
        sessions: normalizeSeries(pageviews.sessions),
      },
      topPages: topPages.map((row) => ({
        path: stringValue(row.name ?? row.x),
        visitors: numberValue(row.visitors),
        pageviews: numberValue(row.pageviews),
        visits: numberValue(row.visits),
        bounceRate: row.visits ? Math.round((numberValue(row.bounces) / numberValue(row.visits)) * 100) : 0,
      })),
    };
  });
}

export async function getAdminAnalyticsEvents(
  actor: AnalyticsActor,
  range: AnalyticsRange,
  logger: AnalyticsLogger,
) {
  assertAdminAccess(actor);
  const window = buildRangeWindow(range);

  return getCachedOrLoad(`analytics:events:${range}`, async () => {
    const [eventStats, eventMetrics, eventSeries, recentEvents] = await Promise.all([
      fetchUmamiJson<UmamiEventStatsResponse>({
        pathname: "events/stats",
        params: {
          startAt: window.startAt,
          endAt: window.endAt,
          compare: "prev",
        },
        logger,
        operation: "event_stats",
      }),
      fetchUmamiJson<UmamiMetricRow[]>({
        pathname: "metrics",
        params: {
          startAt: window.startAt,
          endAt: window.endAt,
          type: "event",
          limit: 12,
        },
        logger,
        operation: "event_metrics",
      }),
      fetchUmamiJson<Array<{ x?: string; t?: string; y?: number }>>({
        pathname: "events/series",
        params: {
          startAt: window.startAt,
          endAt: window.endAt,
          unit: window.unit,
          timezone: window.timezone,
        },
        logger,
        operation: "event_series",
      }),
      fetchUmamiJson<UmamiEventListResponse>({
        pathname: "events",
        params: {
          startAt: window.startAt,
          endAt: window.endAt,
          page: 1,
          pageSize: 8,
        },
        logger,
        operation: "recent_events",
      }),
    ]);

    if (!eventStats || !eventMetrics || !eventSeries || !recentEvents) {
      return {
        range,
        ...buildDegradedMeta("Umami event tracking is temporarily unavailable."),
        totals: {
          events: 0,
          visitors: 0,
          visits: 0,
          uniqueEvents: 0,
          comparison: {
            events: 0,
            visitors: 0,
            visits: 0,
            uniqueEvents: 0,
          },
        },
        items: [],
        series: [],
        recent: [],
      };
    }

    const totalTrackedEvents = eventMetrics.reduce((sum, entry) => sum + numberValue(entry.y), 0);

    return {
      range,
      status: "ok" as const,
      totals: {
        events: numberValue(eventStats.data?.events),
        visitors: numberValue(eventStats.data?.visitors),
        visits: numberValue(eventStats.data?.visits),
        uniqueEvents: numberValue(eventStats.data?.uniqueEvents),
        comparison: {
          events: numberValue(eventStats.data?.comparison?.events),
          visitors: numberValue(eventStats.data?.comparison?.visitors),
          visits: numberValue(eventStats.data?.comparison?.visits),
          uniqueEvents: numberValue(eventStats.data?.comparison?.uniqueEvents),
        },
      },
      items: eventMetrics.map((entry) => ({
        name: stringValue(entry.x),
        total: numberValue(entry.y),
        share: totalTrackedEvents > 0 ? Math.round((numberValue(entry.y) / totalTrackedEvents) * 100) : 0,
      })),
      series: eventSeries.map((entry) => ({
        name: stringValue(entry.x),
        timestamp: stringValue(entry.t),
        value: numberValue(entry.y),
      })),
      recent: (recentEvents.data ?? []).map((entry) => ({
        id: stringValue(entry.id),
        eventName: stringValue(entry.eventName) || "pageview",
        createdAt: stringValue(entry.createdAt),
        path: stringValue(entry.urlPath),
        title: stringValue(entry.pageTitle),
        referrer: stringValue(entry.referrerDomain),
      })),
    };
  });
}

export async function getAdminAnalyticsReferrers(
  actor: AnalyticsActor,
  range: AnalyticsRange,
  logger: AnalyticsLogger,
) {
  assertAdminAccess(actor);
  const window = buildRangeWindow(range);

  return getCachedOrLoad(`analytics:referrers:${range}`, async () => {
    const referrers = await fetchUmamiJson<UmamiMetricRow[]>({
      pathname: "metrics/expanded",
      params: {
        startAt: window.startAt,
        endAt: window.endAt,
        type: "referrer",
        limit: 8,
      },
      logger,
      operation: "referrers",
    });

    if (!referrers) {
      return {
        range,
        ...buildDegradedMeta("Umami referrer data is temporarily unavailable."),
        items: [],
      };
    }

    const totalVisitors = referrers.reduce((sum, row) => sum + numberValue(row.visitors), 0);

    return {
      range,
      status: "ok" as const,
      items: referrers.map((row) => ({
        referrer: stringValue(row.name ?? row.x) || "Direct",
        visitors: numberValue(row.visitors),
        pageviews: numberValue(row.pageviews),
        visits: numberValue(row.visits),
        share: totalVisitors > 0 ? Math.round((numberValue(row.visitors) / totalVisitors) * 100) : 0,
      })),
    };
  });
}

function aggregateInsightStatus(sections: Array<{ status: InsightsSubsectionStatus }>) {
  return sections.some((section) => section.status !== "ok") ? "degraded" as const : "ok" as const;
}

export async function getAdminAnalyticsInsights(
  db: Database,
  actor: AnalyticsActor,
  range: AnalyticsRange,
  logger: AnalyticsLogger,
) {
  assertAdminAccess(actor);
  const window = buildRangeWindow(range);

  return getCachedOrLoad(`analytics:insights:${range}`, async () => {
    const [
      entryPages,
      exitPages,
      devices,
      browsers,
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
    const campaignRows = buildCampaignRows(channels.items, queries.items);
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
  });
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

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);

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
