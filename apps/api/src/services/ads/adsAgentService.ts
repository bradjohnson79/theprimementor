import type { Database } from "@wisdom/db";
import { logger } from "@wisdom/utils";
import { createHttpError } from "../booking/errors.js";
import { adsSectionLabel, buildAdsAgentSystemPrompt } from "./adsAgentPrompt.js";
import {
  appendAdsMessage,
  createAdsConversation,
  getAdsConversation,
  loadRecentMessages,
} from "./adsConversationService.js";
import { getAdsAgentSettings } from "./adsSettingsService.js";
import {
  completeOpenRouterChatTurn,
  errorCodeForHealthStatus,
  probeOpenRouterHealth,
  type OpenRouterChatMessage,
  type OpenRouterFetch,
} from "./openRouterAdapter.js";
import { ADS_AGENT_OPENROUTER_TOOLS, invokeAdsAgentTool } from "./adsAgentTools.js";
import { providerForDatabase } from "./googleAdsProvider.js";
import { getDivin8AdvertisingKnowledge } from "./adsKnowledgeService.js";
import type { AdsAgentContext, AdsAgentHealthStatus } from "./types.js";
import { retrievePmaKnowledge } from "./pma/pmaKnowledge.js";
import { getPmaWorkspace, summarizePmaForAgent } from "./pma/pmaService.js";
import { analyzeAdsScreenshots, formatVisionForStrategist, pmaFromScreenshotTerms, sanitizeVisionImages } from "./pma/pmaVision.js";
import { ADS_PMA_OPENROUTER_TOOLS } from "./adsAgentTools.js";

const MAX_TOOL_ROUNDS = 4;

function adsAgentHttpError(status: AdsAgentHealthStatus, fallback: string) {
  const error = createHttpError(503, fallback);
  (error as { code?: string }).code = errorCodeForHealthStatus(status);
  return error;
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

export async function chatWithAdsAgent(input: {
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

  const settings = await getAdsAgentSettings(input.db);
  const health = await probeOpenRouterHealth({
    fetcher: input.fetcher,
  });

  if (health.status !== "connected") {
    throw adsAgentHttpError(health.status, health.message || "The Ads Agent could not reach OpenRouter.");
  }

  const conversation = input.conversationId
    ? await getAdsConversation(input.db, input.userId, input.conversationId)
    : await createAdsConversation(input.db, input.userId, input.context);

  await appendAdsMessage(input.db, {
    conversationId: conversation.id,
    role: "user",
    content: message,
    context: input.context,
  });

  const history = await loadRecentMessages(input.db, conversation.id);
  const mode = await providerForDatabase(input.db).connection.getMode();
  const knowledge = await getDivin8AdvertisingKnowledge(input.db);
  const retrieved = retrievePmaKnowledge(message, 3);
  let visionBrief = "";
  let screenshotPma = "";
  const images = input.images?.length
    ? sanitizeVisionImages(input.images.map((image) => ({ mimeType: image.mimeType ?? "", data: image.data ?? "" })))
    : [];
  if (images.length) {
    const vision = await analyzeAdsScreenshots({ images, prompt: message, fetcher: input.fetcher });
    visionBrief = formatVisionForStrategist(vision);
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

  logger.info("ads_agent_chat", {
    conversationId: conversation.id,
    model: health.model,
    provider: "openrouter",
    section: input.context.section,
    mode,
    hasImages: images.length > 0,
  });

  const extras = [
    retrieved.length ? `Retrieved PMA knowledge (not the full library):\n${retrieved.map((entry) => `### ${entry.title}\n${entry.body.slice(0, 1200)}`).join("\n\n")}` : "",
    pmaSummary ? `Current PMA keyword strategy summary:\n${pmaSummary}` : "",
    visionBrief,
    screenshotPma ? `PMA analysis of screenshot terms:\n${screenshotPma}` : "",
    "Knowledge authority: Prime Mentor actual data > Divin8 catalog facts > Google Ads doctrine > frameworks > hypotheses. Separate facts from hypotheses. Screenshot numbers are visible facts only when listed as such.",
  ].filter(Boolean).join("\n\n");

  const messages: OpenRouterChatMessage[] = [
    { role: "system", content: `${buildAdsAgentSystemPrompt(input.context, mode, knowledge.customEntries)}\n\n${extras}` },
    ...history.map((item) => ({
      role: item.role === "assistant" ? "assistant" as const : "user" as const,
      content: item.content,
    })),
  ];

  let reply = "";
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const turn = await completeOpenRouterChatTurn({
      fetcher: input.fetcher,
      messages,
      tools: [...ADS_PMA_OPENROUTER_TOOLS, ...(mode === "READ_ONLY" ? ADS_AGENT_OPENROUTER_TOOLS : [])],
    });
    if (turn.toolCalls.length === 0) {
      reply = turn.content ?? "";
      break;
    }
    messages.push(turn.assistantMessage);
    for (const call of turn.toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }
      const result = await invokeAdsAgentTool(call.name, {
        db: input.db,
        context: input.context,
        args,
      });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
    if (round === MAX_TOOL_ROUNDS - 1) {
      reply = turn.content || "I retrieved live Google Ads data but could not finish the analysis.";
    }
  }
  if (!reply) {
    throw createHttpError(503, "The Ads Agent could not reach OpenRouter.");
  }

  const assistant = await appendAdsMessage(input.db, {
    conversationId: conversation.id,
    role: "assistant",
    content: reply,
    model: settings.model,
    context: input.context,
  });
  if (!assistant) {
    throw createHttpError(500, "Ads Agent response could not be stored.");
  }

  return {
    conversationId: conversation.id,
    contextLabel: adsSectionLabel(input.context.section),
    model: health.model,
    message: assistant,
  };
}
