import {
  adsAgentMemories,
} from "@wisdom/db";
import type { Database } from "@wisdom/db";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { AdsAgentContext, AdsMemoryLayer, AdsMemoryRecord } from "./types.js";

export const ADS_MEMORY_SCOPE = "prime_mentor_ads";
export const OWNER_DECISION_AUTHORITY = 100;
export const WORKSPACE_AUTHORITY = 60;
export const CAMPAIGN_AUTHORITY = 50;
export const PERFORMANCE_AUTHORITY = 40;
export const SCREENSHOT_AUTHORITY = 35;
export const KNOWLEDGE_AUTHORITY = 20;

const MAX_RETRIEVED = 12;
const MAX_OWNER_DECISIONS = 10;
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "did", "do", "for", "from", "i", "in",
  "is", "it", "me", "my", "of", "on", "or", "our", "the", "this", "to", "we", "what",
  "when", "where", "which", "who", "with", "you",
]);

export type AdsMemoryDraft = {
  layer: AdsMemoryLayer;
  kind: string;
  category: string;
  entityKey: string;
  content: string;
  source?: string | null;
  authority: number;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
};

export type AdsMemoryIntent = {
  topics: string[];
  entities: string[];
  wantsRecall: boolean;
  campaignHint: string | null;
};

const HYPOTHESIS = /\b(maybe|might|what if|could we|should we|brainstorm|hypothetical|just thinking)\b/i;

export function tokenizeAdsMemoryQuery(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9$]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

export function classifyAdsMemoryIntent(message: string): AdsMemoryIntent {
  const lower = message.toLowerCase();
  const topics: string[] = [];
  if (/\b(budget|cpc|cpa|roas|spend|\$|cad|ca\$)\b/i.test(message)) topics.push("budget");
  if (/geo|canada|country|countries|location|targeting/i.test(message)) topics.push("geography");
  if (/\b(keyword|negative|search term)\b/i.test(message)) topics.push("keyword");
  if (/\b(campaign|ad group)\b/i.test(message)) topics.push("campaign");
  if (/\b(screenshot|upload|visible|ctr|impression)\b/i.test(message)) topics.push("screenshot");
  if (/\b(divin8|report|catalog|price|landing)\b/i.test(message)) topics.push("knowledge");
  if (/\b(performance|converting|paused|changed|last time)\b/i.test(message)) topics.push("performance");
  const wantsRecall = /\b(what|which|remind|recall|remember|did i|have we|last time|already)\b/i.test(lower);
  const campaign = message.match(/\b(divin8[^\n,]{0,40}|campaign [a-z0-9-]{2,40})\b/i);
  return {
    topics,
    entities: tokenizeAdsMemoryQuery(message).slice(0, 16),
    wantsRecall,
    campaignHint: campaign?.[1]?.trim() ?? null,
  };
}

