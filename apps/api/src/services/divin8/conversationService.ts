import { PassThrough } from "node:stream";
import { createRequire } from "node:module";
import type { Archiver } from "archiver";
import { and, asc, desc, eq, gte, ilike, lt, sql } from "drizzle-orm";
import {
  conversationMessages,
  conversationTimelineEvents,
  conversationThreads,
  type Database,
} from "@wisdom/db";
import { slugForFilename } from "@wisdom/utils";
import type { FastifyInstance } from "fastify";
import { DIVIN8_LIMITS } from "../../config/divin8Limits.js";
import {
  MAX_HISTORY,
  stripVerificationTags,
  type Divin8ChatRequest,
} from "./chatService.js";
import {
  processDivin8Message,
  type StoredDivin8SessionState,
} from "./divin8Orchestrator.js";
import { exportDocxFromMarkdown, exportPdfFromMarkdown } from "../reportExport.js";
import { getMemberEntitlementSnapshot, hasActiveMemberEntitlement } from "./entitlementService.js";
import {
  buildMemberProfileForAccess,
  evaluateAccess,
  getMemberUsageSummary,
  releaseUsageReservation,
  reserveUsageIdempotent,
  resolveUsageWindow,
} from "./usageService.js";
import {
  createPendingExecutionArtifacts,
  resolveThreadExecutionDecision,
} from "./conversationExecutionState.js";
import { persistDivin8Memories } from "./memoryService.js";

const ADMIN_DIVIN8_USER_ID = "admin";
const DEFAULT_THREAD_TITLE = "New Conversation";
const SUMMARY_FALLBACK_LIMIT = 160;
const THREAD_EXECUTION_TIMEOUT_MS = 90_000;
const THREAD_LOCK_NAMESPACE = 6418;
const MAX_THREAD_TITLE_LENGTH = 80;
const DEFAULT_THREAD_LIST_LIMIT = 50;
const MAX_THREAD_LIST_LIMIT = 100;
const MAX_BACKUP_CONVERSATIONS = 500;
const require = createRequire(import.meta.url);
const createArchiver = require("archiver") as (format: "zip", options?: { zlib?: { level?: number } }) => Archiver;
const FALLBACK_MEANINGFUL_THREAD_TITLE = "Divin8 Reading";
const DEFAULT_TITLE_PLACEHOLDERS = new Set([
  "",
  DEFAULT_THREAD_TITLE.toLowerCase(),
  "untitled",
  "new chat",
  "divin8 chat",
  "divin8 conversation",
]);

interface ConversationThreadRow {
  id: string;
  user_id: string;
  title: string;
  is_archived: boolean;
  summary: string | null;
  search_text: string | null;
  meta: unknown;
  created_at: Date;
  updated_at: Date | null;
}

interface ConversationMessageRow {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  meta: unknown;
  created_at: Date;
}

export type Divin8ConversationExportFormat = "md" | "txt" | "pdf" | "docx";

export interface Divin8UsageSummary {
  month_used: number;
  seeker_limit: number;
  used?: number;
  limit?: number | null;
  period_start?: string;
  period_end?: string;
}

export interface Divin8ResponseMeta {
  tier: "seeker" | "initiate";
  billing_interval: "monthly" | "annual";
  usage: {
    used: number;
    limit: number | null;
    period_start: string;
    period_end: string;
  };
}

export interface Divin8ConversationSummary {
  id: string;
  title: string;
  summary: string | null;
  preview: string | null;
  message_count: number;
  created_at: string;
  updated_at: string | null;
  active_profile_tags: string[];
  active_execution?: Divin8ActiveExecutionState | null;
}

export interface Divin8ConversationListOptions {
  limit?: number;
  cursor?: string | null;
}

export interface Divin8ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  meta?: Record<string, unknown> | null;
}

export interface Divin8TimelineEventResponse {
  id: string;
  summary: string;
  systems_used: string[];
  tags: string[];
  type: "input" | "engine" | "insight";
  created_at: string;
}

export interface Divin8ConversationDetail {
  thread: Divin8ConversationSummary;
  messages: Divin8ConversationMessage[];
  timeline: Divin8TimelineEventResponse[];
  last_pipeline_meta: import("./divin8Orchestrator.js").StoredPipelineMeta | null;
  active_execution: Divin8ActiveExecutionState | null;
}

export interface Divin8ActiveExecutionState {
  request_id: string;
  status: "pending";
  actor_role: string;
  locked_at: string;
  expires_at: string;
  pending_message_id: string;
}

interface StoredConversationMessageMeta {
  status?: "pending" | "completed" | "error";
  requestId?: string;
  lockedAt?: string;
  expiresAt?: string;
  resolvedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  engine_used?: unknown;
  systems_used?: unknown;
  pipeline_status?: unknown;
  route_type?: unknown;
  time_context?: unknown;
  stages?: unknown;
  divin8?: unknown;
  telemetry?: unknown;
}

function createHttpError(statusCode: number, message: string, code?: string) {
  const error = new Error(message) as Error & { statusCode?: number; code?: string };
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeRole(role: string): "user" | "assistant" {
  return role === "assistant" ? "assistant" : "user";
}

function mapActiveExecution(meta: StoredDivin8SessionState | null): Divin8ActiveExecutionState | null {
  const active = meta?.activeExecution;
  if (!active) {
    return null;
  }

  return {
    request_id: active.requestId,
    status: active.status,
    actor_role: active.actorRole,
    locked_at: active.lockedAt,
    expires_at: active.expiresAt,
    pending_message_id: active.pendingMessageId,
  };
}

function mergeStoredMessageMeta(
  current: unknown,
  next: Partial<StoredConversationMessageMeta>,
): StoredConversationMessageMeta {
  const existing = isRecord(current) ? current as StoredConversationMessageMeta : {};
  return {
    ...existing,
    ...next,
  };
}

function threadSummaryFromRow(
  row: ConversationThreadRow,
  preview: string | null,
  messageCount: number,
): Divin8ConversationSummary {
  const storedState = asStoredState(row.meta);
  const listState = getThreadListState(row.meta);
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    preview: preview ?? listState.preview ?? row.summary,
    message_count: messageCount || listState.messageCount,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at ? row.updated_at.toISOString() : null,
    active_profile_tags: storedState?.activeProfileTags ?? [],
    active_execution: mapActiveExecution(storedState),
  };
}

