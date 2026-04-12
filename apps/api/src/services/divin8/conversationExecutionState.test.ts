import assert from "node:assert/strict";
import test from "node:test";
import {
  createPendingExecutionArtifacts,
  resolveThreadExecutionDecision,
} from "./conversationExecutionState.js";

test("resolveThreadExecutionDecision rejects a second prompt while a thread is still locked", () => {
  const now = new Date("2026-04-11T12:00:00.000Z");
  const decision = resolveThreadExecutionDecision({
    activeExecution: {
      requestId: "req-active",
      status: "pending",
      actorRole: "member",
      lockedAt: "2026-04-11T11:59:00.000Z",
      expiresAt: "2026-04-11T12:01:00.000Z",
      pendingMessageId: "msg-pending",
    },
  }, now);

  assert.equal(decision.action, "reject");
  assert.equal(decision.activeExecution?.requestId, "req-active");
});

test("resolveThreadExecutionDecision recovers expired pending executions", () => {
  const now = new Date("2026-04-11T12:00:00.000Z");
  const decision = resolveThreadExecutionDecision({
    activeExecution: {
      requestId: "req-stale",
      status: "pending",
      actorRole: "admin",
      lockedAt: "2026-04-11T11:57:00.000Z",
      expiresAt: "2026-04-11T11:58:30.000Z",
      pendingMessageId: "msg-stale",
    },
  }, now);

  assert.equal(decision.action, "recover");
  assert.equal(decision.activeExecution?.pendingMessageId, "msg-stale");
});

test("createPendingExecutionArtifacts emits observable lock state and pending metadata", () => {
  const lockedAt = new Date("2026-04-11T12:00:00.000Z");
  const expiresAt = new Date("2026-04-11T12:01:30.000Z");
  const pending = createPendingExecutionArtifacts({
    requestId: "req-123",
    actorRole: "member",
    lockedAt,
    expiresAt,
    pendingMessageId: "msg-123",
  });

  assert.deepEqual(pending, {
    activeExecution: {
      requestId: "req-123",
      status: "pending",
      actorRole: "member",
      lockedAt: "2026-04-11T12:00:00.000Z",
      expiresAt: "2026-04-11T12:01:30.000Z",
      pendingMessageId: "msg-123",
    },
    pendingMessageMeta: {
      status: "pending",
      requestId: "req-123",
      lockedAt: "2026-04-11T12:00:00.000Z",
      expiresAt: "2026-04-11T12:01:30.000Z",
    },
  });
});
