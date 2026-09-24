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
  metricRowsFromHits,
  metricRowsFromStats,
  seriesFromGoatCounterStats,
  type GoatCounterHitsResponse,
  type GoatCounterStatsResponse,
  type GoatCounterTotalResponse,
} from "./goatcounterClient.js";

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

const GOATCOUNTER_UNSUPPORTED_METRICS = new Set<InsightMetricType>(["entry", "exit", "region", "query"]);
const GOATCOUNTER_STAT_PAGES: Partial<Record<InsightMetricType, string>> = {
  device: "systems",
  browser: "browsers",
  country: "locations",
  channel: "campaigns",
};

function goatcounterConnection(connected: boolean) {
  const siteUrl = getGoatCounterSiteUrl();
  return {
    siteUrl,
    dashboardUrl: getGoatCounterDashboardUrl(),
    connected,
  };
}

function pageVisitCount(total: GoatCounterTotalResponse | null | undefined) {
  const visits = Number(total?.total) || 0;
  const events = Number(total?.total_events) || 0;
  return Math.max(0, visits - events);
}


export async function loadInsightsSubsection(input: {
  window: AnalyticsRangeWindow;
  metricType: InsightMetricType;
  limit: number;
  logger: AnalyticsLogger;
  operation: string;
  emptyWarning: string;
}): Promise<AnalyticsInsightSubsection> {
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
      if (!payload) {
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
        items: metricRowsFromHits(payload.hits, false).slice(0, input.limit),
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
    if (!payload) {
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
      items: metricRowsFromStats(payload.stats).slice(0, input.limit),
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

    if (!current) {
      return {
        range,
        ...buildDegradedMeta("GoatCounter traffic summary is temporarily unavailable."),
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
        goatcounter: goatcounterConnection(false),
      };
    }

    const visits = pageVisitCount(current);
    const previousVisits = pageVisitCount(previous);

    return {
      range,
      status: "ok" as const,
      traffic: {
        visitors: visits,
        pageviews: visits,
        sessions: visits,
        bounces: 0,
        totalTimeSeconds: 0,
        averageSessionSeconds: 0,
        activeVisitors: 0,
      },
      trends: {
        visitors: getTrendMetric(visits, previousVisits, "previous period"),
        pageviews: getTrendMetric(visits, previousVisits, "previous period"),
        sessions: getTrendMetric(visits, previousVisits, "previous period"),
      },
      goatcounter: goatcounterConnection(true),
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

    if (!totals || !hits) {
      return {
        range,
        ...buildDegradedMeta("GoatCounter pageview metrics are temporarily unavailable."),
        series: {
          pageviews: [],
          sessions: [],
        },
        topPages: [],
      };
    }

    const series = seriesFromGoatCounterStats(totals.stats, window.unit);

    return {
      range,
      status: "ok" as const,
      series: {
        pageviews: series,
        sessions: series,
      },
      topPages: metricRowsFromHits(hits.hits, false).slice(0, 8).map((row) => ({
        path: row.label,
        visitors: row.visitors,
        pageviews: row.pageviews,
        visits: row.visits,
        bounceRate: row.bounceRate,
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

    if (!current || !hits) {
      return {
        range,
        ...buildDegradedMeta("GoatCounter event tracking is temporarily unavailable."),
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

    const eventRows = metricRowsFromHits(hits.hits, true).slice(0, 12);
    const eventHits = (hits.hits ?? []).filter((hit) => Boolean(hit.event));
    const currentEvents = Number(current.total_events) || 0;
    const previousEvents = Number(previous?.total_events) || 0;

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
  });
}

export async function getAdminAnalyticsReferrers(
  actor: AnalyticsActor,
  range: AnalyticsRange,
  logger: AnalyticsLogger,
) {
  assertAdminAccess(actor);
  const window = buildRangeWindow(range);
  const currentRange = formatGoatCounterRange(window.startAt, window.endAt);

  return getCachedOrLoad(`analytics:referrers:${range}`, async () => {
    const referrers = await fetchGoatCounterJson<GoatCounterStatsResponse>({
      pathname: "stats/toprefs",
      params: currentRange,
      logger,
      operation: "referrers",
    });

    if (!referrers) {
      return {
        range,
        ...buildDegradedMeta("GoatCounter referrer data is temporarily unavailable."),
        items: [],
      };
    }

    return {
      range,
      status: "ok" as const,
      items: metricRowsFromStats(referrers.stats).slice(0, 8).map((row) => ({
        referrer: row.label || "Direct",
        visitors: row.visitors,
        pageviews: row.pageviews,
        visits: row.visits,
        share: row.share,
      })),
    };
  });
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
