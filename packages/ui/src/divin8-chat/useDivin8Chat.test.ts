import assert from "node:assert/strict";
import test from "node:test";
import { classifyLoadError } from "./useDivin8Chat";

test("classifyLoadError returns a retryable timeout message", () => {
  const error = new Error("Divin8 conversations timed out.") as Error & { code?: string };
  error.code = "DIVIN8_CHAT_TIMEOUT";

  assert.equal(
    classifyLoadError(error),
    "Divin8 chat is taking too long to load. Please retry in a moment.",
  );
});

test("classifyLoadError explains access failures", () => {
  const error = new Error("Forbidden") as Error & { status?: number };
  error.status = 403;

  assert.equal(
    classifyLoadError(error),
    "Your account does not currently have access to Divin8 chat.",
  );
});
