export interface GoatCounterLogger {
  warn: (payload: Record<string, unknown>, message: string) => void;
}

export interface GoatCounterHit {
  path?: string;
  title?: string;
  count?: number;
  event?: boolean;
  path_id?: number;
  stats?: Array<{
    day?: string;
    daily?: number;
    hourly?: number[];
  }>;
}

export interface GoatCounterHitStat {
  id?: string;
  name?: string;
  count?: number;
  ref_scheme?: string;
}

export interface GoatCounterTotalResponse {
  total?: number;
  total_events?: number;
  total_utc?: number;
  pageviews?: number;
  total_pageviews?: number;
  stats?: Array<{
    day?: string;
    daily?: number;
    hourly?: number[];
  }>;
}

export type GoatCounterFailureReason =
  | "unconfigured"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "timeout"
  | "unavailable"
  | "invalid_response";

export type GoatCounterFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: GoatCounterFailureReason };

export interface GoatCounterHitsResponse {
  hits?: GoatCounterHit[];
  total?: number;
  more?: boolean;
}

export interface GoatCounterStatsResponse {
  stats?: GoatCounterHitStat[];
  more?: boolean;
}

const DEFAULT_GOATCOUNTER_SITE_URL = "https://primementor.goatcounter.com";
const DEFAULT_GOATCOUNTER_SCRIPT_URL = "https://gc.zgo.at/count.js";
const MAX_CONCURRENT = 3;
const REQUEST_TIMEOUT_MS = 8_000;

let activeRequests = 0;
const waiters: Array<() => void> = [];

export function getGoatCounterSiteUrl() {
  return (process.env.GOATCOUNTER_SITE_URL ?? process.env.GOATCOUNTER_URL ?? DEFAULT_GOATCOUNTER_SITE_URL).trim().replace(/\/+$/, "");
}

export function getGoatCounterApiToken() {
  return (process.env.GOATCOUNTER_API_TOKEN ?? process.env.GOATCOUNTER_API_KEY ?? "").trim();
}

export function getGoatCounterDashboardUrl() {
  return getGoatCounterSiteUrl();
}

export function getGoatCounterScriptUrl() {
  return process.env.GOATCOUNTER_SCRIPT_URL?.trim() || DEFAULT_GOATCOUNTER_SCRIPT_URL;
}

export function formatGoatCounterRange(startAt: number, endAt: number) {
  return {
    start: roundToHour(startAt).toISOString(),
    end: roundToHour(endAt).toISOString(),
  };
}

function roundToHour(value: number) {
  const date = new Date(value);
  date.setUTCMinutes(0, 0, 0);
  return date;
}

export function buildGoatCounterAuthHeaders(apiToken: string) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiToken}`,
  };
}

async function withRateLimit<T>(work: () => Promise<T>): Promise<T> {
  if (activeRequests >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => {
      waiters.push(resolve);
    });
  }
  activeRequests += 1;
  try {
    return await work();
  } finally {
    activeRequests -= 1;
    waiters.shift()?.();
  }
}

function buildRequestUrl(
  pathname: string,
  params: Record<string, string | number | boolean | undefined>,
) {
  const siteUrl = getGoatCounterSiteUrl();
  if (!siteUrl) {
    return null;
  }
  const url = new URL(`api/v0/${pathname.replace(/^\//, "")}`, `${siteUrl}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }
    url.searchParams.set(key, String(value));
  }
  return url;
}

export function goatCounterFailureMessage(reason: GoatCounterFailureReason, subject: string) {
  switch (reason) {
    case "unconfigured":
      return `GoatCounter is not configured, so ${subject} cannot be loaded.`;
    case "unauthorized":
    case "forbidden":
      return `GoatCounter rejected the API credentials, so ${subject} cannot be loaded.`;
    case "rate_limited":
      return `GoatCounter rate limit was reached while loading ${subject}.`;
    case "timeout":
      return `GoatCounter timed out while loading ${subject}.`;
    case "invalid_response":
      return `GoatCounter returned an unexpected response for ${subject}.`;
    default:
      return `GoatCounter is temporarily unavailable, so ${subject} cannot be loaded.`;
  }
}

