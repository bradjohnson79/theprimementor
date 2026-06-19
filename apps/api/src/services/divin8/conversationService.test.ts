import assert from "node:assert/strict";
import test from "node:test";
import { conversationMessages, conversationThreads, conversationTimelineEvents, type Database } from "@wisdom/db";
import {
  deleteConversationThread,
  getConversationDetail,
  listConversationThreads,
} from "./conversationService.js";

type ThreadRow = typeof conversationThreads.$inferSelect;
type MessageRow = typeof conversationMessages.$inferSelect;
type TimelineRow = typeof conversationTimelineEvents.$inferSelect;

function collectParamValues(value: unknown): unknown[] {
  if (!value || typeof value !== "object") return [];
  if ("value" in value && "encoder" in value) {
    return [(value as { value: unknown }).value];
  }
  const chunks = (value as { queryChunks?: unknown[] }).queryChunks;
  if (!Array.isArray(chunks)) return [];
  return chunks.flatMap(collectParamValues);
}

function createThread(input: Partial<ThreadRow> & { id: string; user_id: string }): ThreadRow {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: input.id,
    user_id: input.user_id,
    title: input.title ?? `Thread ${input.id}`,
    is_archived: input.is_archived ?? false,
    summary: input.summary ?? null,
    search_text: input.search_text ?? null,
    meta: input.meta ?? {},
    created_at: input.created_at ?? now,
    updated_at: input.updated_at ?? now,
  };
}

function createMessage(input: Partial<MessageRow> & { id: string; thread_id: string; content: string }): MessageRow {
  return {
    id: input.id,
    thread_id: input.thread_id,
    role: input.role ?? "user",
    content: input.content,
    meta: input.meta ?? null,
    created_at: input.created_at ?? new Date("2026-01-01T00:00:00.000Z"),
  };
}

function createFakeDb(input: {
  threads: ThreadRow[];
  messages?: MessageRow[];
  timeline?: TimelineRow[];
}) {
  const state = {
    threads: [...input.threads],
    messages: [...(input.messages ?? [])],
    timeline: [...(input.timeline ?? [])],
  };

  function selectRows(table: unknown, params: unknown[]) {
    if (table === conversationThreads) {
      const [threadIdOrUserId, userIdOrArchived, archivedMaybe] = params;
      if (typeof archivedMaybe === "boolean") {
        return state.threads.filter((thread) => (
          thread.id === threadIdOrUserId
          && thread.user_id === userIdOrArchived
          && thread.is_archived === archivedMaybe
        ));
      }
      return state.threads
        .filter((thread) => thread.user_id === threadIdOrUserId && thread.is_archived === userIdOrArchived)
        .sort((left, right) => (
          (right.updated_at?.getTime() ?? 0) - (left.updated_at?.getTime() ?? 0)
          || right.created_at.getTime() - left.created_at.getTime()
        ));
    }

    if (table === conversationMessages) {
      if (params.length === 3) {
        const [userId, role, createdAfter] = params;
        const threadIdsForUser = new Set(state.threads
          .filter((thread) => thread.user_id === userId)
          .map((thread) => thread.id));
        return [{
          count: state.messages.filter((message) => (
            threadIdsForUser.has(message.thread_id)
            && message.role === role
            && message.created_at >= (createdAfter as Date)
          )).length,
        }];
      }
      const threadId = Array.isArray(params[0]) ? null : params[0];
      const threadIds = Array.isArray(params[0]) ? params[0] as string[] : null;
      return state.messages
        .filter((message) => threadIds ? threadIds.includes(message.thread_id) : message.thread_id === threadId)
        .sort((left, right) => left.created_at.getTime() - right.created_at.getTime());
    }

    if (table === conversationTimelineEvents) {
      const [threadId, userId] = params;
      return state.timeline.filter((event) => event.thread_id === threadId && event.user_id === userId);
    }

    return [];
  }

  return {
    state,
    db: {
      select() {
        let table: unknown = null;
        let params: unknown[] = [];
        const builder = {
          from(nextTable: unknown) {
            table = nextTable;
            return builder;
          },
          where(clause: unknown) {
            params = collectParamValues(clause);
            return builder;
          },
          orderBy() {
            return builder;
          },
          innerJoin() {
            return builder;
          },
          limit(limit: number) {
            return Promise.resolve(selectRows(table, params).slice(0, limit));
          },
          then(resolve: (value: unknown[]) => void, reject: (reason?: unknown) => void) {
            return Promise.resolve(selectRows(table, params)).then(resolve, reject);
          },
        };
        return builder;
      },
      delete(table: unknown) {
        return {
          where(clause: unknown) {
            const params = collectParamValues(clause);
            if (table === conversationThreads) {
              const [threadId, userId, isArchived] = params;
              state.threads = state.threads.filter((thread) => !(
                thread.id === threadId
                && thread.user_id === userId
                && thread.is_archived === isArchived
              ));
              state.messages = state.messages.filter((message) => message.thread_id !== threadId);
              state.timeline = state.timeline.filter((event) => event.thread_id !== threadId);
            }
            return Promise.resolve();
          },
        };
      },
    } as unknown as Database,
  };
}