export function isDurableAdsStatement(message: string) {
  if (HYPOTHESIS.test(message)) return false;
  return /\b(is|are|our|approved|rejected|choose|chose|decided|decision|only|do not|don't|budget|ceiling|priority)\b/i.test(message);
}

export function extractDurableAdsMemories(input: {
  message: string;
  conversationId?: string | null;
  context?: AdsAgentContext;
}): AdsMemoryDraft[] {
  const message = input.message.trim();
  if (!message || !isDurableAdsStatement(message)) return [];

  const drafts: AdsMemoryDraft[] = [];
  const conversationId = input.conversationId ?? null;
  const baseMeta = {
    type: "owner_decision",
    scope: ADS_MEMORY_SCOPE,
    sourceConversationId: conversationId,
  };

  const budget = message.match(/(?:CA\$|C\$|CAD\s*|USD\s*|\$)\s*(\d+(?:\.\d+)?)\s*(?:\/\s*day|per\s*day|\/day|daily)/i);
  if (budget) {
    const currency = /ca\$|c\$|cad/i.test(budget[0]) ? "CAD" : /usd/i.test(budget[0]) ? "USD" : "USD";
    const value = currency === "CAD" ? `CA$${budget[1]}/day` : `$${budget[1]}/day`;
    drafts.push({
      layer: "owner_decision",
      kind: "owner_decision",
      category: "budget",
      entityKey: `${ADS_MEMORY_SCOPE}:budget`,
      content: `Initial Divin8 Ads test budget is ${value}.`,
      authority: OWNER_DECISION_AUTHORITY,
      conversationId,
      metadata: { ...baseMeta, category: "budget", value },
    });
    drafts.push({
      layer: "workspace",
      kind: "workspace_preference",
      category: "budget",
      entityKey: `${ADS_MEMORY_SCOPE}:workspace:budget`,
      content: `Preferred test budget: ${value}.`,
      authority: WORKSPACE_AUTHORITY,
      conversationId,
      metadata: { scope: ADS_MEMORY_SCOPE, category: "budget", value },
    });
  }

  if (/\bcanada\s+only\b|\bonly\s+canada\b/i.test(message)) {
    const value = "Canada only";
    drafts.push({
      layer: "owner_decision",
      kind: "owner_decision",
      category: "geography",
      entityKey: `${ADS_MEMORY_SCOPE}:geography`,
      content: `Initial Divin8 Ads geography is ${value}.`,
      authority: OWNER_DECISION_AUTHORITY,
      conversationId,
      metadata: { ...baseMeta, category: "geography", value },
    });
    drafts.push({
      layer: "workspace",
      kind: "workspace_preference",
      category: "geography",
      entityKey: `${ADS_MEMORY_SCOPE}:workspace:geography`,
      content: `Preferred geography: ${value}.`,
      authority: WORKSPACE_AUTHORITY,
      conversationId,
      metadata: { scope: ADS_MEMORY_SCOPE, category: "geography", value },
    });
  }

  const approved = message.match(/\bapproved\b[:\s]+(.{8,160})/i);
  if (approved) {
    drafts.push({
      layer: "owner_decision",
      kind: "owner_decision",
      category: "approval",
      entityKey: `${ADS_MEMORY_SCOPE}:approval:${slugKey(approved[1])}`,
      content: `Owner approved: ${approved[1].trim()}`,
      authority: OWNER_DECISION_AUTHORITY,
      conversationId,
      metadata: { ...baseMeta, category: "approval", value: approved[1].trim() },
    });
  }

  const rejected = message.match(/\brejected\b[:\s]+(.{8,160})/i);
  if (rejected) {
    drafts.push({
      layer: "owner_decision",
      kind: "owner_decision",
      category: "rejection",
      entityKey: `${ADS_MEMORY_SCOPE}:rejection:${slugKey(rejected[1])}`,
      content: `Owner rejected: ${rejected[1].trim()}`,
      authority: OWNER_DECISION_AUTHORITY,
      conversationId,
      metadata: { ...baseMeta, category: "rejection", value: rejected[1].trim() },
    });
  }

  return drafts;
}

export function extractScreenshotMemories(input: {
  observations: string[];
  conversationId?: string | null;
  campaignId?: string | null;
  screenshotType?: string;
}): AdsMemoryDraft[] {
  const facts = input.observations
    .map((item) => item.trim())
    .filter((item) => item.length > 4 && item.length < 180)
    .filter((item) => /\b(\d|%|eligible|paused|enabled|ctr|cpc|cpa|roas|conv)/i.test(item))
    .slice(0, 8);
  if (!facts.length) return [];
  return [{
    layer: "screenshot",
    kind: "screenshot_fact",
    category: input.screenshotType || "google_ads_screenshot",
    entityKey: `${ADS_MEMORY_SCOPE}:screenshot:${input.campaignId || "account"}`,
    content: facts.join(" · "),
    authority: SCREENSHOT_AUTHORITY,
    conversationId: input.conversationId ?? null,
    metadata: {
      screenshotType: input.screenshotType || "google_ads_screenshot",
      observations: facts,
      campaignId: input.campaignId ?? null,
      capturedAt: new Date().toISOString(),
    },
  }];
}

export function extractPerformanceMemories(input: {
  toolName: string;
  result: unknown;
  conversationId?: string | null;
}): AdsMemoryDraft[] {
  if (!input.result || typeof input.result !== "object") return [];
  const record = input.result as Record<string, unknown>;
  if (record.available === false) return [];
  const summary = summarizePerformance(input.toolName, record);
  if (!summary) return [];
  return [{
    layer: "performance",
    kind: "performance_observation",
    category: input.toolName,
    entityKey: `${ADS_MEMORY_SCOPE}:performance:${input.toolName}`,
    content: summary,
    authority: PERFORMANCE_AUTHORITY,
    conversationId: input.conversationId ?? null,
    metadata: { toolName: input.toolName, capturedAt: new Date().toISOString() },
  }];
}

function summarizePerformance(toolName: string, record: Record<string, unknown>) {
  const data = (record.data && typeof record.data === "object") ? record.data as Record<string, unknown> : record;
  const parts: string[] = [];
  for (const key of ["spend", "cost", "clicks", "impressions", "conversions", "ctr", "averageCpc", "roas"]) {
    const value = data[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      parts.push(`${key}=${value}`);
    }
  }
  if (Array.isArray(data.campaigns) && data.campaigns.length) {
    parts.push(`${data.campaigns.length} campaigns`);
  }
  if (!parts.length) return null;
  return `Google Ads ${toolName}: ${parts.slice(0, 6).join(", ")}.`;
}

function slugKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "item";
}

