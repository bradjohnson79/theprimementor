import { logger } from "@wisdom/utils";
import type { AdsAgentHealth, AdsAgentHealthStatus } from "./types.js";

export const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";
export const DEFAULT_ADS_AGENT_MODEL = "z-ai/glm-5.3-flash";
export const ADS_AGENT_MODEL_LABEL = "GLM 5.3 Flash";
export const ADS_AGENT_PROVIDER_LABEL = "OpenRouter";

export const ADS_AGENT_ERROR_CODES = {
  NOT_CONFIGURED: "OPENROUTER_NOT_CONFIGURED",
  AUTH: "OPENROUTER_AUTH_ERROR",
  MODEL_UNAVAILABLE: "ADS_AGENT_MODEL_UNAVAILABLE",
  UNAVAILABLE: "OPENROUTER_UNAVAILABLE",
} as const;

export const ADS_AGENT_ERROR_MESSAGES = {
  NOT_CONFIGURED: "OpenRouter has not been configured for the Ads Agent.",
  AUTH: "OpenRouter authentication failed.",
  MODEL_UNAVAILABLE: "GLM 5.3 Flash is currently unavailable.",
  UNAVAILABLE: "The Ads Agent could not reach OpenRouter.",
} as const;

const HEALTH_CACHE_MS = 30_000;
const HEALTH_TIMEOUT_MS = 8_000;
const CHAT_TIMEOUT_MS = 90_000;

export type OpenRouterFetch = typeof fetch;

export type OpenRouterChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

export type OpenRouterToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type OpenRouterChatTurn = {
  content: string | null;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
  assistantMessage: OpenRouterChatMessage;
};

type CachedHealth = {
  cacheKey: string;
  expiresAt: number;
  value: AdsAgentHealth;
};

let healthCache: CachedHealth | null = null;

export function configuredAdsAgentModel() {
  const configured = process.env.ADS_AGENT_MODEL?.trim();
  if (configured && configured !== DEFAULT_ADS_AGENT_MODEL) {
    logger.warn("ads_agent_model_locked", { requested: configured, locked: DEFAULT_ADS_AGENT_MODEL });
  }
  return DEFAULT_ADS_AGENT_MODEL;
}

export function openRouterApiKeyConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

function openRouterApiKey() {
  return process.env.OPENROUTER_API_KEY?.trim() || "";
}

function healthCacheKey(model: string) {
  return `${OPENROUTER_API_BASE}|${model}|${openRouterApiKeyConfigured() ? "configured" : "missing"}`;
}

function sanitizeProviderText(value: string) {
  return value
    .replace(/sk-or-v1-[A-Za-z0-9]+/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]");
}

export function openRouterAuthHeaders() {
  return openRouterHeaders(openRouterApiKey());
}

export function openRouterHeaders(apiKey: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim();
  const title = process.env.OPENROUTER_APP_TITLE?.trim() || "Prime Mentor Ads Agent";
  if (referer) headers["HTTP-Referer"] = referer;
  headers["X-Title"] = title;
  return headers;
}

