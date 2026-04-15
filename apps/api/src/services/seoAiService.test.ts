import assert from "node:assert/strict";
import test from "node:test";
import type { SeoRecommendationSnapshot } from "@wisdom/db";
import { __seoAiTestUtils } from "./seoAiService.js";

const CURRENT_SNAPSHOT: SeoRecommendationSnapshot = {
  title: "Current Title",
  metaDescription: "Current description",
  keywords: {
    primary: ["prime mentor"],
    secondary: ["spiritual mentorship"],
  },
  ogImage: null,
  robotsIndex: true,
};

test("parseInitialSeoResponse normalizes structured JSON safely", () => {
  const parsed = __seoAiTestUtils.parseInitialSeoResponse({
    title: " Prime Mentor Sessions for Clarity ",
    meta_description: " Grounded insight and transformational support for aligned next steps. ",
    keywords: {
      primary: ["prime mentor", "clarity session"],
      secondary: ["spiritual mentorship", "transformational guidance", "clarity session"],
    },
    intent: "transactional",
    confidence: 0.92,
  });

  assert.equal(parsed.title, "Prime Mentor Sessions for Clarity");
  assert.equal(parsed.metaDescription, "Grounded insight and transformational support for aligned next steps.");
  assert.deepEqual(parsed.keywords.secondary, ["spiritual mentorship", "transformational guidance", "clarity session"]);
  assert.equal(parsed.intent, "transactional");
  assert.equal(parsed.confidence, 0.92);
});

test("parseWeeklySeoResponse handles explicit no_change safely", () => {
  const parsed = __seoAiTestUtils.parseWeeklySeoResponse(
    {
      recommendations: [
        { type: "no_change" },
      ],
    },
    CURRENT_SNAPSHOT,
  );

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.type, "no_change");
  assert.deepEqual(parsed[0]?.suggestedSnapshot, CURRENT_SNAPSHOT);
});

test("parseWeeklySeoResponse rejects malformed recommendation JSON", () => {
  assert.throws(
    () => __seoAiTestUtils.parseWeeklySeoResponse(
      {
        recommendations: [
          {
            type: "title_update",
            reason: "Improve clarity",
            current: { title: "Current", meta_description: "Current description" },
            suggested: { title: "Suggested title" },
            impact: "high",
            confidence: 0.8,
          },
        ],
      },
      CURRENT_SNAPSHOT,
    ),
    /suggested\.meta_description/,
  );
});

test("buildRecommendationHash stays stable for duplicate recommendation payloads", () => {
  const input = {
    pageKey: "home" as const,
    type: "title_update" as const,
    source: "weekly_optimization" as const,
    reason: "Improve click-through rate",
    suggestedSnapshot: CURRENT_SNAPSHOT,
  };

  const left = __seoAiTestUtils.buildRecommendationHash(input);
  const right = __seoAiTestUtils.buildRecommendationHash(input);

  assert.equal(left, right);
});

test("isSeoRecommendationCoolingDown enforces the 7 day guardrail", () => {
  const now = new Date("2026-04-14T00:00:00.000Z").getTime();
  assert.equal(
    __seoAiTestUtils.isSeoRecommendationCoolingDown(new Date("2026-04-10T00:00:00.000Z"), now),
    true,
  );
  assert.equal(
    __seoAiTestUtils.isSeoRecommendationCoolingDown(new Date("2026-04-01T00:00:00.000Z"), now),
    false,
  );
});

test("classifyPerformance locks high performers and flags low performers", () => {
  assert.equal(__seoAiTestUtils.classifyPerformance(120, 4, "up"), "high");
  assert.equal(__seoAiTestUtils.classifyPerformance(8, 0, "down"), "low");
  assert.equal(__seoAiTestUtils.classifyPerformance(28, 1, "stable"), "medium");
});
