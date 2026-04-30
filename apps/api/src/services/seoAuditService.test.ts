import assert from "node:assert/strict";
import test from "node:test";
import { calculateSeoHealthScore } from "./seoAuditService.js";

test("calculateSeoHealthScore weights metadata, keywords, duplicates, and indexing", () => {
  const score = calculateSeoHealthScore({
    pages: [
      {
        hasTitle: true,
        hasDescription: true,
        hasPrimaryKeyword: true,
        hasOgImage: true,
        robotsIndex: true,
        titleHasPrimaryKeyword: true,
        descriptionOrContentHasPrimaryKeyword: true,
        hasSecondaryKeywords: true,
      },
      {
        hasTitle: true,
        hasDescription: false,
        hasPrimaryKeyword: true,
        hasOgImage: false,
        robotsIndex: false,
        titleHasPrimaryKeyword: false,
        descriptionOrContentHasPrimaryKeyword: false,
        hasSecondaryKeywords: false,
      },
    ],
    duplicateTitlePages: 2,
    duplicateDescriptionPages: 0,
  });

  assert.equal(score.metadataCompletenessScore, 67);
  assert.equal(score.keywordAlignmentScore, 63);
  assert.equal(score.duplicateAvoidanceScore, 50);
  assert.equal(score.indexingReadinessScore, 50);
  assert.equal(score.total, 59);
});
