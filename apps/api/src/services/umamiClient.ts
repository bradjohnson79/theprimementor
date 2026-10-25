export interface UmamiLogger {
  warn: (payload: Record<string, unknown>, message: string) => void;
}

export type UmamiFailureReason =
  | "unconfigured"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "timeout"
  | "unavailable"
  | "invalid_response";

export type UmamiFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: UmamiFailureReason };

export interface UmamiStats {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
}

export interface UmamiExpandedMetric {
  name: string;
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
}

export interface UmamiSeriesPoint {
  x: string;
  y: number;
}

export interface UmamiHealthSnapshot {
  service: "ok" | "degraded" | "unconfigured";
  database: "ok" | "unavailable" | "unknown";
  tracking: "ok" | "unavailable" | "unknown";
  reporting: "ok" | "degraded" | "unconfigured";
  lastSuccessAt: string | null;
  authFailures: number;
}

const REQUEST_TIMEOUT_MS = 8000;
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

let cachedToken: { value: string; expiresAt: number } | null = null;
let authFailures = 0;
let lastSuccessAt: string | null = null;

export function resetUmamiClientState() {
  cachedToken = null;
  authFailures = 0;
  lastSuccessAt = null;
}

export function getUmamiHealthSnapshot(reporting: UmamiHealthSnapshot["reporting"]): UmamiHealthSnapshot {
  if (!isUmamiConfigured()) {
    return {
      service: "unconfigured",
      database: "unknown",
      tracking: "unknown",
      reporting: "unconfigured",
      lastSuccessAt,
      authFailures,
    };
  }
  return {
    service: reporting === "ok" ? "ok" : "degraded",
    database: reporting === "ok" ? "ok" : "unknown",
    tracking: "unknown",
    reporting,
    lastSuccessAt,
    authFailures,
  };
}

export function isUmamiConfigured() {
  return Boolean(getUmamiBaseUrl() && getUmamiUsername() && getUmamiPassword() && getUmamiWebsiteId());
}

export function getUmamiBaseUrl() {
  return process.env.UMAMI_BASE_URL?.trim().replace(/\/$/, "") ?? "";
}

export function getUmamiUsername() {
  return process.env.UMAMI_USERNAME?.trim() ?? "";
}

export function getUmamiPassword() {
  return process.env.UMAMI_PASSWORD ?? "";
}

export function getUmamiWebsiteId() {
  return process.env.UMAMI_WEBSITE_ID?.trim() ?? "";
}

export function umamiFailureMessage(reason: UmamiFailureReason, subject: string) {
  switch (reason) {
    case "unconfigured":
      return `Umami is not configured, so ${subject} cannot be loaded.`;
    case "unauthorized":
    case "forbidden":
      return `Umami rejected the server credentials, so ${subject} cannot be loaded.`;
    case "rate_limited":
      return `Umami rate limit was reached while loading ${subject}.`;
    case "timeout":
      return `Umami timed out while loading ${subject}.`;
    case "invalid_response":
      return `Umami returned an unexpected response for ${subject}.`;
    default:
      return `Umami is temporarily unavailable, so ${subject} cannot be loaded.`;
  }
}

export function finiteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  if (value && typeof value === "object" && "value" in value) {
    return finiteNumber((value as { value: unknown }).value);
  }
  return null;
}

export function readUmamiStats(payload: unknown): { current: UmamiStats; previous: UmamiStats | null } | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const current = statsFromRecord(record);
  if (!current) {
    return null;
  }
  const comparison = record.comparison && typeof record.comparison === "object"
    ? statsFromRecord(record.comparison as Record<string, unknown>)
    : null;
  return { current, previous: comparison };
}

function statsFromRecord(record: Record<string, unknown>): UmamiStats | null {
  const pageviews = finiteNumber(record.pageviews);
  const visitors = finiteNumber(record.visitors);
  const visits = finiteNumber(record.visits);
  const bounces = finiteNumber(record.bounces);
  const totaltime = finiteNumber(record.totaltime);
  if (pageviews === null || visitors === null || visits === null || bounces === null || totaltime === null) {
    return null;
  }
  return { pageviews, visitors, visits, bounces, totaltime };
}

export function readExpandedMetrics(payload: unknown): UmamiExpandedMetric[] | null {
  if (!Array.isArray(payload)) {
    return null;
  }
  return payload.flatMap((row) => {
    if (!row || typeof row !== "object") {
      return [];
    }
    const record = row as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : typeof record.x === "string" ? record.x : "";
    if (!name) {
      return [];
    }
    return [{
      name,
      pageviews: finiteNumber(record.pageviews) ?? finiteNumber(record.y) ?? 0,
      visitors: finiteNumber(record.visitors) ?? 0,
      visits: finiteNumber(record.visits) ?? 0,
      bounces: finiteNumber(record.bounces) ?? 0,
    }];
  });
}