function clipPreview(content: string) {
  const cleaned = content.replace(/\s+/g, " ").trim();
  return cleaned.length > 96 ? `${cleaned.slice(0, 93)}...` : cleaned;
}

function getThreadListState(meta: unknown) {
  if (!isRecord(meta)) {
    return {
      preview: null as string | null,
      messageCount: 0,
      lastMessageAt: null as string | null,
    };
  }
  return {
    preview: typeof meta.listPreview === "string" ? meta.listPreview : null,
    messageCount: typeof meta.messageCount === "number" && Number.isFinite(meta.messageCount) ? meta.messageCount : 0,
    lastMessageAt: typeof meta.lastMessageAt === "string" ? meta.lastMessageAt : null,
  };
}

function withThreadListState(
  state: StoredDivin8SessionState,
  input: { preview: string; messageCount: number; lastMessageAt: Date },
) {
  return {
    ...state,
    listPreview: clipPreview(input.preview),
    messageCount: Math.max(0, input.messageCount),
    lastMessageAt: input.lastMessageAt.toISOString(),
  };
}

function normalizeThreadListOptions(options: Divin8ConversationListOptions = {}) {
  const requestedLimit = Number.isFinite(options.limit) ? Number(options.limit) : DEFAULT_THREAD_LIST_LIMIT;
  const limit = Math.max(1, Math.min(MAX_THREAD_LIST_LIMIT, Math.trunc(requestedLimit)));
  const cursorDate = options.cursor ? new Date(options.cursor) : null;
  return {
    limit,
    cursorDate: cursorDate && Number.isFinite(cursorDate.getTime()) ? cursorDate : null,
  };
}

function clipSummary(content: string) {
  const cleaned = content.replace(/\s+/g, " ").trim();
  return cleaned.length > SUMMARY_FALLBACK_LIMIT
    ? `${cleaned.slice(0, SUMMARY_FALLBACK_LIMIT - 3)}...`
    : cleaned;
}

function getTitleMetadata(meta: unknown) {
  return {
    titleLocked: isRecord(meta) && meta.titleLocked === true,
    titleSource: isRecord(meta) && typeof meta.titleSource === "string" ? meta.titleSource : null,
  };
}

