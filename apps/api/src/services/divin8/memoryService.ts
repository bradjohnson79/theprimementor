import { and, desc, eq, ne } from "drizzle-orm";
import {
  conversationMemories,
  conversationThreads,
  type Database,
} from "@wisdom/db";
import type { Divin8TimelineRequest } from "@wisdom/utils";

export type Divin8PersistentMemoryType = "preference" | "pattern" | "fact" | "past_reading";

export interface Divin8PersistentMemory {
  id: string;
  conversationId: string;
  userId: string;
  type: Divin8PersistentMemoryType;
  content: string;
  relevanceScore: number;
  createdAt: string;
}

export interface DistilledDivin8MemoryCandidate {
  type: Divin8PersistentMemoryType;
  content: string;
  relevanceScore: number;
}

export interface DistillDivin8MemoryInput {
  userMessage: string;
  conversationSummary?: string | null;
  profileTags?: string[];
  timeline?: Divin8TimelineRequest;
  systemsUsed?: string[];
  engineUsed?: boolean;
}

interface RetrievedMemoryRow {
  id: string;
  conversationId: string;
  userId: string;
  type: string;
  content: string;
  relevanceScore: number;
  createdAt: Date;
  conversationArchived: boolean;
}

const TOKEN_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "before",
  "can",
  "compare",
  "for",
  "from",
  "guidance",
  "how",
  "i",
  "in",
  "is",
  "it",
  "last",
  "me",
  "month",
  "my",
  "next",
  "of",
  "on",
  "or",
  "reading",
  "rest",
  "say",
  "the",
  "this",
  "to",
  "today",
  "we",
  "what",
  "with",
]);

const MEMORY_TYPE_PRIORITY: Record<Divin8PersistentMemoryType, number> = {
  pattern: 4,
  preference: 3,
  past_reading: 2,
  fact: 1,
};

const RECALL_QUERY_REGEX = /\b(compare|before|earlier|last reading|last month|previous|prior|remember|recall)\b/i;
const PREFERENCE_REGEX = /\b(prefer|preference|only use|stick to|always use)\b/i;

