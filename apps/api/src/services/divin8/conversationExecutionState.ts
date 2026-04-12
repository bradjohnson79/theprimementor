import type { StoredDivin8SessionState } from "./divin8Orchestrator.js";

export interface ThreadExecutionDecision {
  action: "claim" | "reject" | "recover";
  activeExecution: NonNullable<StoredDivin8SessionState["activeExecution"]> | null;
}

export interface PendingExecutionArtifacts {
  activeExecution: NonNullable<StoredDivin8SessionState["activeExecution"]>;
  pendingMessageMeta: {
    status: "pending";
    requestId: string;
    lockedAt: string;
    expiresAt: string;
  };
}

export function resolveThreadExecutionDecision(
  storedState: StoredDivin8SessionState | null | undefined,
  now: Date,
): ThreadExecutionDecision {
  const activeExecution = storedState?.activeExecution ?? null;
  if (!activeExecution || activeExecution.status !== "pending") {
    return {
      action: "claim",
      activeExecution: null,
    };
  }

  if (new Date(activeExecution.expiresAt).getTime() <= now.getTime()) {
    return {
      action: "recover",
      activeExecution,
    };
  }

  return {
    action: "reject",
    activeExecution,
  };
}

export function createPendingExecutionArtifacts(input: {
  requestId: string;
  actorRole: string;
  lockedAt: Date;
  expiresAt: Date;
  pendingMessageId: string;
}): PendingExecutionArtifacts {
  const lockedAtIso = input.lockedAt.toISOString();
  const expiresAtIso = input.expiresAt.toISOString();
  return {
    activeExecution: {
      requestId: input.requestId,
      status: "pending",
      actorRole: input.actorRole,
      lockedAt: lockedAtIso,
      expiresAt: expiresAtIso,
      pendingMessageId: input.pendingMessageId,
    },
    pendingMessageMeta: {
      status: "pending",
      requestId: input.requestId,
      lockedAt: lockedAtIso,
      expiresAt: expiresAtIso,
    },
  };
}