test("getConversationDetail returns the exact requested conversation", async () => {
  const { db } = createFakeDb({
    threads: [
      createThread({ id: "latest", user_id: "user-1", updated_at: new Date("2026-01-02T00:00:00.000Z") }),
      createThread({ id: "older", user_id: "user-1", updated_at: new Date("2026-01-01T00:00:00.000Z") }),
    ],
    messages: [
      createMessage({ id: "message-latest", thread_id: "latest", content: "latest content" }),
      createMessage({ id: "message-older", thread_id: "older", content: "older content" }),
    ],
  });

  const detail = await getConversationDetail(db, "older", "user-1");

  assert.equal(detail.thread.id, "older");
  assert.deepEqual(detail.messages.map((message) => message.id), ["message-older"]);
});

test("getConversationDetail does not return latest for deleted conversation", async () => {
  const { db } = createFakeDb({
    threads: [
      createThread({ id: "latest", user_id: "user-1", updated_at: new Date("2026-01-02T00:00:00.000Z") }),
      createThread({ id: "deleted", user_id: "user-1", is_archived: true }),
    ],
  });

  await assert.rejects(
    () => getConversationDetail(db, "deleted", "user-1"),
    /Conversation not found/,
  );
});

test("getConversationDetail does not return latest for another user's conversation", async () => {
  const { db } = createFakeDb({
    threads: [
      createThread({ id: "latest", user_id: "user-1", updated_at: new Date("2026-01-02T00:00:00.000Z") }),
      createThread({ id: "other-user-thread", user_id: "user-2" }),
    ],
  });

  await assert.rejects(
    () => getConversationDetail(db, "other-user-thread", "user-1"),
    /Conversation not found/,
  );
});

test("deleting empty conversations leaves remaining conversations loadable and listable", async () => {
  const { db, state } = createFakeDb({
    threads: [
      createThread({ id: "thread-a", user_id: "user-1", updated_at: new Date("2026-01-03T00:00:00.000Z") }),
      createThread({ id: "thread-b", user_id: "user-1", updated_at: new Date("2026-01-02T00:00:00.000Z") }),
      createThread({ id: "empty-c", user_id: "user-1", updated_at: new Date("2026-01-01T00:00:00.000Z") }),
    ],
    messages: [
      createMessage({ id: "message-a", thread_id: "thread-a", content: "A" }),
      createMessage({ id: "message-b", thread_id: "thread-b", content: "B" }),
    ],
  });

  await deleteConversationThread(db, "empty-c", "user-1");

  assert.deepEqual(state.threads.map((thread) => thread.id), ["thread-a", "thread-b"]);
  assert.equal((await getConversationDetail(db, "thread-a", "user-1")).thread.id, "thread-a");
  assert.equal((await getConversationDetail(db, "thread-b", "user-1")).thread.id, "thread-b");
  assert.deepEqual((await listConversationThreads(db, "user-1", "admin")).threads.map((thread) => thread.id), ["thread-a", "thread-b"]);
});