function isPlaceholderThreadTitle(title: string | null | undefined) {
  const normalized = (title ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  return DEFAULT_TITLE_PLACEHOLDERS.has(normalized);
}

function stripTitleUtilitySyntax(message: string) {
  return message
    .replace(/@\S+/g, " ")
    .replace(/#[\p{L}\p{N}_-]+/gu, " ")
    .replace(/\[[^\]]*(?:timeline|image|upload|attachment)[^\]]*\]/gi, " ")
    .replace(/\b(?:timeline|image|upload|uploaded|attachment)[_-]?(?:ref|id)?\s*[:=]\s*\S+/gi, " ")
    .replace(/\b(?:uploaded\s+image|image\s+uploaded|attached\s+image|image\s+attachment)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampThreadTitle(title: string) {
  const normalized = title.replace(/\s+/g, " ").trim();
  return normalized.length > MAX_THREAD_TITLE_LENGTH
    ? normalized.slice(0, MAX_THREAD_TITLE_LENGTH - 1).trimEnd()
    : normalized;
}

function appendReadingSuffix(title: string) {
  return /\b(reading|guidance|forecast|analysis|report|session)\b/i.test(title)
    ? title
    : `${title} Reading`;
}

function extractProfileNameForTitle(message: string) {
  const match = message.match(/@([\p{L}\p{N}_-]+)/u);
  if (!match?.[1]) {
    return null;
  }
  const words = match[1]
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean);

  const title = titleCase(words.join(" "));
  return title || null;
}

function buildThreadTitle(message: string) {
  const profileName = extractProfileNameForTitle(message);
  const cleaned = stripTitleUtilitySyntax(message)
    .replace(/[#*_`>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = cleaned.toLowerCase();

  if (!cleaned || cleaned.length < 4) {
    return FALLBACK_MEANINGFUL_THREAD_TITLE;
  }

  const topicChecks: Array<[RegExp, string]> = [
    [/\b(finance|finances|financial|money|wealth|income|career|business)\b/, "Finance Reading"],
    [/\b(compatibility|relationship|relationships|romance|partner|marriage|love)\b/, "Compatibility Reading"],
    [/\b(travel|relocation|move|moving|journey|trip)\b/, "Travel Timing Reading"],
    [/\b(purpose|career|calling|vocation|mission|life path)\b/, "Life Purpose and Career Reading"],
    [/\b(numerology)\b/, "Numerology Reading"],
    [/\b(vedic|astrology|birth chart|chart)\b/, "Chart Reading"],
    [/\b(grounding)\b/, "Grounding Reminder"],
  ];

  for (const [pattern, title] of topicChecks) {
    if (pattern.test(normalized)) {
      return clampThreadTitle(profileName && title.endsWith("Reading")
        ? `${title} for ${profileName}`
        : title);
    }
  }

  const keywords = extractTitleKeywords(cleaned);
  if (keywords.length > 0) {
    const title = appendReadingSuffix(titleCase(Array.from(new Set(keywords)).slice(0, 4).join(" ")));
    return clampThreadTitle(profileName ? `${title} for ${profileName}` : title);
  }

  const firstSentence = cleaned.split(/[.!?]/)[0]?.trim() || cleaned;
  const title = appendReadingSuffix(titleCase(firstSentence.split(/\s+/).slice(0, 5).join(" ")));
  return clampThreadTitle(title || FALLBACK_MEANINGFUL_THREAD_TITLE);
}

function normalizeThreadTitle(value: unknown) {
  if (typeof value !== "string") {
    throw createHttpError(400, "Conversation title is required.");
  }
  const title = value.replace(/\s+/g, " ").trim();
  if (!title) {
    throw createHttpError(400, "Conversation title is required.");
  }
  if (title.length > MAX_THREAD_TITLE_LENGTH) {
    throw createHttpError(400, `Conversation title must be ${MAX_THREAD_TITLE_LENGTH} characters or fewer.`);
  }
  return title;
}

function extractTitleKeywords(source: string) {
  const normalized = source
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const stopwords = new Set([
    "a",
    "about",
    "an",
    "and",
    "at",
    "balance",
    "balancing",
    "be",
    "can",
    "for",
    "from",
    "give",
    "guidance",
    "help",
    "i",
    "in",
    "into",
    "is",
    "it",
    "me",
    "my",
    "of",
    "on",
    "please",
    "practical",
    "read",
    "tell",
    "that",
    "the",
    "this",
    "to",
    "want",
    "with",
    "work",
    "you",
    "ayudarte",
    "basicos",
    "comparteme",
    "con",
    "datos",
    "desde",
    "esto",
    "hacer",
    "lectura",
    "necesito",
    "numerologia",
    "para",
    "pero",
    "por",
    "puedo",
    "seria",
    "tuyos",
  ]);
  return normalized
    .split(" ")
    .filter((word) => word.length > 2 && !stopwords.has(word));
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildFallbackTitle(summary: string | null, message: string) {
  const cleanMessage = message
    .replace(/[#*_`>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cleanSummary = (summary || "")
    .replace(/[#*_`>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const messageNormalized = cleanMessage.toLowerCase();
  if (/\bnumerology\b/.test(messageNormalized)) {
    return "Numerology Reading";
  }
  if (/\b(astrology|birth chart|chart)\b/.test(messageNormalized)) {
    return "Chart Reading";
  }
  if (/\bgrounding\b/.test(messageNormalized)) {
    return "Grounding Reminder";
  }
  if (/\b(creativity|creative)\b/.test(messageNormalized) && /\bstructure\b/.test(messageNormalized)) {
    return "Creativity Structure Guidance";
  }

  const messageKeywords = extractTitleKeywords(cleanMessage);
  if (messageKeywords.length > 0) {
    const deduped = Array.from(new Set(messageKeywords)).slice(0, 4);
    const title = titleCase(deduped.join(" "));
    if (title) {
      return title;
    }
  }

  const summaryKeywords = extractTitleKeywords(cleanSummary);
  if (summaryKeywords.length > 0) {
    const deduped = Array.from(new Set(summaryKeywords)).slice(0, 4);
    const title = titleCase(deduped.join(" "));
    if (title) {
      return title;
    }
  }

  const source = cleanSummary || cleanMessage;
  if (!source) {
    return DEFAULT_THREAD_TITLE;
  }
  const firstSentence = source.split(/[.!?]/)[0]?.trim() || source;
  const words = firstSentence.split(/\s+/).slice(0, 5);
  return words.join(" ") || DEFAULT_THREAD_TITLE;
}

function resolveNextThreadTitle(thread: ConversationThreadRow, message: string) {
  const { titleLocked } = getTitleMetadata(thread.meta);
  if (titleLocked || !isPlaceholderThreadTitle(thread.title)) {
    return thread.title;
  }

  return buildThreadTitle(message);
}

function withManualTitleMetadata(meta: unknown) {
  return {
    ...(isRecord(meta) ? meta : {}),
    titleLocked: true,
    titleSource: "manual",
  } as StoredDivin8SessionState;
}

function withAutoTitleMetadata(meta: unknown) {
  return {
    ...(isRecord(meta) ? meta : {}),
    titleSource: "auto",
  } as StoredDivin8SessionState;
}

function buildThreadSearchText(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => (typeof part === "string" ? part.replace(/\s+/g, " ").trim() : ""))
    .filter(Boolean)
    .join(" ");
}

function buildDeterministicConversationSummary(storedState: StoredDivin8SessionState | null, fallbackText: string) {
  const summary = storedState?.memory?.conversationSummary?.trim();
  if (summary) {
    return clipSummary(summary);
  }

  return clipSummary(stripVerificationTags(fallbackText));
}

function mapTimelineEvent(row: {
  id: string;
  summary: string;
  systems_used: unknown;
  tags: unknown;
  type: string;
  created_at: Date;
}): Divin8TimelineEventResponse {
  return {
    id: row.id,
    summary: row.summary,
    systems_used: Array.isArray(row.systems_used)
      ? row.systems_used.filter((value): value is string => typeof value === "string")
      : [],
    tags: Array.isArray(row.tags)
      ? row.tags.filter((value): value is string => typeof value === "string")
      : [],
    type: row.type === "engine" || row.type === "insight" ? row.type : "input",
    created_at: row.created_at.toISOString(),
  };
}

function mapThreadsLightweight(threads: ConversationThreadRow[]) {
  return threads.map((thread) => threadSummaryFromRow(thread, null, 0));
}

function asStoredState(meta: unknown): StoredDivin8SessionState | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return null;
  }
  return meta as StoredDivin8SessionState;
}

async function getThreadRow(db: Database, threadId: string, userId: string) {
  const [thread] = await db
    .select()
    .from(conversationThreads)
    .where(and(
      eq(conversationThreads.id, threadId),
      eq(conversationThreads.user_id, userId),
      eq(conversationThreads.is_archived, false),
    ))
    .limit(1);

  if (!thread) {
    throw createHttpError(404, "Conversation not found");
  }

  return thread as ConversationThreadRow;
}

async function getThreadMessages(db: Database, threadId: string) {
  const rows = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.thread_id, threadId))
    .orderBy(asc(conversationMessages.created_at));

  return rows as ConversationMessageRow[];
}

async function getThreadTimeline(db: Database, threadId: string, userId: string, limit = 30) {
  const rows = await db
    .select()
    .from(conversationTimelineEvents)
    .where(and(
      eq(conversationTimelineEvents.thread_id, threadId),
      eq(conversationTimelineEvents.user_id, userId),
    ))
    .orderBy(desc(conversationTimelineEvents.created_at))
    .limit(limit);

  return rows.map(mapTimelineEvent);
}

async function withThreadAdvisoryLock(
  db: Pick<Database, "execute">,
  threadId: string,
) {
  await db.execute(sql`
    SELECT pg_advisory_xact_lock(hashtext(${threadId}), ${THREAD_LOCK_NAMESPACE})
  `);
}

async function claimPendingConversationWrite(
  app: FastifyInstance,
  input: {
    threadId: string;
    userId: string;
    requestId: string;
    message: string;
    actorRole: string;
  },
) {
  const lockedAt = new Date();
  const expiresAt = new Date(lockedAt.getTime() + THREAD_EXECUTION_TIMEOUT_MS);

  return app.db.transaction(async (tx) => {
    await withThreadAdvisoryLock(tx, input.threadId);
    const thread = await getThreadRow(tx as unknown as Database, input.threadId, input.userId);
    const storedState = asStoredState(thread.meta) ?? {};
    const decision = resolveThreadExecutionDecision(storedState, lockedAt);
    const activeExecution = decision.activeExecution;

    if (activeExecution) {
      if (decision.action === "reject") {
        throw createHttpError(409, "Another Divin8 response is already running for this conversation.", "THREAD_BUSY");
      }

      await tx
        .update(conversationMessages)
        .set({
          meta: mergeStoredMessageMeta(null, {
            status: "error",
            requestId: activeExecution.requestId,
            lockedAt: activeExecution.lockedAt,
            expiresAt: activeExecution.expiresAt,
            resolvedAt: lockedAt.toISOString(),
            errorCode: "ORCHESTRATION_TIMEOUT",
            errorMessage: "Previous Divin8 orchestration timed out before completion.",
          }),
        })
        .where(eq(conversationMessages.id, activeExecution.pendingMessageId));

      app.log.warn({
        threadId: input.threadId,
        userId: input.userId,
        staleRequestId: activeExecution.requestId,
        pendingMessageId: activeExecution.pendingMessageId,
      }, "divin8_thread_execution_timeout_recovered");
    }

    const [pendingMessage] = await tx
      .insert(conversationMessages)
      .values({
        thread_id: input.threadId,
        role: "user",
        content: input.message,
        created_at: lockedAt,
        meta: createPendingExecutionArtifacts({
          requestId: input.requestId,
          actorRole: input.actorRole,
          lockedAt,
          expiresAt,
          pendingMessageId: "pending-message-id-will-be-overwritten",
        }).pendingMessageMeta,
      })
      .returning();

    const pendingExecution = createPendingExecutionArtifacts({
      requestId: input.requestId,
      actorRole: input.actorRole,
      lockedAt,
      expiresAt,
      pendingMessageId: pendingMessage.id,
    });

    await tx
      .update(conversationMessages)
      .set({
        meta: pendingExecution.pendingMessageMeta,
      })
      .where(eq(conversationMessages.id, pendingMessage.id));

    await tx
      .update(conversationThreads)
      .set({
        meta: {
          ...storedState,
          activeExecution: pendingExecution.activeExecution,
          lastExecutionError: null,
        },
        updated_at: lockedAt,
      })
      .where(eq(conversationThreads.id, input.threadId));

    app.log.info({
      threadId: input.threadId,
      userId: input.userId,
      requestId: input.requestId,
      pendingMessageId: pendingMessage.id,
      expiresAt: expiresAt.toISOString(),
    }, "divin8_thread_execution_locked");

    return {
      thread,
      storedState,
      pendingMessage: pendingMessage as ConversationMessageRow,
      lockedAt,
      expiresAt,
    };
  });
}

async function finalizeThreadExecutionSuccess(
  app: FastifyInstance,
  input: {
    thread: ConversationThreadRow;
    userId: string;
    requestId: string;
    pendingMessageId: string;
    visibleAssistantMessage: string;
    assistantMeta: StoredConversationMessageMeta;
    nextTitle: string;
    nextSummary: string;
    nextSearchText: string;
    savedAt: Date;
    storedState: StoredDivin8SessionState;
  },
) {
  return app.db.transaction(async (tx) => {
    await withThreadAdvisoryLock(tx, input.thread.id);
    const thread = await getThreadRow(tx as unknown as Database, input.thread.id, input.userId);
    const currentState = asStoredState(thread.meta) ?? {};
    const currentListState = getThreadListState(thread.meta);

    if (currentState.activeExecution?.requestId !== input.requestId) {
      throw createHttpError(409, "Conversation execution state changed before finalize.", "THREAD_STATE_MISMATCH");
    }

    await tx
      .update(conversationMessages)
      .set({
        meta: mergeStoredMessageMeta(null, {
          status: "completed",
          requestId: input.requestId,
          lockedAt: currentState.activeExecution?.lockedAt,
          expiresAt: currentState.activeExecution?.expiresAt,
          resolvedAt: input.savedAt.toISOString(),
        }),
      })
      .where(eq(conversationMessages.id, input.pendingMessageId));

    const [assistantMessage] = await tx
      .insert(conversationMessages)
      .values({
        thread_id: input.thread.id,
        role: "assistant",
        content: input.visibleAssistantMessage,
        meta: {
          ...input.assistantMeta,
          status: "completed",
          requestId: input.requestId,
          resolvedAt: input.savedAt.toISOString(),
        },
        created_at: input.savedAt,
      })
      .returning();

    await tx
      .update(conversationThreads)
      .set({
        title: input.nextTitle,
        summary: input.nextSummary,
        search_text: input.nextSearchText,
        meta: {
          ...withThreadListState(input.storedState, {
            preview: input.visibleAssistantMessage,
            messageCount: currentListState.messageCount + 2,
            lastMessageAt: input.savedAt,
          }),
          activeExecution: null,
          lastExecutionError: null,
        },
        updated_at: input.savedAt,
      })
      .where(eq(conversationThreads.id, input.thread.id));

    app.log.info({
      threadId: input.thread.id,
      userId: input.userId,
      requestId: input.requestId,
      status: "completed",
    }, "divin8_thread_execution_unlocked");

    return assistantMessage as ConversationMessageRow;
  });
}

async function finalizeThreadExecutionFailure(
  app: FastifyInstance,
  input: {
    threadId: string;
    userId: string;
    requestId: string;
    pendingMessageId: string;
    error: unknown;
  },
) {
  const failedAt = new Date();
  await app.db.transaction(async (tx) => {
    await withThreadAdvisoryLock(tx, input.threadId);
    const thread = await getThreadRow(tx as unknown as Database, input.threadId, input.userId);
    const currentState = asStoredState(thread.meta) ?? {};

    await tx
      .update(conversationMessages)
      .set({
        meta: mergeStoredMessageMeta(null, {
          status: "error",
          requestId: input.requestId,
          lockedAt: currentState.activeExecution?.lockedAt,
          expiresAt: currentState.activeExecution?.expiresAt,
          resolvedAt: failedAt.toISOString(),
          errorCode:
            input.error instanceof Error && "code" in input.error && typeof (input.error as { code?: unknown }).code === "string"
              ? (input.error as { code: string }).code
              : "DIVIN8_ORCHESTRATION_FAILED",
          errorMessage: input.error instanceof Error ? input.error.message : "Divin8 orchestration failed.",
        }),
      })
      .where(eq(conversationMessages.id, input.pendingMessageId));

    await tx
      .update(conversationThreads)
      .set({
        meta: {
          ...currentState,
          activeExecution: null,
          lastExecutionError: {
            requestId: input.requestId,
            code:
              input.error instanceof Error && "code" in input.error && typeof (input.error as { code?: unknown }).code === "string"
                ? (input.error as { code: string }).code
                : "DIVIN8_ORCHESTRATION_FAILED",
            message: input.error instanceof Error ? input.error.message : "Divin8 orchestration failed.",
            failedAt: failedAt.toISOString(),
          },
        },
        updated_at: failedAt,
      })
      .where(eq(conversationThreads.id, input.threadId));

    app.log.warn({
      threadId: input.threadId,
      userId: input.userId,
      requestId: input.requestId,
      status: "error",
    }, "divin8_thread_execution_unlocked");
  });
}

export async function getMonthlyUsageSummary(db: Database, userId = ADMIN_DIVIN8_USER_ID): Promise<Divin8UsageSummary> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversationMessages)
    .innerJoin(conversationThreads, eq(conversationMessages.thread_id, conversationThreads.id))
    .where(and(
      eq(conversationThreads.user_id, userId),
      eq(conversationMessages.role, "user"),
      gte(conversationMessages.created_at, monthStart),
    ));

  return {
    month_used: rows[0]?.count ?? 0,
    seeker_limit: DIVIN8_LIMITS.seeker,
  };
}

function buildRequestId(explicitRequestId: string | undefined, threadId: string, request: Divin8ChatRequest) {
  const candidate = explicitRequestId?.trim();
  if (candidate) {
    return candidate;
  }
  const base = `${threadId}:${request.message.slice(0, 120)}`;
  return `msg:${Buffer.from(base, "utf8").toString("base64url")}`;
}

interface AddMessageOptions {
  actorRole?: string;
  requestId?: string;
  profileOwnerId?: string;
}

async function resolveAccessContext(
  db: Database,
  userId: string,
  request: Divin8ChatRequest,
  actorRole: string | undefined,
) {
  if (actorRole === "admin") {
    const usage = await getMonthlyUsageSummary(db, userId);
    return {
      tier: request.tier,
      billingInterval: "monthly" as const,
      usageSummary: {
        used: usage.month_used,
        limit: usage.seeker_limit,
        periodStart: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString(),
        periodEnd: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString(),
      },
      canUse: request.tier === "initiate" || usage.month_used < usage.seeker_limit,
      access: {
        canUse: request.tier === "initiate" || usage.month_used < usage.seeker_limit,
        limit: request.tier === "seeker" ? usage.seeker_limit : null,
      },
      usageWindow: null as null,
    };
  }

  const entitlement = await getMemberEntitlementSnapshot(db, userId);
  if (!hasActiveMemberEntitlement(entitlement)) {
    throw createHttpError(403, "An active subscription is required to access Divin8 chat");
  }
  const window = resolveUsageWindow(entitlement);
  const usageSummary = await getMemberUsageSummary(db, {
    userId,
    tier: entitlement.tier,
    window,
  });
  const profile = buildMemberProfileForAccess({
    userId,
    tier: entitlement.tier,
    billingInterval: entitlement.billingInterval,
    usage: { used: usageSummary.used, window },
  });
  const access = evaluateAccess(profile);

  return {
    tier: entitlement.tier,
    billingInterval: entitlement.billingInterval,
    usageSummary,
    canUse: access.canUse,
    access,
    usageWindow: window,
  };
}

export async function createConversationThread(db: Database, userId = ADMIN_DIVIN8_USER_ID) {
  const [created] = await db
    .insert(conversationThreads)
    .values({
      user_id: userId,
      title: DEFAULT_THREAD_TITLE,
      is_archived: false,
      summary: null,
      search_text: DEFAULT_THREAD_TITLE,
      meta: {},
    })
    .returning();

  return threadSummaryFromRow(created as ConversationThreadRow, null, 0);
}

async function getUsageSummaryForListing(db: Database, userId: string, actorRole?: string): Promise<Divin8UsageSummary> {
  if (actorRole === "admin") {
    return getMonthlyUsageSummary(db, userId);
  }

  const entitlement = await getMemberEntitlementSnapshot(db, userId);
  if (!hasActiveMemberEntitlement(entitlement)) {
    return {
      month_used: 0,
      seeker_limit: DIVIN8_LIMITS.seeker,
      used: 0,
      limit: 0,
      period_start: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString(),
      period_end: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString(),
    };
  }
  const window = resolveUsageWindow(entitlement);
  const usage = await getMemberUsageSummary(db, {
    userId,
    tier: entitlement.tier,
    window,
  });
  return {
    month_used: usage.used,
    seeker_limit: usage.limit ?? DIVIN8_LIMITS.seeker,
    used: usage.used,
    limit: usage.limit,
    period_start: usage.periodStart,
    period_end: usage.periodEnd,
  };
}

export async function listConversationThreads(
  db: Database,
  userId = ADMIN_DIVIN8_USER_ID,
  actorRole?: string,
  options: Divin8ConversationListOptions = {},
) {
  const { limit, cursorDate } = normalizeThreadListOptions(options);
  const threads = (await db
    .select()
    .from(conversationThreads)
    .where(and(
      eq(conversationThreads.user_id, userId),
      eq(conversationThreads.is_archived, false),
      cursorDate ? lt(sql<Date>`coalesce(${conversationThreads.updated_at}, ${conversationThreads.created_at})`, cursorDate) : undefined,
    ))
    .orderBy(desc(conversationThreads.updated_at), desc(conversationThreads.created_at))
    .limit(limit + 1)) as ConversationThreadRow[];

  const visibleThreads = threads.slice(0, limit);
  const nextThread = threads.length > limit ? threads[limit] : null;

  if (visibleThreads.length === 0) {
    return {
      threads: [] as Divin8ConversationSummary[],
      next_cursor: null as string | null,
      usage: await getUsageSummaryForListing(db, userId, actorRole),
    };
  }

  return {
    threads: mapThreadsLightweight(visibleThreads),
    next_cursor: nextThread
      ? (nextThread.updated_at ?? nextThread.created_at).toISOString()
      : null,
    usage: await getUsageSummaryForListing(db, userId, actorRole),
  };
}

export async function searchConversationThreads(
  db: Database,
  query: string,
  userId = ADMIN_DIVIN8_USER_ID,
  options: Divin8ConversationListOptions = {},
) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return { threads: [] as Divin8ConversationSummary[] };
  }
  const { limit, cursorDate } = normalizeThreadListOptions(options);

  const threads = (await db
    .select()
    .from(conversationThreads)
    .where(and(
      eq(conversationThreads.user_id, userId),
      eq(conversationThreads.is_archived, false),
      ilike(sql<string>`coalesce(${conversationThreads.search_text}, ${conversationThreads.title})`, `%${normalizedQuery}%`),
      cursorDate ? lt(sql<Date>`coalesce(${conversationThreads.updated_at}, ${conversationThreads.created_at})`, cursorDate) : undefined,
    ))
    .orderBy(desc(conversationThreads.updated_at), desc(conversationThreads.created_at))
    .limit(limit + 1)) as ConversationThreadRow[];

  const visibleThreads = threads.slice(0, limit);
  const nextThread = threads.length > limit ? threads[limit] : null;

  return {
    threads: mapThreadsLightweight(visibleThreads),
    next_cursor: nextThread
      ? (nextThread.updated_at ?? nextThread.created_at).toISOString()
      : null,
  };
}