function mapMemory(row: {
  id: string;
  kind: string;
  content: string;
  source: string | null;
  layer: string | null;
  category: string | null;
  entity_key: string | null;
  metadata: Record<string, unknown> | null;
  authority: number | null;
  conversation_id: string | null;
  created_at: Date;
  updated_at: Date | null;
}): AdsMemoryRecord {
  const layer = (ADS_LAYER_SET.has(row.layer ?? "") ? row.layer : "workspace") as AdsMemoryLayer;
  return {
    id: row.id,
    layer,
    kind: row.kind,
    category: row.category,
    entityKey: row.entity_key,
    content: row.content,
    source: row.source,
    authority: row.authority ?? 0,
    conversationId: row.conversation_id,
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
    updatedAt: (row.updated_at ?? row.created_at).toISOString(),
  };
}

const ADS_LAYER_SET = new Set<string>([
  "workspace", "owner_decision", "campaign", "knowledge", "screenshot", "performance",
]);

export async function writeAdsMemories(db: Database, userId: string, drafts: AdsMemoryDraft[]) {
  const written: AdsMemoryRecord[] = [];
  for (const draft of drafts) {
    const [existing] = await db
      .select()
      .from(adsAgentMemories)
      .where(and(
        eq(adsAgentMemories.user_id, userId),
        eq(adsAgentMemories.layer, draft.layer),
        eq(adsAgentMemories.entity_key, draft.entityKey),
      ))
      .limit(1);
    if (existing) {
      const [updated] = await db.update(adsAgentMemories).set({
        kind: draft.kind,
        content: draft.content,
        source: draft.source ?? existing.source,
        category: draft.category,
        metadata: draft.metadata ?? existing.metadata,
        authority: draft.authority,
        conversation_id: draft.conversationId ?? existing.conversation_id,
        updated_at: new Date(),
      }).where(eq(adsAgentMemories.id, existing.id)).returning();
      if (updated) written.push(mapMemory(updated));
      continue;
    }
    const [created] = await db.insert(adsAgentMemories).values({
      user_id: userId,
      kind: draft.kind,
      content: draft.content,
      source: draft.source ?? ADS_MEMORY_SCOPE,
      layer: draft.layer,
      category: draft.category,
      entity_key: draft.entityKey,
      metadata: draft.metadata ?? null,
      authority: draft.authority,
      conversation_id: draft.conversationId ?? null,
    }).returning();
    if (created) written.push(mapMemory(created));
  }
  return written;
}

export async function retrieveAdsMemories(db: Database, userId: string, query: string, context?: AdsAgentContext) {
  const intent = classifyAdsMemoryIntent(query);
  const rows = await db
    .select()
    .from(adsAgentMemories)
    .where(eq(adsAgentMemories.user_id, userId))
    .orderBy(desc(adsAgentMemories.authority), desc(adsAgentMemories.updated_at))
    .limit(80);

  const mapped = rows.map(mapMemory);
  const owner = newerWins(mapped.filter((item) => item.layer === "owner_decision")).slice(0, MAX_OWNER_DECISIONS);
  const rest = mapped.filter((item) => item.layer !== "owner_decision");
  const scored = rest
    .map((item) => ({ item, score: scoreMemory(item, intent, query, context) }))
    .filter((entry) => entry.score > 0 || intent.wantsRecall)
    .sort((a, b) => b.score - a.score || b.item.authority - a.item.authority)
    .slice(0, MAX_RETRIEVED - owner.length)
    .map((entry) => entry.item);

  const selected = newerWins([...owner, ...scored]).slice(0, MAX_RETRIEVED);
  return { intent, memories: selected };
}

