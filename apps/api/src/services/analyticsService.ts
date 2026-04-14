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

interface AnalyticsLogger {
  warn: (payload: Record<string, unknown>, message: string) => void;
}

interface AnalyticsRangeWindow {
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

interface TrendMetric {
  current: number;
  previous: number;
  delta: number;
  deltaLabel: string;
  direction: TrendDirection;
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

function buildUmamiRequestUrl(pathname: string, params: Record<string, string | number | undefined>) {
  const baseUrl = process.env.UMAMI_API_URL?.trim();
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
  const apiKey = process.env.UMAMI_API_KEY?.trim();
  const websiteId = process.env.UMAMI_WEBSITE_ID?.trim();
  const url = buildUmamiRequestUrl(`websites/${websiteId ?? ""}/${input.pathname}`, input.params ?? {});

  if (!apiKey || !websiteId || !url) {
    input.logger.warn(
      {
        operation: input.operation,
        hasApiKey: Boolean(apiKey),
        hasWebsiteId: Boolean(websiteId),
        hasApiUrl: Boolean(process.env.UMAMI_API_URL?.trim()),
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
          websiteId: process.env.UMAMI_WEBSITE_ID?.trim() ?? "",
          dashboardUrl: "https://cloud.umami.is",
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
        websiteId: process.env.UMAMI_WEBSITE_ID?.trim() ?? "",
        dashboardUrl: "https://cloud.umami.is",
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
