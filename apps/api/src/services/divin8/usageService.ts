import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  memberUsage,
  memberUsageEvents,
  type Database,
} from "@wisdom/db";
import { TIER_CONFIG, getDivin8Access, type Divin8MemberProfile } from "@wisdom/utils";
import type { MemberEntitlementSnapshot } from "./entitlementService.js";

export interface UsageWindow {
  periodStart: Date;
  periodEnd: Date;
}

export interface MemberUsageSummary {
  used: number;
  limit: number | null;
  periodStart: string;
  periodEnd: string;
}

type UsageLimitError = Error & {
  statusCode?: number;
  code?: string;
};

function addMonthsUTC(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function clampToCycle(windowStart: Date, cycleEnd: Date) {
  if (windowStart > cycleEnd) {
    return new Date(cycleEnd);
  }
  return windowStart;
}

export function resolveUsageWindow(snapshot: MemberEntitlementSnapshot, now = new Date()): UsageWindow {
  if (snapshot.currentPeriodStart && snapshot.currentPeriodEnd) {
    const cycleStart = new Date(snapshot.currentPeriodStart);
    const cycleEnd = new Date(snapshot.currentPeriodEnd);
    let periodStart = new Date(cycleStart);

    while (addMonthsUTC(periodStart, 1) <= now && addMonthsUTC(periodStart, 1) < cycleEnd) {
      periodStart = addMonthsUTC(periodStart, 1);
    }

    const periodEndCandidate = addMonthsUTC(periodStart, 1);
    const periodEnd = periodEndCandidate <= cycleEnd ? periodEndCandidate : cycleEnd;
    return {
      periodStart: clampToCycle(periodStart, cycleEnd),
      periodEnd,
    };
  }

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    periodStart: monthStart,
    periodEnd: monthEnd,
  };
}

async function getOrCreateUsageRow(
  db: Database,
  userId: string,
  window: UsageWindow,
) {
  await db
    .insert(memberUsage)
    .values({
      user_id: userId,
      period_start: window.periodStart,
      period_end: window.periodEnd,
      prompts_used: 0,
    })
    .onConflictDoNothing({
      target: [memberUsage.user_id, memberUsage.period_start, memberUsage.period_end],
    });

  const [usageRow] = await db
    .select()
    .from(memberUsage)
    .where(and(
      eq(memberUsage.user_id, userId),
      eq(memberUsage.period_start, window.periodStart),
      eq(memberUsage.period_end, window.periodEnd),
    ))
    .limit(1);

  return usageRow;
}

export async function getMemberUsageSummary(
  db: Database,
  input: {
    userId: string;
    tier: "seeker" | "initiate";
    window: UsageWindow;
  },
): Promise<MemberUsageSummary> {
  const usageRow = await getOrCreateUsageRow(db, input.userId, input.window);
  const used = usageRow?.prompts_used ?? 0;
  const limit = TIER_CONFIG[input.tier].promptLimit;
  return {
    used,
    limit,
    periodStart: input.window.periodStart.toISOString(),
    periodEnd: input.window.periodEnd.toISOString(),
  };
}

export async function incrementUsageIdempotent(
  db: Database,
  input: {
    userId: string;
    requestId: string;
    threadId: string;
    messageId: string;
    window: UsageWindow;
  },
) {
  return db.transaction(async (tx) => {
    const [eventRow] = await tx
      .insert(memberUsageEvents)
      .values({
        user_id: input.userId,
        request_id: input.requestId,
        thread_id: input.threadId,
        message_id: input.messageId,
        period_start: input.window.periodStart,
        period_end: input.window.periodEnd,
      })
      .onConflictDoNothing({
        target: [memberUsageEvents.user_id, memberUsageEvents.request_id],
      })
      .returning({ id: memberUsageEvents.id });

    await tx
      .insert(memberUsage)
      .values({
        user_id: input.userId,
        period_start: input.window.periodStart,
        period_end: input.window.periodEnd,
        prompts_used: 0,
      })
      .onConflictDoNothing({
        target: [memberUsage.user_id, memberUsage.period_start, memberUsage.period_end],
      });

    if (eventRow) {
      await tx
        .update(memberUsage)
        .set({
          prompts_used: sql`${memberUsage.prompts_used} + 1`,
          updated_at: new Date(),
        })
        .where(and(
          eq(memberUsage.user_id, input.userId),
          eq(memberUsage.period_start, input.window.periodStart),
          eq(memberUsage.period_end, input.window.periodEnd),
        ));
    }

    const [usageRow] = await tx
      .select()
      .from(memberUsage)
      .where(and(
        eq(memberUsage.user_id, input.userId),
        eq(memberUsage.period_start, input.window.periodStart),
        eq(memberUsage.period_end, input.window.periodEnd),
      ))
      .limit(1);

    return {
      counted: Boolean(eventRow),
      used: usageRow?.prompts_used ?? 0,
    };
  });
}

function createLimitReachedError(): UsageLimitError {
  const error = new Error("You have reached your monthly limit.") as UsageLimitError;
  error.statusCode = 429;
  error.code = "LIMIT_REACHED";
  return error;
}