function newerWins(records: AdsMemoryRecord[]) {
  const byKey = new Map<string, AdsMemoryRecord>();
  for (const record of records) {
    const key = `${record.layer}:${record.entityKey || record.category || record.id}`;
    const current = byKey.get(key);
    if (!current || record.updatedAt >= current.updatedAt) byKey.set(key, record);
  }
  return [...byKey.values()].sort((a, b) => b.authority - a.authority || b.updatedAt.localeCompare(a.updatedAt));
}

function scoreMemory(
  item: AdsMemoryRecord,
  intent: AdsMemoryIntent,
  query: string,
  context?: AdsAgentContext,
) {
  let score = item.authority / 100;
  const haystack = `${item.layer} ${item.category ?? ""} ${item.content}`.toLowerCase();
  for (const topic of intent.topics) {
    if (haystack.includes(topic) || item.layer === topic) score += 2;
  }
  for (const token of intent.entities) {
    if (haystack.includes(token)) score += 1;
  }
  if (intent.campaignHint && haystack.includes(intent.campaignHint.toLowerCase())) score += 3;
  if (context?.entityId && item.entityKey?.includes(context.entityId)) score += 3;
  if (item.layer === "workspace") score += 0.5;
  if (query.length < 8) score += 0.2;
  return score;
}

export function formatAdsMemoriesForPrompt(memories: AdsMemoryRecord[]) {
  if (!memories.length) return "";
  const lines = memories.map((item) => {
    const stamp = item.updatedAt.slice(0, 10);
    return `- [${item.layer}/${item.category || item.kind}] ${item.content} (${stamp})`;
  });
  return [
    "Durable Prime Mentor Ads memory (selective; do not dump unused history):",
    "Authority order: newer explicit owner decisions > canonical campaign facts > workspace memory > screenshot/performance findings.",
    "Do not re-ask facts already stored here.",
    ...lines,
  ].join("\n");
}

export async function listAdsMemories(db: Database, userId: string, input?: { q?: string; layer?: string }) {
  const conditions = [eq(adsAgentMemories.user_id, userId)];
  if (input?.layer && ADS_LAYER_SET.has(input.layer)) {
    conditions.push(eq(adsAgentMemories.layer, input.layer));
  }
  const rows = await db
    .select()
    .from(adsAgentMemories)
    .where(and(...conditions))
    .orderBy(desc(adsAgentMemories.updated_at))
    .limit(100);
  const mapped = rows.map(mapMemory);
  const q = input?.q?.trim().toLowerCase();
  if (!q) return mapped;
  return mapped.filter((item) => `${item.layer} ${item.category ?? ""} ${item.content}`.toLowerCase().includes(q));
}

export async function deleteAdsMemory(db: Database, userId: string, id: string) {
  const deleted = await db
    .delete(adsAgentMemories)
    .where(and(eq(adsAgentMemories.id, id), eq(adsAgentMemories.user_id, userId)))
    .returning({ id: adsAgentMemories.id });
  return deleted.length > 0;
}

export async function clearAdsWorkspaceMemory(db: Database, userId: string) {
  await db.delete(adsAgentMemories).where(and(
    eq(adsAgentMemories.user_id, userId),
    inArray(adsAgentMemories.layer, ["workspace", "screenshot", "performance"]),
  ));
}

export async function adsMemoryStatus(db: Database, userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(adsAgentMemories)
    .where(and(eq(adsAgentMemories.user_id, userId), ne(adsAgentMemories.layer, "knowledge")));
  return {
    enabled: true,
    count: Number(row?.count ?? 0),
    scope: ADS_MEMORY_SCOPE,
  };
}
