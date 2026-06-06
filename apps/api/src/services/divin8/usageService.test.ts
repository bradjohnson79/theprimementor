import assert from "node:assert/strict";
import test from "node:test";
import { memberUsage, memberUsageEvents, type Database } from "@wisdom/db";
import {
  getMemberUsageSummary,
  releaseUsageReservation,
  reserveUsageIdempotent,
  resolveUsageWindow,
  type UsageWindow,
} from "./usageService.js";

function usageKey(userId: string, window: UsageWindow) {
  return `${userId}:${window.periodStart.toISOString()}:${window.periodEnd.toISOString()}`;
}

function createUsageDb() {
  const usageRows = new Map<string, { user_id: string; period_start: Date; period_end: Date; prompts_used: number }>();
  const events = new Set<string>();
  let activeRequestId = "";
  let activeUserId = "";
  let activeWindow: UsageWindow | null = null;
  let operation: "reserve" | "release" | null = null;

  function ensureUsageRow(userId: string, window: UsageWindow) {
    const key = usageKey(userId, window);
    if (!usageRows.has(key)) {
      usageRows.set(key, {
        user_id: userId,
        period_start: window.periodStart,
        period_end: window.periodEnd,
        prompts_used: 0,
      });
    }
    activeUserId = userId;
    activeWindow = window;
    return usageRows.get(key)!;
  }

  const tx = {
    insert(table: unknown) {
      return {
        values(value: Record<string, unknown>) {
          return {
            onConflictDoNothing() {
              let insertedEventKey: string | null = null;
              if (table === memberUsage) {
                ensureUsageRow(value.user_id as string, {
                  periodStart: value.period_start as Date,
                  periodEnd: value.period_end as Date,
                });
              } else if (table === memberUsageEvents) {
                const requestId = value.request_id as string;
                const eventKey = `${value.user_id as string}:${requestId}`;
                activeRequestId = requestId;
                activeUserId = value.user_id as string;
                activeWindow = {
                  periodStart: value.period_start as Date,
                  periodEnd: value.period_end as Date,
                };
                if (!events.has(eventKey)) {
                  events.add(eventKey);
                  insertedEventKey = eventKey;
                }
              }
              return {
                returning: async () => {
                  if (table !== memberUsageEvents) {
                    return [];
                  }
                  return insertedEventKey ? [{ id: insertedEventKey }] : [];
                },
              };
            },
          };
        },
      };
    },
    execute: async () => {
      const row = activeWindow ? ensureUsageRow(activeUserId, activeWindow) : null;
      return { rows: [{ prompts_used: row?.prompts_used ?? 0 }] };
    },
    select() {
      return {
        from(table: unknown) {
          return {
            where() {
              return {
                limit: async () => {
                  if (table === memberUsageEvents) {
                    const eventKey = `${activeUserId}:${activeRequestId}`;
                    return events.has(eventKey) ? [{ id: eventKey }] : [];
                  }
                  if (table === memberUsage && activeWindow) {
                    return [ensureUsageRow(activeUserId, activeWindow)];
                  }
                  return [];
                },
              };
            },
          };
        },
      };
    },
    update() {
      return {
        set() {
          return {
            where: async () => {
              if (!activeWindow) {
                return;
              }
              const row = ensureUsageRow(activeUserId, activeWindow);
              if (operation === "reserve") {
                row.prompts_used += 1;
              } else if (operation === "release") {
                row.prompts_used = Math.max(0, row.prompts_used - 1);
              }
            },
          };
        },
      };
    },
    delete(table: unknown) {
      return {
        where() {
          return {
            returning: async () => {
              if (table !== memberUsageEvents) {
                return [];
              }
              const eventKey = `${activeUserId}:${activeRequestId}`;
              if (!events.has(eventKey)) {
                return [];
              }
              events.delete(eventKey);
              return [{ id: eventKey }];
            },
          };
        },
      };
    },
  };

  const db = {
    transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
    insert: tx.insert,
    select: tx.select,
  } as unknown as Database;

  return {
    db,
    setContext(input: { userId: string; requestId?: string; window: UsageWindow; operation?: "reserve" | "release" }) {
      activeUserId = input.userId;
      activeRequestId = input.requestId ?? activeRequestId;
      activeWindow = input.window;
      operation = input.operation ?? null;
    },
    setPromptsUsed(userId: string, window: UsageWindow, promptsUsed: number) {
      const row = ensureUsageRow(userId, window);
      row.prompts_used = promptsUsed;
    },
  };
}

