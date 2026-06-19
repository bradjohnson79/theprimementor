export interface ConversationSelectionThread {
  id: string;
}

export interface ResolveNextSelectedThreadInput {
  requestedThreadId?: string | null;
  activeThreadId?: string | null;
  deletedThreadId?: string | null;
  remainingThreads: ConversationSelectionThread[];
  isInitialBootstrap: boolean;
  requestedThreadInvalid?: boolean;
}

export function resolveNextSelectedThread(input: ResolveNextSelectedThreadInput) {
  if (input.deletedThreadId && input.deletedThreadId !== input.activeThreadId) {
    return input.activeThreadId ?? null;
  }

  if (input.requestedThreadId && !input.requestedThreadInvalid && input.deletedThreadId !== input.requestedThreadId) {
    return input.requestedThreadId;
  }

  if (input.requestedThreadInvalid || input.deletedThreadId === input.activeThreadId || input.isInitialBootstrap) {
    return input.remainingThreads[0]?.id ?? null;
  }

  return input.activeThreadId ?? null;
}
