import {
  adsAgentConversations,
  adsAgentMessages,
} from "@wisdom/db";
import type { Database } from "@wisdom/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { createHttpError } from "../booking/errors.js";
import type {
  AdsAgentContext,
  AdsAgentConversationSummary,
  AdsAgentGeneration,
  AdsAgentMessage,
} from "./types.js";

const HISTORY_LIMIT = 16;
const GENERATION_STALE_MS = 2 * 60_000;
const GENERATION_KEY = "_generation";

function mapMessage(row: {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  model: string | null;
  context: Record<string, unknown> | null;
  created_at: Date;
}): AdsAgentMessage {
  const role = row.role === "assistant" || row.role === "system" ? row.role : "user";
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role,
    content: row.content,
    model: row.model,
    context: (row.context as AdsAgentContext | null) ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listAdsConversations(db: Database, userId: string): Promise<AdsAgentConversationSummary[]> {
  const rows = await db
    .select()
    .from(adsAgentConversations)
    .where(eq(adsAgentConversations.user_id, userId))
    .orderBy(desc(adsAgentConversations.updated_at))
    .limit(20);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    model: row.model,
    updatedAt: row.updated_at?.toISOString() ?? row.created_at.toISOString(),
  }));
}

export async function createAdsConversation(
  db: Database,
  userId: string,
  context: AdsAgentContext,
) {
  const [row] = await db.insert(adsAgentConversations).values({
    user_id: userId,
    context,
  }).returning();
  if (!row) throw createHttpError(500, "Unable to create Ads Agent conversation");
  return row;
}

export async function getAdsConversation(
  db: Database,
  userId: string,
  conversationId: string,
) {
  const [conversation] = await db
    .select()
    .from(adsAgentConversations)
    .where(and(eq(adsAgentConversations.id, conversationId), eq(adsAgentConversations.user_id, userId)))
    .limit(1);
  if (!conversation) throw createHttpError(404, "Ads Agent conversation not found");
  const messages = await db
    .select()
    .from(adsAgentMessages)
    .where(eq(adsAgentMessages.conversation_id, conversationId))
    .orderBy(asc(adsAgentMessages.created_at));
  return {
    id: conversation.id,
    title: conversation.title,
    model: conversation.model,
    summary: conversation.summary,
    messages: messages.map(mapMessage),
    generation: readGeneration(conversation.context),
  };
}

function asContextRecord(value: Record<string, unknown> | null | undefined) {
  return value && typeof value === "object" ? { ...value } : {};
}

function readGeneration(context: Record<string, unknown> | null | undefined): AdsAgentGeneration {
  const raw = context && typeof context === "object" ? context[GENERATION_KEY] : null;
  if (!raw || typeof raw !== "object") return { status: "idle" };
  const value = raw as Record<string, unknown>;
  const startedAt = typeof value.startedAt === "string" ? value.startedAt : undefined;
  const stale = startedAt ? Date.now() - Date.parse(startedAt) > GENERATION_STALE_MS : false;
  if (value.status === "generating" && stale) {
    return {
      status: "failed",
      startedAt,
      error: "Ads Agent provider timed out. Please retry.",
      errorCode: "ADS_AGENT_TIMEOUT",
    };
  }
  if (value.status === "generating" || value.status === "failed" || value.status === "idle") {
    return {
      status: value.status,
      startedAt,
      error: typeof value.error === "string" ? value.error : undefined,
      errorCode: typeof value.errorCode === "string" ? value.errorCode : undefined,
    };
  }
  return { status: "idle" };
}

export async function patchAdsConversationContext(
  db: Database,
  conversationId: string,
  patch: Record<string, unknown>,
) {
  const [row] = await db
    .select({ context: adsAgentConversations.context })
    .from(adsAgentConversations)
    .where(eq(adsAgentConversations.id, conversationId))
    .limit(1);
  const current = asContextRecord(row?.context);
  await db.update(adsAgentConversations).set({
    context: { ...current, ...patch },
    updated_at: new Date(),
  }).where(eq(adsAgentConversations.id, conversationId));
}

export async function setAdsConversationGeneration(
  db: Database,
  conversationId: string,
  generation: AdsAgentGeneration,
) {
  await patchAdsConversationContext(db, conversationId, { [GENERATION_KEY]: generation });
}

export function conversationIsGenerating(generation: AdsAgentGeneration | undefined | null) {
  return generation?.status === "generating";
}

export async function appendAdsMessage(
  db: Database,
  input: {
    conversationId: string;
    role: "user" | "assistant";
    content: string;
    model?: string | null;
    context?: AdsAgentContext | null;
  },
) {
  const [row] = await db.insert(adsAgentMessages).values({
    conversation_id: input.conversationId,
    role: input.role,
    content: input.content,
    model: input.model ?? null,
    context: input.context ?? null,
  }).returning();
  await db.update(adsAgentConversations).set({
    updated_at: new Date(),
    model: input.model ?? undefined,
    title: input.role === "user" ? input.content.slice(0, 80) : undefined,
  }).where(eq(adsAgentConversations.id, input.conversationId));
  return row ? mapMessage(row) : null;
}

export async function loadRecentMessages(db: Database, conversationId: string) {
  const rows = await db
    .select()
    .from(adsAgentMessages)
    .where(eq(adsAgentMessages.conversation_id, conversationId))
    .orderBy(desc(adsAgentMessages.created_at))
    .limit(HISTORY_LIMIT);
  return rows.reverse().map(mapMessage);
}

export async function clearAdsConversation(db: Database, userId: string, conversationId: string) {
  await getAdsConversation(db, userId, conversationId);
  await db.delete(adsAgentMessages).where(eq(adsAgentMessages.conversation_id, conversationId));
  await db.update(adsAgentConversations).set({
    summary: null,
    title: null,
    updated_at: new Date(),
  }).where(eq(adsAgentConversations.id, conversationId));
}
