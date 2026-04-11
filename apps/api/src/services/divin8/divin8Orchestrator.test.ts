import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConversationSummary,
  decideNextAction,
  extractDivin8Observations,
  hydrateConversationMemory,
  mergeConversationMemory,
  type Divin8ConversationMemory,
  type Divin8ExtractionResult,
} from "./divin8Orchestrator.js";
import type { Divin8RoutingPlan } from "./divin8RoutingTypes.js";
import { selectTimelineHighlights, type Divin8TimelineEvent } from "./insightService.js";
import { createDeprecatedDivin8ChatError, runDivin8Chat } from "./chatService.js";

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-placeholder";

function makeExtraction(overrides: Partial<Divin8ExtractionResult> = {}): Divin8ExtractionResult {
  return {
    rawText: "Need a reading",
    detectedSystems: [],
    extractedEntities: {
      fullName: null,
      birthDate: null,
      birthTime: null,
      birthLocation: null,
      timezone: null,
      themes: [],
      timeWindow: null,
      ...(overrides.extractedEntities ?? {}),
    },
    intentHints: {
      summary: "Need a reading",
      wantsComparison: false,
      wantsForecast: false,
      explicitMultiSystem: false,
      correction: false,
      ...(overrides.intentHints ?? {}),
    },
    ...overrides,
  };
}

function makeTimelineEvent(overrides: Partial<Divin8TimelineEvent> = {}): Divin8TimelineEvent {
  return {
    id: "evt-1",
    threadId: "thread-1",
    userId: "user-1",
    summary: "Generic continuity event.",
    systemsUsed: [],
    tags: [],
    type: "input",
    createdAt: "2026-03-28T00:00:00.000Z",
    ...overrides,
  };
}

test("memory persistence keeps known birth data and does not ask again", async () => {
  const baseMemory = hydrateConversationMemory();
  const mergedMemory = mergeConversationMemory(baseMemory, makeExtraction({
    extractedEntities: {
      fullName: "Jane Example",
      birthDate: "1990-04-03",
      birthTime: "06:45",
      birthLocation: "Vancouver, Canada",
      timezone: "UTC-7",
      themes: ["finance"],
      timeWindow: null,
    },
  }), "en");

  const followup = makeExtraction({
    rawText: "Can you go deeper into my finance patterns?",
    intentHints: {
      summary: "Need a finance followup",
      wantsComparison: false,
      wantsForecast: false,
      explicitMultiSystem: false,
      correction: false,
    },
    detectedSystems: [{ key: "vedic_astrology", matchedKeywords: ["vedic"], score: 12 }],
    extractedEntities: {
      fullName: null,
      birthDate: null,
      birthTime: null,
      birthLocation: null,
      timezone: null,
      themes: ["finance"],
      timeWindow: null,
    },
  });
  const followupMemory = mergeConversationMemory(mergedMemory, followup, "en");
  const routingPlan = decideNextAction({
    memory: followupMemory,
    detectedSystems: followup.detectedSystems,
    extracted: followup,
    hasImage: false,
  });

  assert.equal(followupMemory.knownProfile.birthDate.value, "1990-04-03");
  assert.equal(followupMemory.knownProfile.birthLocation.value, "Vancouver, Canada");
  assert.deepEqual(routingPlan.missingFields, []);
  assert.equal(routingPlan.needsEngine, true);
});

test("incremental updates prefer explicit later birth time", async () => {
  const baseMemory = mergeConversationMemory(hydrateConversationMemory(), makeExtraction({
    extractedEntities: {
      fullName: "Jane Example",
      birthDate: "1990-04-03",
      birthTime: null,
      birthLocation: "Vancouver, Canada",
      timezone: null,
      themes: [],
      timeWindow: null,
    },
  }), "en");

  const updated = mergeConversationMemory(baseMemory, makeExtraction({
    rawText: "Correction: my birth time was 7:12 am",
    intentHints: {
      summary: "Correct birth time",
      wantsComparison: false,
      wantsForecast: false,
      explicitMultiSystem: false,
      correction: true,
    },
    extractedEntities: {
      fullName: null,
      birthDate: null,
      birthTime: "07:12",
      birthLocation: null,
      timezone: null,
      themes: [],
      timeWindow: null,
    },
  }), "en");

  assert.equal(updated.knownProfile.birthTime.value, "07:12");
  assert.equal(updated.knownProfile.birthTime.source, "explicit_user");
});

test("system routing runs only vedic astrology for a vedic request", async () => {
  const extracted = await extractDivin8Observations("Please do a vedic astrology reading for me.");
  const memory = mergeConversationMemory(hydrateConversationMemory(), makeExtraction({
    extractedEntities: {
      fullName: "Jane Example",
      birthDate: "1990-04-03",
      birthTime: "06:45",
      birthLocation: "Vancouver, Canada",
      timezone: null,
      themes: [],
      timeWindow: null,
    },
  }), "en");
  const routingPlan = decideNextAction({
    memory,
    detectedSystems: extracted.detectedSystems,
    extracted,
    hasImage: false,
  });

  assert.deepEqual(routingPlan.systemsToRun, ["astrology"]);
  assert.equal(routingPlan.needsEngine, true);
});

