import test from "node:test";
import assert from "node:assert/strict";
import {
  buildResolvedDivin8SystemPrompt,
  DEFAULT_DIVIN8_STYLE_PROMPT,
  DIVIN8_NON_NEGOTIABLE_SAFETY_LAYER,
} from "./divin8SystemPrompt.js";
import {
  buildStructuredPayload,
  buildConversationSummary,
  decideNextAction,
  extractDivin8Observations,
  hydrateConversationMemory,
  mergeConversationMemory,
  type Divin8ConversationMemory,
  type Divin8ExtractionResult,
} from "./divin8Orchestrator.js";
import { buildSearchExecutionPlan } from "./divin8OrchestrationDecision.js";
import { routeDivin8Request } from "./engine/router.js";
import { clearDivin8PromptOverride, getActiveDivin8Prompt, saveDivin8PromptOverride } from "./promptStore.js";
import { searchWeb } from "./searchWebService.js";
import type { Divin8RoutingPlan } from "./divin8RoutingTypes.js";
import { selectTimelineHighlights, type Divin8TimelineEvent } from "./insightService.js";
import { createDeprecatedDivin8ChatError, runDivin8Chat } from "./chatService.js";
import { buildCurrentTimeContext } from "./timeContextService.js";

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

test("hybrid search plan activates for named astrology request with missing birth inputs", () => {
  const extracted = makeExtraction({
    rawText: "Analyze Elon Musk's chart for me.",
    detectedSystems: [{ key: "vedic_astrology", matchedKeywords: ["chart"], score: 18 }],
    extractedEntities: {
      fullName: "Elon Musk",
      birthDate: null,
      birthTime: null,
      birthLocation: null,
      timezone: null,
      themes: [],
      timeWindow: null,
    },
  });
  const memory = hydrateConversationMemory();
  const routingPlan = decideNextAction({
    memory,
    detectedSystems: extracted.detectedSystems,
    extracted,
    hasImage: false,
  });
  const route = routeDivin8Request({
    message: extracted.rawText,
    detectedSystems: extracted.detectedSystems,
    requestedSystems: routingPlan.systemsToRun,
  });
  const plan = buildSearchExecutionPlan({
    message: extracted.rawText,
    routingPlan,
    route,
    memory,
    extracted,
  });

  assert.equal(plan.queryType, "hybrid");
  assert.equal(plan.shouldSearch, true);
  assert.match(plan.query ?? "", /Elon Musk/);
});

test("interpretive guidance does not trigger web search", () => {
  const extracted = makeExtraction({
    rawText: "What spiritual lesson should I focus on this week?",
    intentHints: {
      summary: "Spiritual guidance",
      wantsComparison: false,
      wantsForecast: false,
      explicitMultiSystem: false,
      correction: false,
    },
  });
  const memory = hydrateConversationMemory();
  const routingPlan = decideNextAction({
    memory,
    detectedSystems: extracted.detectedSystems,
    extracted,
    hasImage: false,
  });
  const route = routeDivin8Request({
    message: extracted.rawText,
    detectedSystems: extracted.detectedSystems,
    requestedSystems: routingPlan.systemsToRun,
  });
  const plan = buildSearchExecutionPlan({
    message: extracted.rawText,
    routingPlan,
    route,
    memory,
    extracted,
  });

  assert.equal(plan.shouldSearch, false);
});

test("searchWeb degrades gracefully when provider key is missing", async () => {
  const previousDivin8Key = process.env.DIVIN8_SEARCH_API_KEY;
  const previousTavilyKey = process.env.TAVILY_API_KEY;
  delete process.env.DIVIN8_SEARCH_API_KEY;
  delete process.env.TAVILY_API_KEY;

  try {
    const response = await searchWeb("Elon Musk birth date");
    assert.equal(response.degraded, true);
    assert.equal(response.errorCode, "missing_api_key");
    assert.deepEqual(response.results, []);
  } finally {
    if (previousDivin8Key === undefined) {
      delete process.env.DIVIN8_SEARCH_API_KEY;
    } else {
      process.env.DIVIN8_SEARCH_API_KEY = previousDivin8Key;
    }
    if (previousTavilyKey === undefined) {
      delete process.env.TAVILY_API_KEY;
    } else {
      process.env.TAVILY_API_KEY = previousTavilyKey;
    }
  }
});

test("prompt overrides preserve the non-negotiable safety layer", async () => {
  const original = await getActiveDivin8Prompt();

  try {
    const saved = await saveDivin8PromptOverride("You are Divin8 with a sharper tone.");
    assert.equal(saved.prompt, "You are Divin8 with a sharper tone.");
    assert.ok(saved.resolvedPrompt.includes("sharper tone"));
    assert.ok(saved.resolvedPrompt.includes(DIVIN8_NON_NEGOTIABLE_SAFETY_LAYER));

    const rebuilt = buildResolvedDivin8SystemPrompt(saved.prompt);
    assert.equal(rebuilt, saved.resolvedPrompt);
  } finally {
    if (original.hasOverride) {
      await saveDivin8PromptOverride(original.prompt);
    } else {
      await clearDivin8PromptOverride();
    }
  }
});

test("default system prompt reinforces leader mode guidance", () => {
  const prompt = buildResolvedDivin8SystemPrompt(DEFAULT_DIVIN8_STYLE_PROMPT);
  assert.match(prompt, /leading interpretive intelligence/i);
  assert.match(prompt, /turning points/i);
  assert.match(prompt, /current date, current time, and timezone/i);
  assert.match(prompt, /memory mechanics/i);
});

test("structured payload includes authoritative time context and retrieved memory", () => {
  const payload = JSON.parse(buildStructuredPayload({
    message: "Compare this to last month.",
    memory: hydrateConversationMemory(),
    timeContext: buildCurrentTimeContext(
      { profileTimezone: "America/Vancouver" },
      new Date("2026-04-14T21:32:00.000Z"),
    ),
    relevantMemory: [
      {
        id: "mem-1",
        conversationId: "conv-1",
        userId: "user-1",
        type: "preference",
        content: "User prefers Vedic astrology.",
        relevanceScore: 0.92,
        createdAt: "2026-04-10T00:00:00.000Z",
      },
    ],
    extracted: makeExtraction({
      rawText: "Compare this to last month.",
      intentHints: {
        summary: "Compare this to last month",
        wantsComparison: true,
        wantsForecast: false,
        explicitMultiSystem: false,
        correction: false,
      },
    }),
    engineSummary: null,
    profiles: [],
    profileReadings: [],
    webContext: null,
    timelineHighlights: [],
    responseMode: "chat",
    execDecision: {
      action: "proceed",
      confidence: 0.9,
      missingFields: [],
      uncertainFields: [],
      toolRequired: false,
      toolType: "none",
    },
    readingState: {
      currentSection: "overview",
      completedSections: [],
    },
    telemetry: {
      usedSwissEph: false,
      usedWebSearch: false,
      searchInputUsed: false,
      queryType: "factual",
    },
  }));

  assert.equal(payload.currentDate, "2026-04-14");
  assert.equal(payload.currentTime, "14:32");
  assert.equal(payload.timezone, "America/Vancouver");
  assert.equal(payload.memory[0].content, "User prefers Vedic astrology.");
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
