import test from "node:test";
import assert from "node:assert/strict";
import {
  distillDivin8MemoryCandidates,
  rankRetrievedMemories,
} from "./memoryService.js";

test("distillDivin8MemoryCandidates skips low-signal chat turns", () => {
  assert.deepEqual(distillDivin8MemoryCandidates({
    userMessage: "How are you today?",
  }), []);
});

test("distillDivin8MemoryCandidates stores typed distilled memory only", () => {
  const memories = distillDivin8MemoryCandidates({
    userMessage: "I prefer Vedic readings. Use @Canada for this timeline.",
    conversationSummary: "April points to a pressure window around the third week, followed by stabilization.",
    profileTags: ["@Canada"],
    timeline: {
      tag: "#April1-30-2026",
      system: "vedic",
      startDate: "2026-04-01",
      endDate: "2026-04-30",
    },
    engineUsed: true,
  });

  assert.deepEqual(memories.map((memory) => memory.type), [
    "preference",
    "fact",
    "pattern",
    "past_reading",
  ]);
  assert.match(memories[0]!.content, /prefers Vedic astrology/i);
  assert.match(memories[1]!.content, /@Canada/);
  assert.match(memories[2]!.content, /timeline forecasting/i);
  assert.match(memories[3]!.content, /Recent reading outcome:/);
  assert.ok(memories.every((memory) => !memory.content.includes("Use @Canada for this timeline")));
});

test("rankRetrievedMemories caps results, excludes deleted conversations, and newer preference wins", () => {
  const ranked = rankRetrievedMemories([
    {
      id: "pref-old",
      conversationId: "conv-1",
      userId: "user-1",
      type: "preference",
      content: "User prefers Western astrology.",
      relevanceScore: 0.9,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      conversationArchived: false,
    },
    {
      id: "pref-new",
      conversationId: "conv-2",
      userId: "user-1",
      type: "preference",
      content: "User prefers Vedic astrology.",
      relevanceScore: 0.95,
      createdAt: new Date("2026-04-12T00:00:00.000Z"),
      conversationArchived: false,
    },
    {
      id: "deleted-memory",
      conversationId: "conv-deleted",
      userId: "user-1",
      type: "past_reading",
      content: "Recent reading outcome: deleted thread should never leak.",
      relevanceScore: 1,
      createdAt: new Date("2026-04-13T00:00:00.000Z"),
      conversationArchived: true,
    },
    {
      id: "timeline",
      conversationId: "conv-3",
      userId: "user-1",
      type: "pattern",
      content: "User uses timeline forecasting in Divin8.",
      relevanceScore: 0.8,
      createdAt: new Date("2026-04-11T00:00:00.000Z"),
      conversationArchived: false,
    },
    {
      id: "profile",
      conversationId: "conv-4",
      userId: "user-1",
      type: "fact",
      content: "User uses saved Divin8 profile @Canada.",
      relevanceScore: 0.75,
      createdAt: new Date("2026-04-10T00:00:00.000Z"),
      conversationArchived: false,
    },
    {
      id: "reading-1",
      conversationId: "conv-5",
      userId: "user-1",
      type: "past_reading",
      content: "Recent reading outcome: April pressure peaks mid-month.",
      relevanceScore: 0.88,
      createdAt: new Date("2026-04-09T00:00:00.000Z"),
      conversationArchived: false,
    },
    {
      id: "reading-2",
      conversationId: "conv-6",
      userId: "user-1",
      type: "past_reading",
      content: "Recent reading outcome: March emphasized structural reset.",
      relevanceScore: 0.82,
      createdAt: new Date("2026-04-08T00:00:00.000Z"),
      conversationArchived: false,
    },
    {
      id: "reading-3",
      conversationId: "conv-7",
      userId: "user-1",
      type: "past_reading",
      content: "Recent reading outcome: February showed softer momentum.",
      relevanceScore: 0.76,
      createdAt: new Date("2026-04-07T00:00:00.000Z"),
      conversationArchived: false,
    },
  ], {
    message: "Compare this month to the last reading and remember my preferred system.",
    limit: 5,
    now: new Date("2026-04-14T00:00:00.000Z"),
  });

  assert.equal(ranked.length, 5);
  assert.equal(ranked.filter((memory) => memory.type === "preference").length, 1);
  assert.match(ranked.find((memory) => memory.type === "preference")!.content, /Vedic astrology/i);
  assert.ok(ranked.every((memory) => memory.conversationId !== "conv-deleted"));
});