export async function reserveUsageIdempotent(
  db: Database,
  input: {
    userId: string;
    requestId: string;
    threadId: string;
    tier: "seeker" | "initiate";
    window: UsageWindow;
  },
): Promise<MemberUsageSummary & { counted: boolean }> {
  const limit = TIER_CONFIG[input.tier].promptLimit;
  if (limit === null) {
    const summary = await getMemberUsageSummary(db, {
      userId: input.userId,
      tier: input.tier,
      window: input.window,
    });
    return {
      ...summary,
      counted: false,
    };
  }

  return db.transaction(async (tx) => {
    await tx
      .insert(memberUsage)
      .values({
        user_id: input.userId,
        period_start: input.window.periodStart,
        period_end: input.window.periodEnd,
        prompts_used: 0,
      })
      .onConflictDoNothing({
        target: [memberUsage.user_id, memberUsage.period_start, memberUsage.period_end],
      });

    const lockedUsage = await tx.execute(sql<{ prompts_used: number }>`
      SELECT prompts_used
      FROM member_usage
      WHERE user_id = ${input.userId}
        AND period_start = ${input.window.periodStart}
        AND period_end = ${input.window.periodEnd}
      FOR UPDATE
    `);
    const currentUsed = Number(lockedUsage.rows[0]?.prompts_used ?? 0);

    const [existingEvent] = await tx
      .select({ id: memberUsageEvents.id })
      .from(memberUsageEvents)
      .where(and(
        eq(memberUsageEvents.user_id, input.userId),
        eq(memberUsageEvents.request_id, input.requestId),
      ))
      .limit(1);
    if (existingEvent) {
      return {
        used: currentUsed,
        limit,
        periodStart: input.window.periodStart.toISOString(),
        periodEnd: input.window.periodEnd.toISOString(),
        counted: false,
      };
    }

    if (currentUsed >= limit) {
      throw createLimitReachedError();
    }

    await tx
      .insert(memberUsageEvents)
      .values({
        user_id: input.userId,
        request_id: input.requestId,
        thread_id: input.threadId,
        period_start: input.window.periodStart,
        period_end: input.window.periodEnd,
      })
      .onConflictDoNothing({
        target: [memberUsageEvents.user_id, memberUsageEvents.request_id],
      });

    await tx
      .update(memberUsage)
      .set({
        prompts_used: sql`${memberUsage.prompts_used} + 1`,
        updated_at: new Date(),
      })
      .where(and(
        eq(memberUsage.user_id, input.userId),
        eq(memberUsage.period_start, input.window.periodStart),
        eq(memberUsage.period_end, input.window.periodEnd),
      ));

    return {
      used: currentUsed + 1,
      limit,
      periodStart: input.window.periodStart.toISOString(),
      periodEnd: input.window.periodEnd.toISOString(),
      counted: true,
    };
  });
}

export async function releaseUsageReservation(
  db: Database,
  input: {
    userId: string;
    requestId: string;
    window: UsageWindow;
    tier: "seeker" | "initiate";
  },
): Promise<MemberUsageSummary> {
  const limit = TIER_CONFIG[input.tier].promptLimit;
  if (limit === null) {
    return getMemberUsageSummary(db, {
      userId: input.userId,
      tier: input.tier,
      window: input.window,
    });
  }

  return db.transaction(async (tx) => {
    const [deletedEvent] = await tx
      .delete(memberUsageEvents)
      .where(and(
        eq(memberUsageEvents.user_id, input.userId),
        eq(memberUsageEvents.request_id, input.requestId),
        eq(memberUsageEvents.period_start, input.window.periodStart),
        eq(memberUsageEvents.period_end, input.window.periodEnd),
      ))
      .returning({ id: memberUsageEvents.id });

    if (deletedEvent) {
      await tx
        .update(memberUsage)
        .set({
          prompts_used: sql`GREATEST(${memberUsage.prompts_used} - 1, 0)`,
          updated_at: new Date(),
        })
        .where(and(
          eq(memberUsage.user_id, input.userId),
          eq(memberUsage.period_start, input.window.periodStart),
          eq(memberUsage.period_end, input.window.periodEnd),
        ));
    }

    const [usageRow] = await tx
      .select()
      .from(memberUsage)
      .where(and(
        eq(memberUsage.user_id, input.userId),
        eq(memberUsage.period_start, input.window.periodStart),
        eq(memberUsage.period_end, input.window.periodEnd),
      ))
      .limit(1);

    return {
      used: usageRow?.prompts_used ?? 0,
      limit,
      periodStart: input.window.periodStart.toISOString(),
      periodEnd: input.window.periodEnd.toISOString(),
    };
  });
}

export function buildMemberProfileForAccess(input: {
  userId: string;
  tier: "seeker" | "initiate";
  billingInterval: "monthly" | "annual";
  usage: { used: number; window: UsageWindow };
}): Divin8MemberProfile {
  return {
    id: input.userId,
    tier: input.tier,
    billingInterval: input.billingInterval,
    usage: {
      promptsUsed: input.usage.used,
      periodStart: input.usage.window.periodStart.toISOString(),
      periodEnd: input.usage.window.periodEnd.toISOString(),
    },
  };
}

export function evaluateAccess(member: Divin8MemberProfile) {
  return getDivin8Access(member);
}

export async function getUsageByWindow(db: Database, userId: string, window: UsageWindow) {
  const [usageRow] = await db
    .select()
    .from(memberUsage)
    .where(and(
      eq(memberUsage.user_id, userId),
      gte(memberUsage.period_start, window.periodStart),
      lte(memberUsage.period_end, window.periodEnd),
    ))
    .limit(1);

  return usageRow ?? null;
}
