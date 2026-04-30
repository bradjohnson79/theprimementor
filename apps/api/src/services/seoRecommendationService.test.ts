import assert from "node:assert/strict";
import test from "node:test";
import { __seoRecommendationTestUtils } from "./seoRecommendationService.js";

test("mapIssueTypeToField maps deterministic issues to reviewable SEO fields", () => {
  assert.equal(__seoRecommendationTestUtils.mapIssueTypeToField("missing_title"), "title");
  assert.equal(__seoRecommendationTestUtils.mapIssueTypeToField("missing_meta_description"), "meta_description");
  assert.equal(__seoRecommendationTestUtils.mapIssueTypeToField("missing_primary_keywords"), "keywords");
  assert.equal(__seoRecommendationTestUtils.mapIssueTypeToField("missing_og_image"), "og_image");
  assert.equal(__seoRecommendationTestUtils.mapIssueTypeToField("noindex_blocked"), "indexing");
});

test("parseRecommendationPayload accepts structured keyword recommendations", () => {
  const parsed = __seoRecommendationTestUtils.parseRecommendationPayload("keywords", {
    field: "keywords",
    suggestedValue: {
      primary: ["prime mentor sessions"],
      secondary: ["clarity session", "spiritual mentorship"],
    },
    reasoning: "Expands keyword coverage without stuffing.",
    confidenceScore: 87,
    expectedImpact: "better keyword alignment",
    action: "update",
  });

  assert.deepEqual(parsed.suggestedValue, {
    primary: ["prime mentor sessions"],
    secondary: ["clarity session", "spiritual mentorship"],
  });
  assert.equal(parsed.confidenceScore, 87);
  assert.equal(parsed.action, "update");
});

test("parseRecommendationPayload rejects mismatched field output", () => {
  assert.throws(
    () => __seoRecommendationTestUtils.parseRecommendationPayload("title", {
      field: "meta_description",
      suggestedValue: "Prime Mentor Sessions",
      reasoning: "Wrong field",
      confidenceScore: 70,
      expectedImpact: "higher CTR",
      action: "update",
    }),
    /mismatched field/,
  );
});