export function readSeries(payload: unknown, key: "pageviews" | "sessions") {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const rows = (payload as Record<string, unknown>)[key];
  if (!Array.isArray(rows)) {
    return null;
  }
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") {
      return [];
    }
    const record = row as Record<string, unknown>;
    const x = typeof record.x === "string" ? record.x : "";
    const y = finiteNumber(record.y);
    if (!x || y === null) {
      return [];
    }
    return [{ x, y }];
  });
}

export function readActiveVisitors(payload: unknown) {
  if (typeof payload === "number") {
    return finiteNumber(payload);
  }
  if (!payload || typeof payload !== "object") {
    return null;
  }
  return finiteNumber((payload as Record<string, unknown>).visitors);
}

export function readEventStats(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const data = record.data && typeof record.data === "object"
    ? record.data as Record<string, unknown>
    : record;
  const events = finiteNumber(data.events);
  const visitors = finiteNumber(data.visitors);
  const visits = finiteNumber(data.visits);
  const uniqueEvents = finiteNumber(data.uniqueEvents);
  if (events === null || visitors === null || visits === null || uniqueEvents === null) {
    return null;
  }
  const comparisonRecord = data.comparison && typeof data.comparison === "object"
    ? data.comparison as Record<string, unknown>
    : null;
  return {
    events,
    visitors,
    visits,
    uniqueEvents,
    comparison: comparisonRecord
      ? {
        events: finiteNumber(comparisonRecord.events),
        visitors: finiteNumber(comparisonRecord.visitors),
        visits: finiteNumber(comparisonRecord.visits),
        uniqueEvents: finiteNumber(comparisonRecord.uniqueEvents),
      }
      : null,
  };
}

function failureReasonForStatus(status: number): UmamiFailureReason {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  return "unavailable";
}

async function umamiStatus(pathname: string, logger: UmamiLogger, operation: string): Promise<UmamiFetchResult<true>> {
  const baseUrl = getUmamiBaseUrl();
  if (!baseUrl) {
    return { ok: false, reason: "unconfigured" };
  }
  const url = new URL(pathname.replace(/^\//, ""), `${baseUrl}/`);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn({ operation, pathname: url.pathname, status: response.status }, "umami_request_failed");
      return { ok: false, reason: failureReasonForStatus(response.status) };
    }
    return { ok: true, data: true };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    logger.warn({ operation, pathname: url.pathname, reason: timedOut ? "timeout" : "unavailable" }, "umami_request_failed");
    return { ok: false, reason: timedOut ? "timeout" : "unavailable" };
  }
}

