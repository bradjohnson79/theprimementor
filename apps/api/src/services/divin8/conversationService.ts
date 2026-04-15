import { and, asc, desc, eq, gte, ilike, inArray, sql } from "drizzle-orm";
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
  GPT_LIVE_TAG_REGEX,
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
  active_execution?: Divin8ActiveExecutionState | null;
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
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    preview,
    message_count: messageCount,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at ? row.updated_at.toISOString() : null,
    active_execution: mapActiveExecution(storedState),
  };
}

function clipPreview(content: string) {
  const cleaned = content.replace(/\s+/g, " ").trim();
  return cleaned.length > 96 ? `${cleaned.slice(0, 93)}...` : cleaned;
}

function clipSummary(content: string) {
  const cleaned = content.replace(/\s+/g, " ").trim();
  return cleaned.length > SUMMARY_FALLBACK_LIMIT
    ? `${cleaned.slice(0, SUMMARY_FALLBACK_LIMIT - 3)}...`
    : cleaned;
}

function buildThreadTitle(message: string) {
  const words = message.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  return words.length > 0 ? words.join(" ") : DEFAULT_THREAD_TITLE;
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

async function mapThreadsWithMessages(db: Database, threads: ConversationThreadRow[]) {
  if (threads.length === 0) {
    return [] as Divin8ConversationSummary[];
  }

  const threadIds = threads.map((thread) => thread.id);
  const messages = (await db
    .select()
    .from(conversationMessages)
    .where(inArray(conversationMessages.thread_id, threadIds))
    .orderBy(desc(conversationMessages.created_at))) as ConversationMessageRow[];

  const previews = new Map<string, string | null>();
  const counts = new Map<string, number>();

  for (const message of messages) {
    counts.set(message.thread_id, (counts.get(message.thread_id) ?? 0) + 1);
    if (!previews.has(message.thread_id)) {
      previews.set(message.thread_id, clipPreview(message.content));
    }
  }

  return threads.map((thread) =>
    threadSummaryFromRow(thread, previews.get(thread.id) ?? null, counts.get(thread.id) ?? 0),
  );
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
          ...input.storedState,
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

export async function listConversationThreads(db: Database, userId = ADMIN_DIVIN8_USER_ID, actorRole?: string) {
  const threads = (await db
    .select()
    .from(conversationThreads)
    .where(and(
      eq(conversationThreads.user_id, userId),
      eq(conversationThreads.is_archived, false),
    ))
    .orderBy(desc(conversationThreads.updated_at), desc(conversationThreads.created_at))) as ConversationThreadRow[];

  if (threads.length === 0) {
    return {
      threads: [] as Divin8ConversationSummary[],
      usage: await getUsageSummaryForListing(db, userId, actorRole),
    };
  }

  return {
    threads: await mapThreadsWithMessages(db, threads),
    usage: await getUsageSummaryForListing(db, userId, actorRole),
  };
}

export async function searchConversationThreads(
  db: Database,
  query: string,
  userId = ADMIN_DIVIN8_USER_ID,
) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return { threads: [] as Divin8ConversationSummary[] };
  }

  const threads = (await db
    .select()
    .from(conversationThreads)
    .where(and(
      eq(conversationThreads.user_id, userId),
      eq(conversationThreads.is_archived, false),
      ilike(sql<string>`coalesce(${conversationThreads.search_text}, ${conversationThreads.title})`, `%${normalizedQuery}%`),
    ))
    .orderBy(desc(conversationThreads.updated_at), desc(conversationThreads.created_at))
    .limit(20)) as ConversationThreadRow[];

  return {
    threads: await mapThreadsWithMessages(db, threads),
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
    const initialTitle =
      claimed.thread.title === DEFAULT_THREAD_TITLE && history.length === 0
        ? buildThreadTitle(request.message)
        : claimed.thread.title;

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
    const nextTitle = buildFallbackTitle(nextSummary, request.message) || initialTitle;
    const nextSearchText = buildThreadSearchText(nextTitle, nextSummary, request.message);

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
      storedState: orchestration.storedState,
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
            ...orchestration.storedState,
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

function conversationMarkdown(title: string, messages: Divin8ConversationMessage[]) {
  const parts = [`# ${title}`, "", "## Conversation"];
  for (const message of messages) {
    if (message.role === "assistant") {
      parts.push("", "### Divin8", "", message.content.trim() || "_No content_");
    } else {
      parts.push("", "### User", "", escapeMarkdown(message.content.trim() || "_No content_"));
    }
  }
  return parts.join("\n");
}

export async function exportConversation(
  db: Database,
  input: { threadId: string; format: "pdf" | "docx" },
  userId = ADMIN_DIVIN8_USER_ID,
) {
  const detail = await getConversationDetail(db, input.threadId, userId);
  if (detail.messages.length === 0) {
    throw createHttpError(400, "Conversation is empty and cannot be exported.");
  }

  const title = detail.thread.title === DEFAULT_THREAD_TITLE ? "Divin8 Conversation" : detail.thread.title;
  const markdown = conversationMarkdown(title, detail.messages);
  const filenameBase = `divin8-conversation-${slugForFilename(title)}`;

  if (input.format === "docx") {
    return {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      filename: `${filenameBase}.docx`,
      buffer: await exportDocxFromMarkdown(title, markdown),
    };
  }

  return {
    contentType: "application/pdf",
    filename: `${filenameBase}.pdf`,
    buffer: await exportPdfFromMarkdown(title, markdown),
  };
}
