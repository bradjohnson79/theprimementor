import assert from "node:assert/strict";
import test from "node:test";
import { resolveNextSelectedThread } from "./selection";

const threads = [{ id: "latest" }, { id: "older" }, { id: "oldest" }];

test("initial bootstrap selects latest only when no selected thread exists", () => {
  assert.equal(resolveNextSelectedThread({
    remainingThreads: threads,
    isInitialBootstrap: true,
  }), "latest");
});

test("selected thread wins over latest thread", () => {
  assert.equal(resolveNextSelectedThread({
    requestedThreadId: "older",
    activeThreadId: "latest",
    remainingThreads: threads,
    isInitialBootstrap: true,
  }), "older");
});

test("deleting a non-active thread preserves active thread", () => {
  assert.equal(resolveNextSelectedThread({
    activeThreadId: "older",
    deletedThreadId: "oldest",
    remainingThreads: [{ id: "latest" }, { id: "older" }],
    isInitialBootstrap: false,
  }), "older");
});

test("deleting the active thread chooses the next remaining thread", () => {
  assert.equal(resolveNextSelectedThread({
    activeThreadId: "older",
    deletedThreadId: "older",
    remainingThreads: [{ id: "latest" }, { id: "oldest" }],
    isInitialBootstrap: false,
  }), "latest");
});

test("invalid selected thread clears to a fallback once", () => {
  assert.equal(resolveNextSelectedThread({
    requestedThreadId: "deleted",
    activeThreadId: "deleted",
    remainingThreads: [{ id: "latest" }],
    isInitialBootstrap: false,
    requestedThreadInvalid: true,
  }), "latest");
});