test("messy natural input still extracts core birth data", async () => {
  const extracted = await extractDivin8Observations(
    "Hi, I want a vedic astrology reading for money. My name is Sarah Connor. I was born April 3, 1990 at 6:45 am in Vancouver, Canada",
  );

  assert.equal(extracted.extractedEntities.birthDate, "1990-04-03");
  assert.equal(extracted.extractedEntities.birthTime, "06:45");
  assert.equal(extracted.extractedEntities.birthLocation, "Vancouver, Canada");
  assert.equal(extracted.detectedSystems[0]?.key, "vedic_astrology");
  assert.ok(extracted.extractedEntities.themes.includes("finance"));
});

test("general conversation stays in chat mode without engine", () => {
  const extracted = makeExtraction({
    rawText: "How can I stay grounded this week?",
    intentHints: {
      summary: "Grounding guidance",
      wantsComparison: false,
      wantsForecast: false,
      explicitMultiSystem: false,
      correction: false,
    },
  });
  const routingPlan = decideNextAction({
    memory: hydrateConversationMemory(),
    detectedSystems: [],
    extracted,
    hasImage: false,
  });

  assert.equal(routingPlan.needsEngine, false);
  assert.equal(routingPlan.responseMode, "chat");
  assert.deepEqual(routingPlan.systemsToRun, []);
});

test("unsupported western astrology does not partially map to engine", () => {
  const extracted = makeExtraction({
    rawText: "Can you do western astrology for me?",
    detectedSystems: [{ key: "western_astrology", matchedKeywords: ["western astrology"], score: 20 }],
  });
  const routingPlan = decideNextAction({
    memory: hydrateConversationMemory(),
    detectedSystems: extracted.detectedSystems,
    extracted,
    hasImage: false,
  });

  assert.equal(routingPlan.needsEngine, false);
  assert.deepEqual(routingPlan.systemsToRun, []);
  assert.ok(routingPlan.clarificationPrompt?.includes("Vedic/sidereal"));
});

test("timeline highlights prioritize confirmed profile facts over generic recency", () => {
  const highlights = selectTimelineHighlights({
    events: [
      makeTimelineEvent({
        id: "evt-new",
        summary: "General encouragement about patience.",
        createdAt: "2026-03-28T09:00:00.000Z",
      }),
      makeTimelineEvent({
        id: "evt-engine",
        summary: "Astrology engine highlighted strong creative momentum for April 2026.",
        systemsUsed: ["astrology"],
        tags: ["creativity", "April 2026"],
        type: "engine",
        createdAt: "2026-03-28T08:00:00.000Z",
      }),
    ],
    knownProfileFacts: ["Confirmed profile fact: birth date is 1990-04-03."],
    systems: ["astrology"],
    themes: ["creativity"],
    timeWindow: "April 2026",
    limit: 3,
  });

  assert.equal(highlights[0], "Confirmed profile fact: birth date is 1990-04-03.");
  assert.ok(highlights.some((item) => item.includes("April 2026")));
});

test("conversation summary is deterministic and bounded", () => {
  const memory = hydrateConversationMemory() as Divin8ConversationMemory;
  memory.knownProfile.birthDate.value = "1990-04-03";
  memory.knownProfile.birthLocation.value = "Vancouver, Canada";
  const summary = buildConversationSummary({
    previousSummary: null,
    extracted: makeExtraction({
      intentHints: {
        summary: "Vedic astrology reading for career timing",
        wantsComparison: false,
        wantsForecast: true,
        explicitMultiSystem: false,
        correction: false,
      },
    }),
    routingPlan: {
      needsEngine: true,
      missingFields: [],
      systemsToRun: ["astrology"],
      responseMode: "engine",
      conversationState: "interpreting",
      routingNotes: [],
    } satisfies Divin8RoutingPlan,
    responseText: "Here is the reading.",
    memory,
  });

  assert.ok(summary.includes("Current focus"));
  assert.ok(summary.includes("Confirmed profile context"));
  assert.ok(summary.split(".").filter((part) => part.trim()).length <= 3);
});

test("deprecated chat path throws a loud 410 error", async () => {
  const deprecated = createDeprecatedDivin8ChatError();
  assert.equal((deprecated as Error & { statusCode?: number }).statusCode, 410);

  await assert.rejects(
    () => runDivin8Chat({} as never, "session", {
      message: "hello",
      tier: "seeker",
    }),
    (error: Error & { statusCode?: number }) => {
      assert.equal(error.statusCode, 410);
      assert.match(error.message, /deprecated/i);
      return true;
    },
  );
});