export async function deleteConversationThread(
  db: Database,
  threadId: string,
  userId = ADMIN_DIVIN8_USER_ID,
) {
  const thread = await getThreadRow(db, threadId, userId);
  await db
    .delete(conversationThreads)
    .where(and(
      eq(conversationThreads.id, threadId),
      eq(conversationThreads.user_id, userId),
      eq(conversationThreads.is_archived, false),
    ));

  return {
    id: thread.id,
    deleted: true as const,
  };
}

export async function renameConversationThread(
  db: Database,
  threadId: string,
  title: unknown,
  userId = ADMIN_DIVIN8_USER_ID,
) {
  const thread = await getThreadRow(db, threadId, userId);
  const normalizedTitle = normalizeThreadTitle(title);
  const updatedAt = new Date();
  const [updated] = await db
    .update(conversationThreads)
    .set({
      title: normalizedTitle,
      search_text: buildThreadSearchText(normalizedTitle, thread.summary, thread.search_text),
      meta: withManualTitleMetadata(thread.meta),
      updated_at: updatedAt,
    })
    .where(and(
      eq(conversationThreads.id, threadId),
      eq(conversationThreads.user_id, userId),
      eq(conversationThreads.is_archived, false),
    ))
    .returning();

  const messages = await getThreadMessages(db, threadId);
  return threadSummaryFromRow(
    updated as ConversationThreadRow,
    messages.length > 0 ? clipPreview(messages[messages.length - 1].content) : null,
    messages.length,
  );
}