test("resolveUsageWindow follows the current Stripe billing cycle", () => {
  const window = resolveUsageWindow({
    userId: "user-1",
    stripeSubscriptionId: "sub_123",
    tier: "seeker",
    billingInterval: "monthly",
    currentPeriodStart: new Date("2026-05-19T01:27:25.000Z"),
    currentPeriodEnd: new Date("2026-06-19T01:27:25.000Z"),
    isSynced: true,
  }, new Date("2026-06-03T16:47:41.000Z"));

  assert.equal(window.periodStart.toISOString(), "2026-05-19T01:27:25.000Z");
  assert.equal(window.periodEnd.toISOString(), "2026-06-19T01:27:25.000Z");
});

test("resolveUsageWindow advances annual subscriptions through monthly sub-windows", () => {
  const window = resolveUsageWindow({
    userId: "user-1",
    stripeSubscriptionId: "sub_annual",
    tier: "seeker",
    billingInterval: "annual",
    currentPeriodStart: new Date("2026-01-15T10:00:00.000Z"),
    currentPeriodEnd: new Date("2027-01-15T10:00:00.000Z"),
    isSynced: true,
  }, new Date("2026-06-06T12:00:00.000Z"));

  assert.equal(window.periodStart.toISOString(), "2026-05-15T10:00:00.000Z");
  assert.equal(window.periodEnd.toISOString(), "2026-06-15T10:00:00.000Z");
});

test("reserveUsageIdempotent allows the 200th seeker prompt and blocks the 201st", async () => {
  const fake = createUsageDb();
  const window = {
    periodStart: new Date("2026-06-01T00:00:00.000Z"),
    periodEnd: new Date("2026-07-01T00:00:00.000Z"),
  };
  fake.setPromptsUsed("user-1", window, 199);
  fake.setContext({ userId: "user-1", requestId: "req-200", window, operation: "reserve" });

  const reserved = await reserveUsageIdempotent(fake.db, {
    userId: "user-1",
    requestId: "req-200",
    threadId: "thread-1",
    tier: "seeker",
    window,
  });

  assert.equal(reserved.used, 200);
  assert.equal(reserved.counted, true);

  fake.setContext({ userId: "user-1", requestId: "req-201", window, operation: "reserve" });
  await assert.rejects(
    () => reserveUsageIdempotent(fake.db, {
      userId: "user-1",
      requestId: "req-201",
      threadId: "thread-1",
      tier: "seeker",
      window,
    }),
    /monthly limit/i,
  );
});

test("reserveUsageIdempotent does not double count retries with the same request id", async () => {
  const fake = createUsageDb();
  const window = {
    periodStart: new Date("2026-06-01T00:00:00.000Z"),
    periodEnd: new Date("2026-07-01T00:00:00.000Z"),
  };
  fake.setContext({ userId: "user-1", requestId: "req-1", window, operation: "reserve" });
  const first = await reserveUsageIdempotent(fake.db, {
    userId: "user-1",
    requestId: "req-1",
    threadId: "thread-1",
    tier: "seeker",
    window,
  });
  fake.setContext({ userId: "user-1", requestId: "req-1", window, operation: "reserve" });
  const second = await reserveUsageIdempotent(fake.db, {
    userId: "user-1",
    requestId: "req-1",
    threadId: "thread-1",
    tier: "seeker",
    window,
  });

  assert.equal(first.used, 1);
  assert.equal(second.used, 1);
  assert.equal(second.counted, false);
});

test("releaseUsageReservation decrements a failed reservation", async () => {
  const fake = createUsageDb();
  const window = {
    periodStart: new Date("2026-06-01T00:00:00.000Z"),
    periodEnd: new Date("2026-07-01T00:00:00.000Z"),
  };
  fake.setContext({ userId: "user-1", requestId: "req-fail", window, operation: "reserve" });
  await reserveUsageIdempotent(fake.db, {
    userId: "user-1",
    requestId: "req-fail",
    threadId: "thread-1",
    tier: "seeker",
    window,
  });

  fake.setContext({ userId: "user-1", requestId: "req-fail", window, operation: "release" });
  const released = await releaseUsageReservation(fake.db, {
    userId: "user-1",
    requestId: "req-fail",
    window,
    tier: "seeker",
  });

  assert.equal(released.used, 0);
});

test("getMemberUsageSummary starts a new billing window at zero", async () => {
  const fake = createUsageDb();
  const oldWindow = {
    periodStart: new Date("2026-05-01T00:00:00.000Z"),
    periodEnd: new Date("2026-06-01T00:00:00.000Z"),
  };
  const newWindow = {
    periodStart: new Date("2026-06-01T00:00:00.000Z"),
    periodEnd: new Date("2026-07-01T00:00:00.000Z"),
  };
  fake.setPromptsUsed("user-1", oldWindow, 200);
  fake.setContext({ userId: "user-1", window: newWindow });

  const summary = await getMemberUsageSummary(fake.db, {
    userId: "user-1",
    tier: "seeker",
    window: newWindow,
  });

  assert.equal(summary.used, 0);
  assert.equal(summary.limit, 200);
});
