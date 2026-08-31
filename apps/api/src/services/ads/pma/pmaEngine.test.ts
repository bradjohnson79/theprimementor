import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeKeywords,
  behaviorScoreFromInsight,
  classifyIntent,
  clusterTerms,
  emptyBehavior,
  normalizeKeyword,
  parseKeywordCsv,
  parseKeywordList,
  scoreDivin8Relevance,
  suggestNegatives,
} from "./pmaEngine.js";

describe("PMA keyword engine", () => {
  it("treats divin8-reports as a project slug, not a UUID", async () => {
    const { isPmaProjectId } = await import("./pmaStore.js");
    assert.equal(isPmaProjectId("divin8-reports"), false);
    assert.equal(isPmaProjectId("00000000-0000-4000-8000-000000000000"), true);
  });

  it("normalizes seeds and removes duplicates", () => {
    assert.deepEqual(
      parseKeywordList("Detailed Birth Chart Report\ndetailed birth chart report\n, numerology report"),
      ["detailed birth chart report", "numerology report"],
    );
    assert.equal(normalizeKeyword("  Buy  Report!! "), "buy report");
  });

  it("parses observed CSV metrics without inventing missing ones", () => {
    const rows: Array<{ term: string; metrics: { impressions?: { origin: string; value: number | null } } }> = parseKeywordCsv(
      "keyword,impressions,clicks\nbuy natal report,120,9\nwhat is natal chart,",
    );
    assert.equal(rows[0]?.metrics.impressions?.origin, "observed");
    assert.equal(rows[0]?.metrics.impressions?.value, 120);
    assert.equal(rows[1]?.metrics.impressions, undefined);
  });

  it("keeps informational and transactional natal terms in different commercial classes", () => {
    const info = classifyIntent("what is a natal chart");
    const buy = classifyIntent("buy detailed natal chart report");
    assert.equal(info.kind, "informational");
    assert.equal(buy.kind, "transactional");
    assert.ok(buy.score > info.score);
  });

  it("clusters related report terms and keeps unrelated jobs traffic separate", () => {
    const clusters = clusterTerms([
      "detailed birth chart report",
      "personal natal chart report",
      "astrology jobs hiring",
    ]);
    assert.ok(clusters.length >= 2);
    const jobCluster = clusters.find((cluster) => cluster.terms.includes("astrology jobs hiring"));
    const reportCluster = clusters.find((cluster) => cluster.terms.includes("detailed birth chart report"));
    assert.ok(jobCluster && reportCluster && jobCluster.id !== reportCluster.id);
  });

  it("scores Divin8 relevance from catalog language", () => {
    const strong = scoreDivin8Relevance("detailed birth chart report", "natal birth chart report divin8 numerology");
    const weak = scoreDivin8Relevance("python developer jobs", "natal birth chart report divin8 numerology");
    assert.equal(strong.label, "Excellent");
    assert.equal(weak.label, "Weak");
  });

  it("does not invent search volume or CPC and omits missing behavior", () => {
    const payload = analyzeKeywords({
      seeds: ["detailed birth chart report", "what is a natal chart", "free natal chart calculator"],
      behavior: emptyBehavior(),
    });
    const candidateJson = JSON.stringify(payload.candidates);
    assert.doesNotMatch(candidateJson, /"volume"|"cpc"|"keywordDifficulty"|"impressionShare"/);
    assert.match(payload.scoringWeights.note, /unknown/i);
    assert.equal(payload.providers.googleAds, "unavailable");
    const birth = payload.candidates.find((item) => item.term.includes("birth chart"));
    assert.ok(birth);
    assert.ok(birth.opportunityScore > 50);
    assert.match(birth.opportunityReason, /omitted|Behavior/);
  });

  it("suggests negatives without auto-excluding them", () => {
    const payload = analyzeKeywords({
      seeds: ["free natal chart calculator", "detailed birth chart report"],
      behavior: emptyBehavior(),
    });
    const free = payload.negatives.find((item) => item.term === "free");
    assert.ok(free);
    assert.ok(free.action === "Test exclude" || free.action === "Monitor" || free.action === "Keep");
    assert.ok(payload.negatives.every((item) => item.action === "Test exclude" || item.action === "Monitor" || item.action === "Keep"));
  });

  it("classifies free-report queries as poor fit and keeps them out of exact keywords", () => {
    const free = classifyIntent("free birth chart report");
    assert.equal(free.kind, "poor_fit");
    const payload = analyzeKeywords({
      seeds: ["free birth chart report", "detailed birth chart report"],
      behavior: emptyBehavior(),
    });
    const idea = payload.campaignIdeas[0];
    assert.ok(idea);
    assert.ok(!idea.exactKeywords.includes("free birth chart report"));
    const freedom = suggestNegatives([
      {
        term: "spiritual freedom report",
        source: "seed",
        intent: "informational",
        intentReason: "test",
        intentScore: 36,
        relevanceLabel: "Moderate",
        relevanceReason: "test",
        relevanceScore: 56,
        specificityScore: 72,
        opportunityScore: 40,
        opportunityReason: "test",
        clusterId: null,
        metrics: {},
      },
    ]);
    assert.equal(freedom.find((item) => item.term === "free")?.evidence.includes("spiritual freedom"), false);
  });

  it("omits behavior from opportunity when /reports has no visitors", () => {
    const score = behaviorScoreFromInsight({
      ...emptyBehavior(),
      status: "ok",
      warning: null,
      reportsPath: { path: "/reports", visitors: 0, pageviews: 0, bounceRate: 0 },
      ctaClicks: 0,
      purchases: 0,
    });
    assert.equal(score, null);
  });

  it("builds a proposal-only campaign idea from the strongest cluster", () => {
    const payload = analyzeKeywords({
      seeds: ["detailed birth chart report", "personal natal chart report"],
      behavior: emptyBehavior(),
    });
    assert.ok(payload.campaignIdeas.length >= 1);
    assert.match(payload.campaignIdeas[0]!.landingPage, /\/reports/);
    assert.match(JSON.stringify(payload.campaignIdeas), /Proposal only|experiment/i);
  });
});