export async function getConversationDetail(db: Database, threadId: string, userId = ADMIN_DIVIN8_USER_ID): Promise<Divin8ConversationDetail> {
  const thread = await getThreadRow(db, threadId, userId);
  const messages = await getThreadMessages(db, threadId);
  const timeline = await getThreadTimeline(db, threadId, userId);
  const storedState = asStoredState(thread.meta);

  return {
    thread: threadSummaryFromRow(
      thread,
      messages.length > 0 ? clipPreview(messages[messages.length - 1].content) : null,
      messages.length,
    ),
    messages: messages.map((message) => ({
      id: message.id,
      role: normalizeRole(message.role),
      content: message.content,
      created_at: message.created_at.toISOString(),
      meta: message.meta && typeof message.meta === "object" && !Array.isArray(message.meta)
        ? message.meta as Record<string, unknown>
        : null,
    })),
    timeline,
    last_pipeline_meta: storedState?.lastPipelineMeta ?? null,
    active_execution: mapActiveExecution(storedState),
  };
}

export async function getConversationTimeline(db: Database, threadId: string, userId = ADMIN_DIVIN8_USER_ID) {
  await getThreadRow(db, threadId, userId);
  return {
    timeline: await getThreadTimeline(db, threadId, userId),
  };
}

export async function addMessageToConversation(
  app: FastifyInstance,
  threadId: string,
  request: Divin8ChatRequest,
  userId = ADMIN_DIVIN8_USER_ID,
  options: AddMessageOptions = {},
) {
  const db = app.db;
  const accessContext = await resolveAccessContext(db, userId, request, options.actorRole);
  if (!accessContext.canUse) {
    throw createHttpError(429, "You have reached your monthly limit.", "LIMIT_REACHED");
  }
  const requestId = buildRequestId(options.requestId, threadId, request);
  const effectiveTier = accessContext.tier;
  let usageSummary = accessContext.usageSummary;
  let reservedUsageCount = false;
  let claimedExecution:
    | Awaited<ReturnType<typeof claimPendingConversationWrite>>
    | null = null;

  if (options.actorRole !== "admin" && accessContext.usageWindow) {
    const reserved = await reserveUsageIdempotent(db, {
      userId,
      requestId,
      threadId,
      tier: effectiveTier,
      window: accessContext.usageWindow,
    });
    usageSummary = reserved;
    reservedUsageCount = reserved.counted;
  }

  try {
    claimedExecution = await claimPendingConversationWrite(app, {
      threadId,
      userId,
      requestId,
      message: request.message,
      actorRole: options.actorRole ?? "member",
    });
    const claimed = claimedExecution;

    const historyRows = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.thread_id, threadId))
      .orderBy(desc(conversationMessages.created_at))
      .limit(MAX_HISTORY + 1);

    const history = [...historyRows]
      .filter((message) => message.id !== claimed.pendingMessage.id)
      .reverse()
      .map((message) => ({
        role: normalizeRole(message.role),
        content: message.content,
      }));

    const orchestration = await processDivin8Message({
      app,
      message: request.message,
      threadId,
      userId: claimed.thread.user_id,
      profileOwnerId: options.profileOwnerId,
      tier: effectiveTier,
      language: request.language,
      imageRef: request.image_ref,
      imageRefs: request.image_refs,
      profileTags: request.profile_tags,
      systems: request.systems,
      timeline: request.timeline,
      history: [
        ...history,
        { role: "user" as const, content: request.message },
      ],
      storedState: claimed.storedState,
      debugAudit: request.debugAudit,
    });
    const response = orchestration.chat;
    const visibleAssistantMessage = stripVerificationTags(response.message) || response.message;

    const savedAt = new Date();
    const assistantMeta: StoredConversationMessageMeta = {
      engine_used: response.engine_used,
      systems_used: response.systems_used,
      pipeline_status: response.meta.pipeline_status,
      route_type: response.meta.route_type,
      time_context: response.meta.time_context,
      stages: response.meta.stages,
      divin8: response.meta.divin8,
      telemetry: response.meta.telemetry,
    };

    const nextSummary = buildDeterministicConversationSummary(orchestration.storedState, visibleAssistantMessage || request.message);
    const nextTitle = resolveNextThreadTitle(claimed.thread, request.message);
    const nextSearchText = buildThreadSearchText(nextTitle, nextSummary, request.message);
    const storedState = isPlaceholderThreadTitle(claimed.thread.title) && nextTitle !== claimed.thread.title
      ? withAutoTitleMetadata(orchestration.storedState)
      : orchestration.storedState;

    const savedAssistantMessage = await finalizeThreadExecutionSuccess(app, {
      thread: claimed.thread,
      userId,
      requestId,
      pendingMessageId: claimed.pendingMessage.id,
      visibleAssistantMessage,
      assistantMeta,
      nextTitle,
      nextSummary,
      nextSearchText,
      savedAt,
      storedState,
    });
    await persistDivin8Memories(db, {
      conversationId: threadId,
      userId,
      candidates: orchestration.memoryCandidates,
    });
    const finalizedPendingMessage = claimed.pendingMessage;
    const finalizedThread = claimed.thread;
    claimedExecution = null;

    if (options.actorRole === "admin") {
      const usage = await getMonthlyUsageSummary(db, userId);
      usageSummary = {
        used: usage.month_used,
        limit: usage.seeker_limit,
        periodStart: usageSummary.periodStart,
        periodEnd: usageSummary.periodEnd,
      };
    }

    const usage: Divin8UsageSummary = {
      month_used: usageSummary.used,
      seeker_limit: usageSummary.limit ?? DIVIN8_LIMITS.seeker,
      used: usageSummary.used,
      limit: usageSummary.limit,
      period_start: usageSummary.periodStart,
      period_end: usageSummary.periodEnd,
    };
    const responseWithMemberMeta = {
      ...response,
      meta: {
        ...response.meta,
        tier: effectiveTier,
        usage: {
          used: usageSummary.used,
          limit: usageSummary.limit,
        },
      },
    };
    const responseMeta: Divin8ResponseMeta = {
      tier: effectiveTier,
      billing_interval: accessContext.billingInterval,
      usage: {
        used: usageSummary.used,
        limit: usageSummary.limit,
        period_start: usageSummary.periodStart,
        period_end: usageSummary.periodEnd,
      },
    };

    return {
      thread: threadSummaryFromRow(
        {
          ...finalizedThread,
          title: nextTitle,
          summary: nextSummary,
          search_text: nextSearchText,
          updated_at: savedAt,
          meta: {
            ...withThreadListState(storedState, {
              preview: visibleAssistantMessage,
              messageCount: history.length + 2,
              lastMessageAt: savedAt,
            }),
            activeExecution: null,
            lastExecutionError: null,
          },
        },
        clipPreview(visibleAssistantMessage),
        history.length + 2,
      ),
      user_message: {
        id: finalizedPendingMessage.id,
        role: "user" as const,
        content: finalizedPendingMessage.content,
        created_at: finalizedPendingMessage.created_at.toISOString(),
      },
      assistant_message: {
        id: savedAssistantMessage.id,
        role: "assistant" as const,
        content: visibleAssistantMessage,
        created_at: savedAssistantMessage.created_at.toISOString(),
      },
      chat: responseWithMemberMeta,
      timeline: orchestration.timeline,
      usage,
      meta: responseMeta,
    };
  } catch (error) {
    if (claimedExecution) {
      try {
        await finalizeThreadExecutionFailure(app, {
          threadId,
          userId,
          requestId,
          pendingMessageId: claimedExecution.pendingMessage.id,
          error,
        });
      } catch (finalizeError) {
        app.log.error({
          msg: "divin8_thread_execution_finalize_failure",
          threadId,
          userId,
          requestId,
          error: finalizeError,
        });
      }
    }
    if (reservedUsageCount && options.actorRole !== "admin" && accessContext.usageWindow) {
      await releaseUsageReservation(db, {
        userId,
        requestId,
        window: accessContext.usageWindow,
        tier: effectiveTier,
      });
    }
    throw error;
  }
}

