import assert from "node:assert/strict";
import test from "node:test";
import type { SeoReportJson } from "@wisdom/db";
import { __seoReportTestUtils } from "./seoReportService.js";

const REPORT: SeoReportJson = {
  overview: {
    auditId: "audit_123",
    pagesScanned: 7,
    totalIssues: 4,
    healthScore: 74,
    previousScore: 68,
    delta: 6,
    createdAt: "2026-04-29T00:00:00.000Z",
  },
  issuesFound: [
    {
      pageKey: "home",
      severity: "high",
      issueType: "missing_og_image",
      description: "The page is missing an Open Graph image.",
      detectedValue: null,
      recommendedValue: "Add a branded OG image.",
    },
  ],
  recommendations: [
    {
      recommendationId: "rec_123",
      pageKey: "home",
      field: "title",
      currentValue: "Prime Mentor",
      suggestedValue: "Prime Mentor Sessions | Clarity and Transformation",
      editedValue: null,
      reasoning: "Clarifies the page benefit.",
      confidenceScore: 88,
      expectedImpact: "higher CTR",
      status: "pending",
    },
  ],
  actionsTaken: [],
  strategicInsights: ["High-severity issues should be handled first."],
  nextSteps: ["Review pending recommendations."],
};

test("renderSeoReportMarkdown includes the key structured sections", () => {
  const markdown = __seoReportTestUtils.renderSeoReportMarkdown(REPORT);

  assert.match(markdown, /## Overview/);
  assert.match(markdown, /## Issues Found/);
  assert.match(markdown, /## Recommendations/);
  assert.match(markdown, /## Actions Taken/);
  assert.match(markdown, /## Strategic Insights/);
  assert.match(markdown, /## Next Steps/);
  assert.match(markdown, /SEO health score: 74/);
});
