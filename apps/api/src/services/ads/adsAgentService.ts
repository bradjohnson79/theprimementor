import type { Database } from "@wisdom/db";
import { logger } from "@wisdom/utils";
import { createHttpError } from "../booking/errors.js";
import { adsSectionLabel, buildAdsAgentSystemPrompt } from "./adsAgentPrompt.js";
import {
  appendAdsMessage,
  conversationIsGenerating,
  createAdsConversation,
  getAdsConversation,
  loadRecentMessages,
  setAdsConversationGeneration,
} from "./adsConversationService.js";
import {
  extractDurableAdsMemories,
  extractPerformanceMemories,
  extractScreenshotMemories,
  formatAdsMemoriesForPrompt,
  retrieveAdsMemories,
  writeAdsMemories,
} from "./adsMemoryService.js";
import { getAdsAgentSettings } from "./adsSettingsService.js";
import {
  completeOpenRouterChatTurn,
  errorCodeForHealthStatus,
  openRouterApiKeyConfigured,
  probeOpenRouterHealth,
  type OpenRouterChatMessage,
  type OpenRouterFetch,
} from "./openRouterAdapter.js";
import { ADS_AGENT_OPENROUTER_TOOLS, invokeAdsAgentTool } from "./adsAgentTools.js";
import { providerForDatabase } from "./googleAdsProvider.js";
import { getDivin8AdvertisingKnowledge } from "./adsKnowledgeService.js";
import type { AdsAgentContext, AdsAgentHealthStatus, AdsAgentMessage } from "./types.js";
import { retrievePmaKnowledge } from "./pma/pmaKnowledge.js";
import { getPmaWorkspace, summarizePmaForAgent } from "./pma/pmaService.js";
import { analyzeAdsScreenshots, formatVisionForStrategist, pmaFromScreenshotTerms, sanitizeVisionImages } from "./pma/pmaVision.js";
import { ADS_PMA_OPENROUTER_TOOLS } from "./adsAgentTools.js";

const MAX_TOOL_ROUNDS = 4;
const GENERATION_DEADLINE_MS = 90_000;
const TOOL_TIMEOUT_MS = 12_000;
const TURN_TIMEOUT_MS = 45_000;
const inflightGenerations = new Map<string, Promise<unknown>>();

function adsAgentHttpError(status: AdsAgentHealthStatus, fallback: string) {
  const error = createHttpError(503, fallback);
  (error as { code?: string }).code = errorCodeForHealthStatus(status);
  return error;
}

function userSafeGenerationError(error: unknown) {
  const code = error instanceof Error && "code" in error ? String((error as { code?: string }).code) : "";
  const message = error instanceof Error ? error.message : "";
  if (code === "OPENROUTER_NOT_CONFIGURED") return { error: "OpenRouter is temporarily unavailable.", errorCode: code };
  if (code === "OPENROUTER_AUTH_ERROR") return { error: "OpenRouter is temporarily unavailable.", errorCode: code };
  if (code === "ADS_AGENT_MODEL_UNAVAILABLE") return { error: "OpenRouter is temporarily unavailable.", errorCode: code };
  if (code === "OPENROUTER_UNAVAILABLE") return { error: "OpenRouter is temporarily unavailable.", errorCode: code };
  if (code === "ADS_AGENT_TIMEOUT" || /timed out|aborted/i.test(message)) {
    return { error: "Ads Agent provider timed out. Please retry.", errorCode: "ADS_AGENT_TIMEOUT" };
  }
  return { error: "Ads Agent provider timed out. Please retry.", errorCode: code || "ADS_AGENT_TIMEOUT" };
}

export async function getAdsAgentHealth(_db: Database | null, options?: {
  fetcher?: OpenRouterFetch;
  bypassCache?: boolean;
}) {
  return probeOpenRouterHealth({
    fetcher: options?.fetcher,
    bypassCache: options?.bypassCache,
  });
}

