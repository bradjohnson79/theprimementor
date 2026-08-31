import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { behaviorScoreFromInsight, emptyBehavior } from "./pmaEngine.js";

describe("PMA Umani adapter contract", () => {
  it("does not treat engagement-only traffic as conversion evidence", () => {
    const insight = {
      ...emptyBehavior(),
      status: "ok" as const,
      warning: null,
      sessions: 400,
      pageviews: 1200,
      bounceRate: 22,
      ctaClicks: 0,
      purchases: 0,
      reportsPath: { path: "/reports", visitors: 80, pageviews: 140, bounceRate: 22 },
    };
    const score = behaviorScoreFromInsight(insight);
    assert.ok(score != null && score < 80);
    assert.match(insight.note, /not treated as conversion/i);
  });

  it("does not invent utm_term or utm_content fields", () => {
    const insight = emptyBehavior();
    assert.equal("utmTerm" in insight, false);
    assert.equal("utmContent" in insight, false);
    assert.ok(insight.campaigns.every((row) => !("utmTerm" in row) && !("utmContent" in row)));
  });

  it("omits behavior scoring when Umani is unavailable", () => {
    assert.equal(behaviorScoreFromInsight(emptyBehavior()), null);
  });
});