function escapeMarkdown(text: string) {
  return text.replace(/[\\`*_{}[\]()#+\-.!>]/g, "\\$&");
}

function formatExportDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function resolveExportTitle(title: string) {
  return isPlaceholderThreadTitle(title) ? FALLBACK_MEANINGFUL_THREAD_TITLE : title;
}

function resolveExportFilenameBase(title: string, exportedAt: Date) {
  const datePrefix = exportedAt.toISOString().slice(0, 10);
  const slug = slugForFilename(resolveExportTitle(title)) || "divin8-reading";
  return `divin8-${datePrefix}-${slug}`;
}

function conversationMarkdown(
  title: string,
  messages: Divin8ConversationMessage[],
  input: {
    exportedAt: Date;
    createdAt: string;
  },
) {
  const exportTitle = resolveExportTitle(title);
  const parts = [
    `# ${escapeMarkdown(exportTitle)}`,
    "",
    `Exported: ${formatExportDate(input.exportedAt)}`,
    `Conversation created: ${formatExportDate(input.createdAt)}`,
    "",
    "---",
  ];

  for (const message of messages) {
    const label = message.role === "assistant" ? "Divin8" : "User";
    const content = message.content.trim() || "_No content_";
    parts.push("", `## ${label}`, "", message.role === "assistant" ? content : escapeMarkdown(content));
  }
  return `${parts.join("\n")}\n`;
}

function conversationText(
  title: string,
  messages: Divin8ConversationMessage[],
  input: {
    exportedAt: Date;
    createdAt: string;
  },
) {
  const exportTitle = resolveExportTitle(title);
  const parts = [
    exportTitle,
    "",
    `Exported: ${formatExportDate(input.exportedAt)}`,
    `Conversation created: ${formatExportDate(input.createdAt)}`,
    "",
    "----------------------------------------",
  ];

  for (const message of messages) {
    const label = message.role === "assistant" ? "Divin8" : "User";
    parts.push("", label, "", message.content.trim() || "No content");
  }
  return `${parts.join("\n")}\n`;
}

function contentTypeForExport(format: Divin8ConversationExportFormat) {
  switch (format) {
    case "md":
      return "text/markdown; charset=utf-8";
    case "txt":
      return "text/plain; charset=utf-8";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pdf":
      return "application/pdf";
  }
}

async function buildConversationExportFromDetail(
  detail: Divin8ConversationDetail,
  input: {
    format: Divin8ConversationExportFormat;
    exportedAt?: Date;
  },
) {
  if (detail.messages.length === 0) {
    throw createHttpError(400, "Conversation is empty and cannot be exported.");
  }

  const exportedAt = input.exportedAt ?? new Date();
  const title = resolveExportTitle(detail.thread.title);
  const markdown = conversationMarkdown(title, detail.messages, {
    exportedAt,
    createdAt: detail.thread.created_at,
  });
  const filenameBase = resolveExportFilenameBase(title, exportedAt);

  if (input.format === "txt") {
    return {
      contentType: contentTypeForExport(input.format),
      filename: `${filenameBase}.txt`,
      buffer: Buffer.from(conversationText(title, detail.messages, {
        exportedAt,
        createdAt: detail.thread.created_at,
      }), "utf8"),
    };
  }

  if (input.format === "md") {
    return {
      contentType: contentTypeForExport(input.format),
      filename: `${filenameBase}.md`,
      buffer: Buffer.from(markdown, "utf8"),
    };
  }

  if (input.format === "docx") {
    return {
      contentType: contentTypeForExport(input.format),
      filename: `${filenameBase}.docx`,
      buffer: await exportDocxFromMarkdown(title, markdown),
    };
  }

  return {
    contentType: contentTypeForExport(input.format),
    filename: `${filenameBase}.pdf`,
    buffer: await exportPdfFromMarkdown(title, markdown),
  };
}

function resolveBackupConversationPath(
  usedPaths: Set<string>,
  input: {
    title: string;
    exportedAt: Date;
  },
) {
  const datePrefix = input.exportedAt.toISOString().slice(0, 10);
  const slug = slugForFilename(resolveExportTitle(input.title)) || "divin8-reading";
  let candidate = `conversations/${datePrefix}-${slug}.md`;
  let index = 2;
  while (usedPaths.has(candidate)) {
    candidate = `conversations/${datePrefix}-${slug}-${index}.md`;
    index += 1;
  }
  usedPaths.add(candidate);
  return candidate;
}

export async function exportConversation(
  db: Database,
  input: { threadId: string; format: Divin8ConversationExportFormat },
  userId = ADMIN_DIVIN8_USER_ID,
) {
  const detail = await getConversationDetail(db, input.threadId, userId);
  return buildConversationExportFromDetail(detail, input);
}

export async function backupConversationThreads(
  db: Database,
  userId = ADMIN_DIVIN8_USER_ID,
) {
  const exportedAt = new Date();
  const threads = (await db
    .select()
    .from(conversationThreads)
    .where(and(
      eq(conversationThreads.user_id, userId),
      eq(conversationThreads.is_archived, false),
    ))
    .orderBy(asc(conversationThreads.created_at))
    .limit(MAX_BACKUP_CONVERSATIONS + 1)) as ConversationThreadRow[];

  if (threads.length > MAX_BACKUP_CONVERSATIONS) {
    throw createHttpError(413, `Conversation backup is limited to ${MAX_BACKUP_CONVERSATIONS} conversations at a time.`);
  }

  const archive = createArchiver("zip", { zlib: { level: 9 } });
  const stream = new PassThrough();
  const usedPaths = new Set<string>();
  const exportedConversations: Array<{ title: string; path: string; createdAt: string }> = [];

  archive.on("error", (error: Error) => {
    stream.destroy(error);
  });
  archive.pipe(stream);

  for (const thread of threads) {
    const messages = await getThreadMessages(db, thread.id);
    if (messages.length === 0) {
      continue;
    }
    const detail: Divin8ConversationDetail = {
      thread: threadSummaryFromRow(thread, messages.length > 0 ? clipPreview(messages[messages.length - 1].content) : null, messages.length),
      messages: messages.map((message) => ({
        id: message.id,
        role: normalizeRole(message.role),
        content: message.content,
        created_at: message.created_at.toISOString(),
        meta: null,
      })),
      timeline: [],
      last_pipeline_meta: null,
      active_execution: null,
    };
    const path = resolveBackupConversationPath(usedPaths, {
      title: detail.thread.title,
      exportedAt,
    });
    archive.append(conversationMarkdown(detail.thread.title, detail.messages, {
      exportedAt,
      createdAt: detail.thread.created_at,
    }), { name: path });
    exportedConversations.push({
      title: resolveExportTitle(detail.thread.title),
      path,
      createdAt: detail.thread.created_at,
    });
  }

  const indexMarkdown = [
    "# Divin8 Chat Backup",
    "",
    `Exported: ${formatExportDate(exportedAt)}`,
    "",
    "## Conversations",
    "",
    ...exportedConversations.map((conversation) => (
      `- [${escapeMarkdown(conversation.title)}](${conversation.path})`
    )),
    "",
  ].join("\n");

  archive.append(indexMarkdown, { name: "index.md" });
  archive.append(JSON.stringify({
    exportedAt: exportedAt.toISOString(),
    conversationCount: exportedConversations.length,
    format: "markdown",
    source: "Divin8 Chat",
  }, null, 2), { name: "metadata.json" });
  void archive.finalize();

  return {
    contentType: "application/zip",
    filename: `divin8-chat-backup-${exportedAt.toISOString().slice(0, 10)}.zip`,
    stream,
  };
}

export const __conversationServiceTestInternals = {
  buildThreadTitle,
  isPlaceholderThreadTitle,
  resolveNextThreadTitle,
};