export async function enqueueAdsAgentChat(input: {
  db: Database;
  userId: string;
  message: string;
  context: AdsAgentContext;
  conversationId?: string;
  fetcher?: OpenRouterFetch;
  images?: Array<{ mimeType?: string; data?: string }>;
}) {
  const message = input.message.trim();
  if (!message) {
    throw createHttpError(400, "Message is required");
  }
  if (message.length > 4000) {
    throw createHttpError(400, "Message is too long");
  }
  if (!openRouterApiKeyConfigured()) {
    throw adsAgentHttpError("not_configured", "OpenRouter has not been configured for the Ads Agent.");
  }

  const conversation = input.conversationId
    ? await getAdsConversation(input.db, input.userId, input.conversationId)
    : {
      ...(await createAdsConversation(input.db, input.userId, input.context)),
      messages: [] as AdsAgentMessage[],
      generation: { status: "idle" as const },
    };

  if (conversationIsGenerating(conversation.generation)) {
    return {
      conversationId: conversation.id,
      status: "generating" as const,
      contextLabel: adsSectionLabel(input.context.section),
      message: conversation.messages.filter((item) => item.role === "user").at(-1) ?? null,
    };
  }

  const userMessage = await appendAdsMessage(input.db, {
    conversationId: conversation.id,
    role: "user",
    content: message,
    context: input.context,
  });

  try {
    await writeAdsMemories(input.db, input.userId, extractDurableAdsMemories({
      message,
      conversationId: conversation.id,
      context: input.context,
    }));
  } catch (error) {
    logger.warn("ads_agent_memory_write_failed", {
      conversationId: conversation.id,
      reason: error instanceof Error ? error.message : "unknown",
    });
  }

  await setAdsConversationGeneration(input.db, conversation.id, {
    status: "generating",
    startedAt: new Date().toISOString(),
  });

  const job = generateAdsAgentReply({
    db: input.db,
    userId: input.userId,
    conversationId: conversation.id,
    message,
    context: input.context,
    fetcher: input.fetcher,
    images: input.images,
  }).finally(() => {
    inflightGenerations.delete(conversation.id);
  });
  inflightGenerations.set(conversation.id, job);
  void job;

  return {
    conversationId: conversation.id,
    status: "generating" as const,
    contextLabel: adsSectionLabel(input.context.section),
    message: userMessage,
  };
}

/** @deprecated Use enqueueAdsAgentChat. Kept so existing imports keep working. */
export const chatWithAdsAgent = enqueueAdsAgentChat;

type AdsAgentGenerationInput = {
  db: Database;
  userId: string;
  conversationId: string;
  message: string;
  context: AdsAgentContext;
  fetcher?: OpenRouterFetch;
  images?: Array<{ mimeType?: string; data?: string }>;
};

function generationTimeoutError() {
  const error = createHttpError(503, "Ads Agent provider timed out. Please retry.");
  (error as { code?: string }).code = "ADS_AGENT_TIMEOUT";
  return error;
}

export async function generateAdsAgentReply(input: AdsAgentGenerationInput) {
  const startedAt = Date.now();
  const timings: Record<string, number> = { requestReceived: 0 };
  const abort = { aborted: false };

  const mark = (key: string) => {
    timings[key] = Date.now() - startedAt;
  };

  try {
    await Promise.race([
      runAdsAgentGeneration({ input, startedAt, timings, mark, abort }),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          abort.aborted = true;
          reject(generationTimeoutError());
        }, GENERATION_DEADLINE_MS);
      }),
    ]);
  } catch (error) {
    abort.aborted = true;
    const safe = userSafeGenerationError(error);
    logger.warn("ads_agent_generation_failed", {
      conversationId: input.conversationId,
      errorCode: safe.errorCode,
      ms: Date.now() - startedAt,
      reason: error instanceof Error ? error.message.slice(0, 180) : "unknown",
    });
    await setAdsConversationGeneration(input.db, input.conversationId, {
      status: "failed",
      startedAt: new Date(startedAt).toISOString(),
      error: safe.error,
      errorCode: safe.errorCode,
    }).catch(() => undefined);
  }
}

