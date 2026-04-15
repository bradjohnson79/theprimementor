import { logger } from "@wisdom/utils";

export interface SearchWebLogger {
  warn?: (payload: Record<string, unknown>, message: string) => void;
  info?: (payload: Record<string, unknown>, message: string) => void;
}

export interface SearchWebResult {
  title: string;
  source: string;
  snippet: string;
  canonicalUrl: string;
  confidence: number;
}

export interface SearchWebResponse {
  provider: "tavily";
  query: string;
  results: SearchWebResult[];
  degraded: boolean;
  attempts: number;
  errorCode?: "missing_api_key" | "timeout" | "request_failed" | "invalid_response";
}

interface TavilySearchResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    score?: number;
  }>;
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_RESULTS = 4;
const MAX_RETRIES = 1;
const DEFAULT_PROVIDER_URL = "https://api.tavily.com/search";

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeText(value: unknown, limit: number) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function parseSource(urlValue: string) {
  try {
    const hostname = new URL(urlValue).hostname.replace(/^www\./, "");
    return hostname || "web";
  } catch {
    return "web";
  }
}

function getTimeoutMs() {
  const configured = Number.parseInt(process.env.DIVIN8_SEARCH_TIMEOUT_MS?.trim() || "", 10);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.max(4000, Math.min(6000, configured));
}

function getMaxResults() {
  const configured = Number.parseInt(process.env.DIVIN8_SEARCH_MAX_RESULTS?.trim() || "", 10);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_MAX_RESULTS;
  }
  return Math.max(3, Math.min(5, configured));
}

function getSearchApiKey() {
  return process.env.DIVIN8_SEARCH_API_KEY?.trim()
    || process.env.TAVILY_API_KEY?.trim()
    || "";
}

function getSearchApiUrl() {
  return process.env.DIVIN8_SEARCH_API_URL?.trim() || DEFAULT_PROVIDER_URL;
}

function normalizeResult(
  result: NonNullable<TavilySearchResponse["results"]>[number],
  index: number,
): SearchWebResult | null {
  const canonicalUrl = normalizeText(result.url, 400);
  const title = normalizeText(result.title, 180);
  const snippet = normalizeText(result.content, 420);

  if (!canonicalUrl || !title || !snippet) {
    return null;
  }

  const score = typeof result.score === "number"
    ? clamp01(result.score)
    : clamp01(0.92 - (index * 0.14));

  return {
    title,
    source: parseSource(canonicalUrl),
    snippet,
    canonicalUrl,
    confidence: Number(score.toFixed(3)),
  };
}

async function fetchTavilySearch(
  query: string,
  apiKey: string,
  attempt: number,
  timeoutMs: number,
  maxResults: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(getSearchApiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        max_results: maxResults,
        include_answer: false,
        include_images: false,
        include_raw_content: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`search_provider_status_${response.status}`);
    }

    const payload = (await response.json().catch(() => null)) as TavilySearchResponse | null;
    if (!payload || !Array.isArray(payload.results)) {
      throw new Error("invalid_search_provider_payload");
    }

    return {
      results: payload.results
        .slice(0, maxResults)
        .map((entry, index) => normalizeResult(entry, index))
        .filter((entry): entry is SearchWebResult => Boolean(entry)),
      attempt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchWeb(
  query: string,
  searchLogger: SearchWebLogger = {},
): Promise<SearchWebResponse> {
  const normalizedQuery = query.replace(/\s+/g, " ").trim().slice(0, 240);
  if (!normalizedQuery) {
    return {
      provider: "tavily",
      query: "",
      results: [],
      degraded: true,
      attempts: 0,
      errorCode: "invalid_response",
    };
  }

  const apiKey = getSearchApiKey();
  if (!apiKey) {
    searchLogger.warn?.(
      { query: normalizedQuery },
      "divin8_search_missing_api_key",
    );
    return {
      provider: "tavily",
      query: normalizedQuery,
      results: [],
      degraded: true,
      attempts: 0,
      errorCode: "missing_api_key",
    };
  }

  const timeoutMs = getTimeoutMs();
  const maxResults = getMaxResults();

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
    try {
      const response = await fetchTavilySearch(
        normalizedQuery,
        apiKey,
        attempt,
        timeoutMs,
        maxResults,
      );

      searchLogger.info?.(
        {
          query: normalizedQuery,
          results: response.results.length,
          attempt,
        },
        "divin8_search_completed",
      );

      return {
        provider: "tavily",
        query: normalizedQuery,
        results: response.results,
        degraded: false,
        attempts: attempt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const timedOut = error instanceof Error && error.name === "AbortError";
      const errorCode = timedOut
        ? "timeout"
        : message === "invalid_search_provider_payload"
          ? "invalid_response"
          : "request_failed";

      searchLogger.warn?.(
        {
          query: normalizedQuery,
          attempt,
          error: message,
          timeoutMs,
        },
        "divin8_search_attempt_failed",
      );

      if (attempt > MAX_RETRIES) {
        return {
          provider: "tavily",
          query: normalizedQuery,
          results: [],
          degraded: true,
          attempts: attempt,
          errorCode,
        };
      }
    }
  }

  logger.warn("divin8_search_unreachable_fallback", { query: normalizedQuery });
  return {
    provider: "tavily",
    query: normalizedQuery,
    results: [],
    degraded: true,
    attempts: MAX_RETRIES + 1,
    errorCode: "request_failed",
  };
}