function baseHealth(status: AdsAgentHealthStatus, message: string | null, reachable: boolean): AdsAgentHealth {
  return {
    provider: "openrouter",
    status,
    model: configuredAdsAgentModel(),
    modelLabel: ADS_AGENT_MODEL_LABEL,
    apiKeyConfigured: openRouterApiKeyConfigured(),
    reachable,
    message,
  };
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  fetcher: OpenRouterFetch,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function classifyHttpStatus(status: number): AdsAgentHealthStatus {
  if (status === 401 || status === 403) return "auth_error";
  if (status === 404) return "model_missing";
  return "provider_error";
}

function messageForStatus(status: AdsAgentHealthStatus) {
  if (status === "not_configured") return ADS_AGENT_ERROR_MESSAGES.NOT_CONFIGURED;
  if (status === "auth_error") return ADS_AGENT_ERROR_MESSAGES.AUTH;
  if (status === "model_missing") return ADS_AGENT_ERROR_MESSAGES.MODEL_UNAVAILABLE;
  if (status === "provider_error") return ADS_AGENT_ERROR_MESSAGES.UNAVAILABLE;
  return null;
}

export function errorCodeForHealthStatus(status: AdsAgentHealthStatus) {
  if (status === "not_configured") return ADS_AGENT_ERROR_CODES.NOT_CONFIGURED;
  if (status === "auth_error") return ADS_AGENT_ERROR_CODES.AUTH;
  if (status === "model_missing") return ADS_AGENT_ERROR_CODES.MODEL_UNAVAILABLE;
  return ADS_AGENT_ERROR_CODES.UNAVAILABLE;
}

function cacheHealth(value: AdsAgentHealth) {
  healthCache = {
    cacheKey: healthCacheKey(value.model),
    expiresAt: Date.now() + HEALTH_CACHE_MS,
    value,
  };
  return value;
}

export async function listOpenRouterModels(fetcher: OpenRouterFetch = fetch) {
  const apiKey = openRouterApiKey();
  if (!apiKey) {
    const error = new Error(ADS_AGENT_ERROR_MESSAGES.NOT_CONFIGURED) as Error & { code: string; statusCode: number };
    error.code = ADS_AGENT_ERROR_CODES.NOT_CONFIGURED;
    error.statusCode = 503;
    throw error;
  }
  const response = await fetchWithTimeout(
    `${OPENROUTER_API_BASE}/models`,
    { method: "GET", headers: openRouterHeaders(apiKey) },
    HEALTH_TIMEOUT_MS,
    fetcher,
  );
  if (!response.ok) {
    const status = classifyHttpStatus(response.status);
    const error = new Error(messageForStatus(status) ?? ADS_AGENT_ERROR_MESSAGES.UNAVAILABLE) as Error & {
      code: string;
      statusCode: number;
    };
    error.code = errorCodeForHealthStatus(status);
    error.statusCode = response.status === 401 || response.status === 403 ? 401 : 503;
    throw error;
  }
  const body = await response.json() as { data?: Array<{ id?: string }> };
  return (body.data ?? [])
    .map((model) => model.id?.trim())
    .filter((id): id is string => Boolean(id));
}

export async function completeOpenRouterChatTurn(input: {
  messages: OpenRouterChatMessage[];
  tools?: OpenRouterToolDefinition[];
  fetcher?: OpenRouterFetch;
}): Promise<OpenRouterChatTurn> {
  const apiKey = openRouterApiKey();
  const model = configuredAdsAgentModel();
  if (!apiKey) {
    const error = new Error(ADS_AGENT_ERROR_MESSAGES.NOT_CONFIGURED) as Error & { code: string; statusCode: number };
    error.code = ADS_AGENT_ERROR_CODES.NOT_CONFIGURED;
    error.statusCode = 503;
    throw error;
  }

  try {
    const response = await fetchWithTimeout(
      `${OPENROUTER_API_BASE}/chat/completions`,
      {
        method: "POST",
        headers: openRouterHeaders(apiKey),
        body: JSON.stringify({
          model,
          stream: false,
          messages: input.messages,
          ...(input.tools?.length ? { tools: input.tools } : {}),
        }),
      },
      CHAT_TIMEOUT_MS,
      input.fetcher ?? fetch,
    );
    if (!response.ok) {
      const status = classifyHttpStatus(response.status);
      const error = new Error(messageForStatus(status) ?? ADS_AGENT_ERROR_MESSAGES.UNAVAILABLE) as Error & {
        code: string;
        statusCode: number;
      };
      error.code = errorCodeForHealthStatus(status);
      error.statusCode = 503;
      throw error;
    }
    const body = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
        };
      }>;
    };
    const message = body.choices?.[0]?.message;
    const toolCalls = (message?.tool_calls ?? [])
      .filter((call) => call.id && call.function?.name)
      .map((call) => ({
        id: String(call.id),
        name: String(call.function?.name),
        arguments: String(call.function?.arguments ?? "{}"),
      }));
    const content = message?.content?.trim() || null;
    if (!content && toolCalls.length === 0) {
      const error = new Error(ADS_AGENT_ERROR_MESSAGES.UNAVAILABLE) as Error & { code: string; statusCode: number };
      error.code = ADS_AGENT_ERROR_CODES.UNAVAILABLE;
      error.statusCode = 503;
      throw error;
    }
    return {
      content,
      toolCalls,
      assistantMessage: {
        role: "assistant",
        content: content ?? "",
        tool_calls: toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: call.arguments },
        })),
      },
    };
  } catch (error) {
    if (error instanceof Error && "code" in error) throw error;
    const wrapped = new Error(ADS_AGENT_ERROR_MESSAGES.UNAVAILABLE) as Error & { code: string; statusCode: number };
    wrapped.code = ADS_AGENT_ERROR_CODES.UNAVAILABLE;
    wrapped.statusCode = 503;
    throw wrapped;
  }
}