function normalizeContent(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clipContent(value: string, limit = 220) {
  const normalized = normalizeContent(value);
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 3)}...`;
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, value));
}

function tokenize(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s@#-]/gu, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !TOKEN_STOPWORDS.has(token)),
  );
}

function inferSystemPreference(input: DistillDivin8MemoryInput) {
  const normalizedMessage = input.userMessage.toLowerCase();
  if (input.timeline?.system) {
    return `User prefers ${input.timeline.system === "vedic" ? "Vedic astrology" : "Western astrology"}.`;
  }
  if (!PREFERENCE_REGEX.test(normalizedMessage)) {
    return null;
  }
  if (normalizedMessage.includes("vedic")) {
    return "User prefers Vedic astrology.";
  }
  if (normalizedMessage.includes("western")) {
    return "User prefers Western astrology.";
  }
  if (normalizedMessage.includes("numerology")) {
    return "User prefers numerology readings.";
  }
  if (normalizedMessage.includes("human design")) {
    return "User prefers Human Design readings.";
  }
  if (normalizedMessage.includes("rune")) {
    return "User prefers rune readings.";
  }
  return null;
}

function uniqueCandidates(candidates: DistilledDivin8MemoryCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.type}:${candidate.content.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function parsePersistentMemoryType(value: string): Divin8PersistentMemoryType {
  return (value === "preference" || value === "pattern" || value === "fact" || value === "past_reading")
    ? value
    : "fact";
}

export function distillDivin8MemoryCandidates(input: DistillDivin8MemoryInput): DistilledDivin8MemoryCandidate[] {
  const profileTags = [...new Set((input.profileTags ?? []).map((tag) => tag.trim()).filter(Boolean))];
  const normalizedSummary = clipContent(input.conversationSummary ?? "");
  const preference = inferSystemPreference(input);
  const hasMeaningfulInterpretation = Boolean(input.engineUsed || input.timeline || normalizedSummary);

  if (!preference && profileTags.length === 0 && !input.timeline && !hasMeaningfulInterpretation) {
    return [];
  }

  const candidates: DistilledDivin8MemoryCandidate[] = [];

  if (preference) {
    candidates.push({
      type: "preference",
      content: preference,
      relevanceScore: 0.92,
    });
  }

  for (const tag of profileTags) {
    candidates.push({
      type: "fact",
      content: `User uses saved Divin8 profile ${tag}.`,
      relevanceScore: 0.8,
    });
  }

  if (input.timeline) {
    candidates.push({
      type: "pattern",
      content: "User uses timeline forecasting in Divin8.",
      relevanceScore: 0.84,
    });
  }

  if (normalizedSummary) {
    candidates.push({
      type: "past_reading",
      content: `Recent reading outcome: ${normalizedSummary}`,
      relevanceScore: input.timeline || input.engineUsed ? 0.88 : 0.7,
    });
  }

  return uniqueCandidates(candidates).map((candidate) => ({
    ...candidate,
    content: normalizeContent(candidate.content),
    relevanceScore: clampScore(candidate.relevanceScore),
  }));
}

export function memoryConflictKey(memory: Pick<Divin8PersistentMemory, "type" | "content">) {
  const normalized = memory.content.toLowerCase();
  if (memory.type === "preference") {
    return "preference";
  }
  const profileTag = normalized.match(/@[a-z0-9]+/i)?.[0];
  if (memory.type === "fact" && profileTag) {
    return `fact:${profileTag}`;
  }
  if (memory.type === "pattern" && normalized.includes("timeline forecasting")) {
    return "pattern:timeline";
  }
  return `${memory.type}:${normalized.slice(0, 80)}`;
}

function computeMemoryScore(memory: Divin8PersistentMemory, queryTokens: Set<string>, recallQuery: boolean, now: Date) {
  const memoryTokens = tokenize(memory.content);
  const overlapCount = [...queryTokens].filter((token) => memoryTokens.has(token)).length;
  const overlapScore = queryTokens.size > 0 ? overlapCount / queryTokens.size : 0;
  const ageMs = now.getTime() - new Date(memory.createdAt).getTime();
  const ageDays = ageMs > 0 ? ageMs / 86_400_000 : 0;
  const recencyScore = 1 / (1 + (ageDays / 30));
  const typeScore = MEMORY_TYPE_PRIORITY[memory.type] / 4;
  const recallBoost = recallQuery && (memory.type === "past_reading" || memory.type === "pattern") ? 0.2 : 0;
  const relevanceScore = clampScore(memory.relevanceScore);
  return (overlapScore * 0.45) + (relevanceScore * 0.25) + (recencyScore * 0.15) + (typeScore * 0.15) + recallBoost;
}

export function rankRetrievedMemories(
  rows: Array<RetrievedMemoryRow | (Divin8PersistentMemory & { conversationArchived?: boolean })>,
  input: {
    message: string;
    excludeConversationId?: string;
    limit?: number;
    now?: Date;
  },
): Divin8PersistentMemory[] {
  const limit = input.limit ?? 5;
  const now = input.now ?? new Date();
  const queryTokens = tokenize(input.message);
  const recallQuery = RECALL_QUERY_REGEX.test(input.message);

  const normalized: Divin8PersistentMemory[] = rows
    .filter((row) => !row.conversationArchived)
    .filter((row) => !input.excludeConversationId || row.conversationId !== input.excludeConversationId)
    .map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      userId: row.userId,
      type: parsePersistentMemoryType(row.type),
      content: normalizeContent(row.content),
      relevanceScore: clampScore(row.relevanceScore),
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    }));

  const ranked = normalized
    .map((memory) => ({
      memory,
      score: computeMemoryScore(memory, queryTokens, recallQuery, now),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.memory.createdAt.localeCompare(left.memory.createdAt);
    });

  const selected: Divin8PersistentMemory[] = [];
  const seenConflictKeys = new Set<string>();
  for (const entry of ranked) {
    const key = memoryConflictKey(entry.memory);
    if (seenConflictKeys.has(key)) {
      continue;
    }
    seenConflictKeys.add(key);
    selected.push(entry.memory);
    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

export async function retrieveRelevantMemories(
  db: Database,
  input: {
    userId: string;
    message: string;
    excludeConversationId?: string;
    limit?: number;
  },
) {
  const whereClauses = [
    eq(conversationMemories.user_id, input.userId),
    eq(conversationThreads.is_archived, false),
  ];
  if (input.excludeConversationId) {
    whereClauses.push(ne(conversationMemories.conversation_id, input.excludeConversationId));
  }

  const rows = await db
    .select({
      id: conversationMemories.id,
      conversationId: conversationMemories.conversation_id,
      userId: conversationMemories.user_id,
      type: conversationMemories.type,
      content: conversationMemories.content,
      relevanceScore: conversationMemories.relevance_score,
      createdAt: conversationMemories.created_at,
      conversationArchived: conversationThreads.is_archived,
    })
    .from(conversationMemories)
    .innerJoin(conversationThreads, eq(conversationMemories.conversation_id, conversationThreads.id))
    .where(and(...whereClauses))
    .orderBy(desc(conversationMemories.created_at))
    .limit(40);

  return rankRetrievedMemories(rows, input);
}

export async function persistDivin8Memories(
  db: Database,
  input: {
    conversationId: string;
    userId: string;
    candidates: DistilledDivin8MemoryCandidate[];
  },
) {
  const candidates = uniqueCandidates(input.candidates)
    .filter((candidate) => candidate.content)
    .map((candidate) => ({
      conversation_id: input.conversationId,
      user_id: input.userId,
      type: candidate.type,
      content: normalizeContent(candidate.content),
      relevance_score: clampScore(candidate.relevanceScore),
    }));

  if (candidates.length === 0) {
    return [];
  }

  const inserted = await db
    .insert(conversationMemories)
    .values(candidates)
    .onConflictDoNothing({
      target: [
        conversationMemories.conversation_id,
        conversationMemories.type,
        conversationMemories.content,
      ],
    })
    .returning();

  return inserted.map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    type: parsePersistentMemoryType(row.type),
    content: row.content,
    relevanceScore: row.relevance_score,
    createdAt: row.created_at.toISOString(),
  }));
}