async function runAdsAgentGeneration(params: {
  input: AdsAgentGenerationInput;
  startedAt: number;
  timings: Record<string, number>;
  mark: (key: string) => void;
  abort: { aborted: boolean };
}) {
  const { input, startedAt, timings, mark, abort } = params;
    const settings = await getAdsAgentSettings(input.db);
    const health = await probeOpenRouterHealth({ fetcher: input.fetcher });
    mark("authComplete");
    if (health.status !== "connected") {
      throw adsAgentHttpError(health.status, health.message || "OpenRouter is temporarily unavailable.");
    }

    let memoryBlock = "";
    let memoryCount = 0;
    try {
      const retrieved = await retrieveAdsMemories(input.db, input.userId, input.message, input.context);
      memoryCount = retrieved.memories.length;
      memoryBlock = formatAdsMemoriesForPrompt(retrieved.memories);
    } catch (error) {
      logger.warn("ads_agent_memory_retrieve_failed", {
        conversationId: input.conversationId,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
    mark("memoryRetrieval");

    const history = await loadRecentMessages(input.db, input.conversationId);
    const mode = await providerForDatabase(input.db).connection.getMode();
    const knowledge = await getDivin8AdvertisingKnowledge(input.db);
    const retrieved = retrievePmaKnowledge(input.message, 3);
    let visionBrief = "";
    let screenshotPma = "";
    const images = input.images?.length
      ? sanitizeVisionImages(input.images.map((image) => ({ mimeType: image.mimeType ?? "", data: image.data ?? "" })))
      : [];
    if (images.length) {
      throwIfGenerationDeadline(startedAt, abort);
      const vision = await analyzeAdsScreenshots({ images, prompt: input.message, fetcher: input.fetcher });
      visionBrief = formatVisionForStrategist(vision);
      try {
        await writeAdsMemories(input.db, input.userId, extractScreenshotMemories({
          observations: vision.visibleFacts,
          conversationId: input.conversationId,
          screenshotType: "google_ads_screenshot",
        }));
      } catch (error) {
        logger.warn("ads_agent_screenshot_memory_failed", {
          conversationId: input.conversationId,
          reason: error instanceof Error ? error.message : "unknown",
        });
      }
      if (vision.extractedTerms.length) {
        screenshotPma = JSON.stringify(summarizePmaForAgent({
          project: { id: "", slug: "divin8-reports", name: "Divin8 Reports", offerKey: "divin8_reports" },
          analysis: {
            id: "screenshot",
            status: "complete",
            stage: "Building recommendations",
            seeds: vision.extractedTerms,
            payload: pmaFromScreenshotTerms(vision.extractedTerms),
            error: null,
            updatedAt: new Date().toISOString(),
          },
        }));
      }
    }
    let pmaSummary = "";
    try {
      pmaSummary = JSON.stringify(summarizePmaForAgent(await getPmaWorkspace(input.db, input.context.filters?.pmaProjectId || "divin8-reports")));
    } catch {
      pmaSummary = JSON.stringify({ analyzed: false });
    }
    let liveSnapshot = "";
    if (mode === "READ_ONLY" && /\b(account|campaign|keyword|search term|spend|click|impression|budget|metric|ctr|cpc|conversion)\b/i.test(input.message)) {
      throwIfGenerationDeadline(startedAt, abort);
      const [summary, keywords, searchTerms] = await Promise.all([
        invokeAdsAgentTool("getAccountSummary", { db: input.db, context: input.context }),
        invokeAdsAgentTool("getKeywordPerformance", { db: input.db, context: input.context }),
        invokeAdsAgentTool("getSearchTerms", { db: input.db, context: input.context }),
      ]);
      liveSnapshot = [
        "Current Google Ads snapshot (authoritative, fetched just now — do not re-fetch these unless the user asks for a different date range):",
        JSON.stringify(summary),
        JSON.stringify(keywords),
        JSON.stringify(searchTerms),
      ].join("\n");
    }
    mark("contextBuild");

    logger.info("ads_agent_chat", {
      conversationId: input.conversationId,
      model: health.model,
      provider: "openrouter",
      section: input.context.section,
      mode,
      hasImages: images.length > 0,
      memoryCount,
    });

    const extras = [
      memoryBlock,
      retrieved.length ? `Retrieved PMA knowledge (not the full library):\n${retrieved.map((entry) => `### ${entry.title}\n${entry.body.slice(0, 1200)}`).join("\n\n")}` : "",
      pmaSummary ? `Current PMA keyword strategy summary:\n${pmaSummary}` : "",
      liveSnapshot,
      visionBrief,
      screenshotPma ? `PMA analysis of screenshot terms:\n${screenshotPma}` : "",
      "Knowledge authority: Prime Mentor actual data > owner decisions > Divin8 catalog facts > Google Ads doctrine > frameworks > hypotheses. Newer explicit owner decisions win. Separate facts from hypotheses.",
    ].filter(Boolean).join("\n\n");

    const messages: OpenRouterChatMessage[] = [
      { role: "system", content: `${buildAdsAgentSystemPrompt(input.context, mode, knowledge.customEntries)}\n\n${extras}` },
      ...history.map((item) => ({
        role: item.role === "assistant" ? "assistant" as const : "user" as const,
        content: item.content,
      })),
    ];

    mark("providerStart");
    let reply = "";
    let rounds = 0;
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      throwIfGenerationDeadline(startedAt, abort);
      rounds = round + 1;
      const turn = await completeOpenRouterChatTurn({
        fetcher: input.fetcher,
        messages,
        tools: [...ADS_PMA_OPENROUTER_TOOLS, ...(mode === "READ_ONLY" ? ADS_AGENT_OPENROUTER_TOOLS : [])],
        timeoutMs: Math.min(TURN_TIMEOUT_MS, remainingGenerationMs(startedAt)),
      });
      if (round === 0) mark("firstProviderResponse");
      if (turn.toolCalls.length === 0) {
        reply = turn.content ?? "";
        break;
      }
      messages.push(turn.assistantMessage);
      const toolResults = await Promise.all(turn.toolCalls.map(async (call) => {
        throwIfGenerationDeadline(startedAt, abort);
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
        const result = await invokeToolWithTimeout(call.name, {
          db: input.db,
          context: input.context,
          args,
        });
        try {
          await writeAdsMemories(input.db, input.userId, extractPerformanceMemories({
            toolName: call.name,
            result,
            conversationId: input.conversationId,
          }));
        } catch {
          // Performance memory is best-effort.
        }
        return {
          role: "tool" as const,
          tool_call_id: call.id,
          content: JSON.stringify(result),
        };
      }));
      messages.push(...toolResults);
      if (round === MAX_TOOL_ROUNDS - 1) {
        reply = turn.content || "I retrieved live Google Ads data but could not finish the analysis.";
      }
    }
    mark("providerComplete");
    if (!reply) {
      throw adsAgentHttpError("provider_error", "OpenRouter is temporarily unavailable.");
    }
    if (abort.aborted) {
      throw generationTimeoutError();
    }

    const assistant = await appendAdsMessage(input.db, {
      conversationId: input.conversationId,
      role: "assistant",
      content: reply,
      model: settings.model,
      context: input.context,
    });
    if (!assistant) {
      throw createHttpError(500, "Ads Agent response could not be stored.");
    }
    if (abort.aborted) {
      throw generationTimeoutError();
    }
    await setAdsConversationGeneration(input.db, input.conversationId, { status: "idle" });
    mark("persistence");
    mark("finalResponse");
    logger.info("ads_agent_timing", {
      conversationId: input.conversationId,
      model: health.model,
      rounds,
      memoryCount,
      ms: timings,
    });
    return assistant;
}

function remainingGenerationMs(startedAt: number) {
  const remaining = GENERATION_DEADLINE_MS - (Date.now() - startedAt);
  if (remaining < 5_000) {
    throw generationTimeoutError();
  }
  return remaining;
}

function throwIfGenerationDeadline(startedAt: number, abort?: { aborted: boolean }) {
  if (abort?.aborted || Date.now() - startedAt >= GENERATION_DEADLINE_MS) {
    throw generationTimeoutError();
  }
}

async function invokeToolWithTimeout(
  name: string,
  input: { db: Database; context: AdsAgentContext; args: Record<string, unknown> },
) {
  return Promise.race([
    invokeAdsAgentTool(name, input),
    new Promise<Record<string, unknown>>((_, reject) => {
      setTimeout(() => {
        const error = new Error("Ads Agent tool timed out");
        (error as { code?: string }).code = "ADS_AGENT_TIMEOUT";
        reject(error);
      }, TOOL_TIMEOUT_MS);
    }),
  ]);
}

export function adsAgentInflightCount() {
  return inflightGenerations.size;
}

export type AdsAgentEnqueueResult = {
  conversationId: string;
  status: "generating";
  contextLabel: string;
  message: AdsAgentMessage | null;
};