export async function completeOpenRouterChat(input: {
  messages: OpenRouterChatMessage[];
  fetcher?: OpenRouterFetch;
}) {
  const turn = await completeOpenRouterChatTurn(input);
  if (!turn.content) {
    const error = new Error(ADS_AGENT_ERROR_MESSAGES.UNAVAILABLE) as Error & { code: string; statusCode: number };
    error.code = ADS_AGENT_ERROR_CODES.UNAVAILABLE;
    error.statusCode = 503;
    throw error;
  }
  return turn.content;
}

export async function probeOpenRouterHealth(input?: {
  fetcher?: OpenRouterFetch;
  bypassCache?: boolean;
}): Promise<AdsAgentHealth> {
  const model = configuredAdsAgentModel();
  const cacheKey = healthCacheKey(model);
  const now = Date.now();
  if (!input?.bypassCache && healthCache && healthCache.cacheKey === cacheKey && healthCache.expiresAt > now) {
    return healthCache.value;
  }

  logger.info("ads_agent_health_probe", {
    provider: "openrouter",
    model,
    apiKeyConfigured: openRouterApiKeyConfigured(),
  });

  if (!openRouterApiKeyConfigured()) {
    return cacheHealth(baseHealth("not_configured", ADS_AGENT_ERROR_MESSAGES.NOT_CONFIGURED, false));
  }

  try {
    const models = await listOpenRouterModels(input?.fetcher ?? fetch);
    const available = models.includes(model);
    if (!available) {
      logger.warn("ads_agent_model_unavailable", { provider: "openrouter", model });
      return cacheHealth(baseHealth("model_missing", ADS_AGENT_ERROR_MESSAGES.MODEL_UNAVAILABLE, true));
    }
    logger.info("ads_agent_model_selected", { provider: "openrouter", model, status: "connected" });
    return cacheHealth(baseHealth("connected", null, true));
  } catch (error) {
    const code = error instanceof Error && "code" in error
      ? String((error as { code?: string }).code)
      : "";
    const status: AdsAgentHealthStatus = code === ADS_AGENT_ERROR_CODES.AUTH
      ? "auth_error"
      : code === ADS_AGENT_ERROR_CODES.MODEL_UNAVAILABLE
        ? "model_missing"
        : code === ADS_AGENT_ERROR_CODES.NOT_CONFIGURED
          ? "not_configured"
          : "provider_error";
    logger.warn("ads_agent_openrouter_unhealthy", {
      provider: "openrouter",
      model,
      status,
      reason: error instanceof Error ? sanitizeProviderText(error.message) : "unknown",
    });
    return cacheHealth(baseHealth(status, messageForStatus(status), status === "auth_error" || status === "model_missing"));
  }
}

export function clearOpenRouterHealthCache() {
  healthCache = null;
}