function failureReasonForStatus(status: number): GoatCounterFailureReason {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  return "unavailable";
}

export function visitorCountFromTotal(total: GoatCounterTotalResponse | null | undefined) {
  if (!total || typeof total.total !== "number" || !Number.isFinite(total.total)) {
    return null;
  }
  const events = typeof total.total_events === "number" && Number.isFinite(total.total_events)
    ? total.total_events
    : 0;
  return Math.max(0, total.total - events);
}

export function pageviewCountFromTotal(total: GoatCounterTotalResponse | null | undefined) {
  const candidate = total?.pageviews ?? total?.total_pageviews;
  if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
    return null;
  }
  return Math.max(0, candidate);
}

export async function fetchGoatCounterJson<T>(input: {
  pathname: string;
  params?: Record<string, string | number | boolean | undefined>;
  logger: GoatCounterLogger;
  operation: string;
}): Promise<GoatCounterFetchResult<T>> {
  const apiToken = getGoatCounterApiToken();
  const url = buildRequestUrl(input.pathname, input.params ?? {});

  if (!apiToken || !url) {
    input.logger.warn(
      {
        operation: input.operation,
        reason: "unconfigured",
        hasApiToken: Boolean(apiToken),
        hasSiteUrl: Boolean(getGoatCounterSiteUrl()),
      },
      "GoatCounter analytics running in degraded mode",
    );
    return { ok: false, reason: "unconfigured" };
  }

  return withRateLimit(async () => {
    try {
      const response = await fetch(url, {
        headers: buildGoatCounterAuthHeaders(apiToken),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        const reason = failureReasonForStatus(response.status);
        input.logger.warn(
          {
            operation: input.operation,
            reason,
            status: response.status,
            pathname: input.pathname,
          },
          "GoatCounter analytics request failed",
        );
        return { ok: false, reason };
      }
      try {
        return { ok: true, data: await response.json() as T };
      } catch {
        input.logger.warn(
          {
            operation: input.operation,
            reason: "invalid_response",
            status: response.status,
            pathname: input.pathname,
          },
          "GoatCounter analytics request failed",
        );
        return { ok: false, reason: "invalid_response" };
      }
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      const reason: GoatCounterFailureReason = timedOut ? "timeout" : "unavailable";
      input.logger.warn(
        {
          operation: input.operation,
          reason,
          error: error instanceof Error ? error.name : "unknown_error",
        },
        "GoatCounter analytics request failed",
      );
      return { ok: false, reason };
    }
  });
}

export function seriesFromGoatCounterStats(
  stats: Array<{ day?: string; daily?: number; hourly?: number[] }> | undefined,
  unit: "hour" | "day",
) {
  const rows = stats ?? [];
  if (unit === "hour") {
    return rows.flatMap((row) => (row.hourly ?? []).map((value, hour) => ({
      timestamp: `${row.day ?? ""}T${String(hour).padStart(2, "0")}:00:00.000Z`,
      value: Number.isFinite(value) ? value : 0,
    })));
  }
  return rows.map((row) => ({
    timestamp: row.day ?? "",
    value: Number.isFinite(row.daily) ? Number(row.daily) : 0,
  }));
}

export function metricRowsFromHits(hits: GoatCounterHit[] | undefined, eventsOnly = false) {
  const rows = (hits ?? []).filter((hit) => Boolean(hit.event) === eventsOnly);
  const total = rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
  return rows.map((row) => {
    const count = Number(row.count) || 0;
    return {
      label: row.path || row.title || "Unknown",
      visitors: count,
      pageviews: count,
      visits: count,
      bounceRate: 0,
      share: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });
}

export function metricRowsFromStats(stats: GoatCounterHitStat[] | undefined) {
  const rows = stats ?? [];
  const total = rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
  return rows.map((row) => {
    const count = Number(row.count) || 0;
    return {
      label: row.name || row.id || "Unknown",
      visitors: count,
      pageviews: count,
      visits: count,
      bounceRate: 0,
      share: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });
}
