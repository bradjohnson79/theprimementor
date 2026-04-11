import { and, desc, eq } from "drizzle-orm";
import { conversationTimelineEvents, type Database } from "@wisdom/db";

export type Divin8TimelineEventType = "input" | "engine" | "insight";

export interface Divin8TimelineEvent {
  id: string;
  threadId: string;
  userId: string;
  summary: string;
  systemsUsed: string[];
  tags: string[];
  type: Divin8TimelineEventType;
  createdAt: string;
}

export interface AppendTimelineEventInput {
  threadId: string;
  userId: string;
  summary: string;
  systemsUsed?: string[];
  tags?: string[];
  type: Divin8TimelineEventType;
}

export interface TimelineHighlightSelectionInput {
  events: Divin8TimelineEvent[];
  knownProfileFacts: string[];
  systems: string[];
  themes: string[];
  timeWindow?: string | null;
  limit?: number;
}

function normalizeList(values: Array<string | null | undefined>) {
  return [...new Set(
    values
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean),
  )];
}

function normalizeEvent(row: {
  id: string;
  thread_id: string;
  user_id: string;
  summary: string;
  systems_used: unknown;
  tags: unknown;
  type: string;
  created_at: Date;
}): Divin8TimelineEvent {
  return {
    id: row.id,
    threadId: row.thread_id,
    userId: row.user_id,
    summary: row.summary,
    systemsUsed: Array.isArray(row.systems_used)
      ? normalizeList(row.systems_used.map((value) => (typeof value === "string" ? value : null)))
      : [],
    tags: Array.isArray(row.tags)
      ? normalizeList(row.tags.map((value) => (typeof value === "string" ? value : null)))
      : [],
    type: (row.type === "engine" || row.type === "insight" ? row.type : "input"),
    createdAt: row.created_at.toISOString(),
  };
}

export async function appendTimelineEvent(db: Database, input: AppendTimelineEventInput) {
  const summary = input.summary.replace(/\s+/g, " ").trim();
  if (!summary) {
    return null;
  }

  const [created] = await db
    .insert(conversationTimelineEvents)
    .values({
      thread_id: input.threadId,
      user_id: input.userId,
      summary,
      systems_used: normalizeList(input.systemsUsed ?? []),
      tags: normalizeList(input.tags ?? []),
      type: input.type,
    })
    .returning();

  return normalizeEvent(created);
}

export async function listTimelineEvents(
  db: Database,
  threadId: string,
  userId: string,
  limit = 20,
) {
  const rows = await db
    .select()
    .from(conversationTimelineEvents)
    .where(and(
      eq(conversationTimelineEvents.thread_id, threadId),
      eq(conversationTimelineEvents.user_id, userId),
    ))
    .orderBy(desc(conversationTimelineEvents.created_at))
    .limit(limit);

  return rows.map(normalizeEvent);
}

function scoreTimelineEvent(
  event: Divin8TimelineEvent,
  systems: string[],
  themes: string[],
  timeWindow?: string | null,
) {
  let score = 0;
  const lowerSummary = event.summary.toLowerCase();

  if (systems.some((system) => event.systemsUsed.includes(system))) {
    score += 5;
  }

  if (themes.some((theme) => event.tags.includes(theme) || lowerSummary.includes(theme.toLowerCase()))) {
    score += 3;
  }

  if (timeWindow && lowerSummary.includes(timeWindow.toLowerCase())) {
    score += 2;
  }

  if (event.type === "engine") {
    score += 2;
  }

  if (event.type === "insight") {
    score += 1;
  }

  return score;
}

export function selectTimelineHighlights(input: TimelineHighlightSelectionInput) {
  const limit = input.limit ?? 6;
  const highlights: string[] = [];
  const seen = new Set<string>();

  for (const fact of normalizeList(input.knownProfileFacts)) {
    if (highlights.length >= limit) {
      break;
    }
    seen.add(fact);
    highlights.push(fact);
  }

  const prioritizedEvents = [...input.events]
    .map((event) => ({
      event,
      score: scoreTimelineEvent(event, input.systems, input.themes, input.timeWindow),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.event.createdAt.localeCompare(left.event.createdAt);
    });

  for (const { event } of prioritizedEvents) {
    const summary = event.summary.trim();
    if (!summary || seen.has(summary)) {
      continue;
    }
    seen.add(summary);
    highlights.push(summary);
    if (highlights.length >= limit) {
      break;
    }
  }

  return highlights;
}