async function umamiFetch(input: {
  pathname: string;
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
  logger: UmamiLogger;
  operation: string;
}): Promise<UmamiFetchResult<unknown>> {
  const baseUrl = getUmamiBaseUrl();
  if (!baseUrl) {
    return { ok: false, reason: "unconfigured" };
  }
  const url = new URL(input.pathname.replace(/^\//, ""), `${baseUrl}/`);
  try {
    const response = await fetch(url, {
      method: input.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(input.body ? { "Content-Type": "application/json" } : {}),
        ...(input.token ? { Authorization: `Bearer ${input.token}` } : {}),
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      input.logger.warn(
        { operation: input.operation, pathname: url.pathname, status: response.status },
        "umami_request_failed",
      );
      return { ok: false, reason: failureReasonForStatus(response.status) };
    }
    const text = await response.text();
    if (!text) {
      return { ok: true, data: null };
    }
    try {
      return { ok: true, data: JSON.parse(text) as unknown };
    } catch {
      input.logger.warn(
        { operation: input.operation, pathname: url.pathname, status: response.status },
        "umami_invalid_response",
      );
      return { ok: false, reason: "invalid_response" };
    }
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    input.logger.warn(
      {
        operation: input.operation,
        pathname: url.pathname,
        reason: timedOut ? "timeout" : "unavailable",
      },
      "umami_request_failed",
    );
    return { ok: false, reason: timedOut ? "timeout" : "unavailable" };
  }
}

async function login(logger: UmamiLogger): Promise<UmamiFetchResult<string>> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return { ok: true, data: cachedToken.value };
  }
  const username = getUmamiUsername();
  const password = getUmamiPassword();
  if (!username || !password) {
    return { ok: false, reason: "unconfigured" };
  }
  const result = await umamiFetch({
    pathname: "/api/auth/login",
    method: "POST",
    body: { username, password },
    logger,
    operation: "login",
  });
  if (!result.ok) {
    if (result.reason === "unauthorized" || result.reason === "forbidden") {
      authFailures += 1;
    }
    cachedToken = null;
    return result;
  }
  const token = result.data && typeof result.data === "object"
    ? (result.data as { token?: unknown }).token
    : null;
  if (typeof token !== "string" || !token) {
    authFailures += 1;
    return { ok: false, reason: "invalid_response" };
  }
  cachedToken = { value: token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return { ok: true, data: token };
}

export async function umamiRequest<T>(input: {
  pathname: string;
  logger: UmamiLogger;
  operation: string;
  parse: (payload: unknown) => T | null;
}): Promise<UmamiFetchResult<T>> {
  if (!isUmamiConfigured()) {
    return { ok: false, reason: "unconfigured" };
  }
  let auth = await login(input.logger);
  if (!auth.ok) {
    return auth;
  }
  let result = await umamiFetch({
    pathname: input.pathname,
    token: auth.data,
    logger: input.logger,
    operation: input.operation,
  });
  if (!result.ok && result.reason === "unauthorized") {
    cachedToken = null;
    auth = await login(input.logger);
    if (!auth.ok) {
      return auth;
    }
    result = await umamiFetch({
      pathname: input.pathname,
      token: auth.data,
      logger: input.logger,
      operation: input.operation,
    });
  }
  if (!result.ok) {
    return result;
  }
  const parsed = input.parse(result.data);
  if (parsed === null) {
    input.logger.warn({ operation: input.operation, pathname: input.pathname }, "umami_invalid_response");
    return { ok: false, reason: "invalid_response" };
  }
  lastSuccessAt = new Date().toISOString();
  return { ok: true, data: parsed };
}

export function umamiRangeQuery(startAt: number, endAt: number, unit: "hour" | "day", extra: Record<string, string | number> = {}) {
  const params = new URLSearchParams({
    startAt: String(startAt),
    endAt: String(endAt),
    unit,
    timezone: "America/Vancouver",
  });
  for (const [key, value] of Object.entries(extra)) {
    params.set(key, String(value));
  }
  return params.toString();
}

export async function fetchUmamiStats(input: {
  startAt: number;
  endAt: number;
  logger: UmamiLogger;
  operation: string;
}) {
  const query = umamiRangeQuery(input.startAt, input.endAt, "day");
  return umamiRequest({
    pathname: `/api/websites/${getUmamiWebsiteId()}/stats?${query}`,
    logger: input.logger,
    operation: input.operation,
    parse: readUmamiStats,
  });
}

export async function fetchUmamiActiveVisitors(logger: UmamiLogger) {
  return umamiRequest({
    pathname: `/api/websites/${getUmamiWebsiteId()}/active`,
    logger,
    operation: "active_visitors",
    parse: (payload) => {
      const visitors = readActiveVisitors(payload);
      return visitors === null ? null : { visitors };
    },
  });
}

export async function fetchUmamiExpandedMetrics(input: {
  type: string;
  startAt: number;
  endAt: number;
  limit: number;
  unit: "hour" | "day";
  logger: UmamiLogger;
  operation: string;
}) {
  const query = umamiRangeQuery(input.startAt, input.endAt, input.unit, {
    type: input.type,
    limit: input.limit,
  });
  return umamiRequest({
    pathname: `/api/websites/${getUmamiWebsiteId()}/metrics/expanded?${query}`,
    logger: input.logger,
    operation: input.operation,
    parse: readExpandedMetrics,
  });
}

export async function fetchUmamiPageviewSeries(input: {
  startAt: number;
  endAt: number;
  unit: "hour" | "day";
  logger: UmamiLogger;
}) {
  const query = umamiRangeQuery(input.startAt, input.endAt, input.unit);
  return umamiRequest({
    pathname: `/api/websites/${getUmamiWebsiteId()}/pageviews?${query}`,
    logger: input.logger,
    operation: "pageviews",
    parse: (payload) => {
      const pageviews = readSeries(payload, "pageviews");
      const sessions = readSeries(payload, "sessions");
      if (!pageviews || !sessions) {
        return null;
      }
      return { pageviews, sessions };
    },
  });
}

export async function fetchUmamiEventStats(input: {
  startAt: number;
  endAt: number;
  logger: UmamiLogger;
  operation: string;
}) {
  const query = umamiRangeQuery(input.startAt, input.endAt, "day");
  return umamiRequest({
    pathname: `/api/websites/${getUmamiWebsiteId()}/events/stats?${query}`,
    logger: input.logger,
    operation: input.operation,
    parse: readEventStats,
  });
}

export async function probeUmamiHealth(logger: UmamiLogger): Promise<UmamiHealthSnapshot> {
  if (!isUmamiConfigured()) {
    return getUmamiHealthSnapshot("unconfigured");
  }
  const [heartbeat, script] = await Promise.all([
    umamiStatus("/api/heartbeat", logger, "heartbeat"),
    umamiStatus("/script.js", logger, "tracker_script"),
  ]);
  const reporting = heartbeat.ok ? "ok" as const : "degraded" as const;
  return {
    service: heartbeat.ok ? "ok" : "degraded",
    database: "unknown",
    tracking: script.ok ? "ok" : "unavailable",
    reporting,
    lastSuccessAt,
    authFailures,
  };
}
