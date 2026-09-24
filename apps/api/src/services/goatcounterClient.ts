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
  stats?: Array<{
    day?: string;
    daily?: number;
    hourly?: number[];
  }>;
}

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

export async function fetchGoatCounterJson<T>(input: {
  pathname: string;
  params?: Record<string, string | number | boolean | undefined>;
  logger: GoatCounterLogger;
  operation: string;
}): Promise<T | null> {
  const apiToken = getGoatCounterApiToken();
  const url = buildRequestUrl(input.pathname, input.params ?? {});

  if (!apiToken || !url) {
    input.logger.warn(
      {
        operation: input.operation,
        hasApiToken: Boolean(apiToken),
        hasSiteUrl: Boolean(getGoatCounterSiteUrl()),
      },
      "GoatCounter analytics running in degraded mode",
    );
    return null;
  }

  return withRateLimit(async () => {
    try {
      const response = await fetch(url, {
        headers: buildGoatCounterAuthHeaders(apiToken),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        input.logger.warn(
          {
            operation: input.operation,
            status: response.status,
            url: url.toString(),
            body: body.slice(0, 200),
          },
          "GoatCounter analytics request failed",
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
        "GoatCounter analytics request failed",
      );
      return null;
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
