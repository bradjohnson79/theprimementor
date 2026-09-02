import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collapseKeywordRows, last30DayRange, microsToAmount, normalizeCampaign, normalizeKeyword, safeRate, summarizeCampaigns, summarizeKeywordInventory } from "./googleAdsNormalize.js";

describe("Google Ads reporting normalization", () => {
  it("converts micros to currency units and keeps missing metrics null", () => {
    assert.equal(microsToAmount(1_250_000), 1.25);
    assert.equal(microsToAmount(null), null);
    assert.equal(safeRate(5, 0), null);
    assert.equal(safeRate(null, 10), null);
  });

  it("normalizes a campaign row without fabricating zeros", () => {
    const campaign = normalizeCampaign({
      campaign: { id: "123", name: "Prime Mentor Reports", status: "ENABLED", advertisingChannelType: "SEARCH" },
      campaignBudget: { amountMicros: "10000000" },
      metrics: {
        impressions: "1000",
        clicks: "50",
        costMicros: "25000000",
        ctr: 0.05,
        averageCpc: "500000",
        conversions: "2",
        conversionsValue: 80,
      },
    });
    assert.equal(campaign.id, "123");
    assert.equal(campaign.cost, 25);
    assert.equal(campaign.averageCpc, 0.5);
    assert.equal(campaign.budget, 10);
    assert.equal(campaign.conversionRate, 2 / 50);
    assert.equal(campaign.costPerConversion, 12.5);
    assert.equal(campaign.roas, 80 / 25);
    const empty = normalizeCampaign({ campaign: { id: "9", name: "Empty" }, metrics: {} });
    assert.equal(empty.impressions, null);
    assert.equal(empty.cost, null);
    assert.equal(empty.health, null);
    const pausedZero = normalizeCampaign({
      campaign: { id: "23816909676", name: "Prime-Mentor-Reports", status: "PAUSED", advertisingChannelType: "SEARCH" },
      campaignBudget: { amountMicros: "10000000" },
      metrics: { impressions: "0", clicks: "0", costMicros: "0", conversions: "0" },
    });
    assert.equal(pausedZero.cost, 0);
    assert.equal(pausedZero.impressions, 0);
    assert.equal(pausedZero.health, null);
  });

  it("summarizes campaigns and keeps a last-30-days range", () => {
    const range = last30DayRange(new Date("2026-08-31T12:00:00Z"));
    assert.equal(range.label, "Last 30 Days");
    assert.equal(range.to, "2026-08-31");
    const summary = summarizeCampaigns([
      normalizeCampaign({
        campaign: { id: "1" },
        metrics: { impressions: "100", clicks: "10", costMicros: "5000000", conversions: "1" },
      }),
    ], range);
    assert.equal(summary.impressions, 100);
    assert.equal(summary.spend, 5);
    assert.equal(summary.ctr, 0.1);
  });

  it("collapses date-segmented keyword rows into a unique positive count", () => {
    const first = normalizeKeyword({
      adGroupCriterion: { criterionId: "11", status: "ENABLED", negative: false, keyword: { text: "birth chart", matchType: "BROAD" } },
      metrics: { impressions: "1", clicks: "0", costMicros: "0" },
    });
    const secondDay = normalizeKeyword({
      adGroupCriterion: { criterionId: "11", status: "ENABLED", negative: false, keyword: { text: "birth chart", matchType: "BROAD" } },
      metrics: { impressions: "2", clicks: "1", costMicros: "0" },
    });
    const removed = normalizeKeyword({
      adGroupCriterion: { criterionId: "12", status: "REMOVED", negative: false, keyword: { text: "old", matchType: "BROAD" } },
      metrics: { impressions: "0" },
    });
    const collapsed = collapseKeywordRows([first, secondDay, removed]);
    assert.equal(collapsed.length, 2);
    const birth = collapsed.find((item) => item.id === "11");
    assert.equal(birth?.impressions, 3);
    assert.equal(birth?.clicks, 1);
    const inventory = summarizeKeywordInventory([first, secondDay, removed], 3);
    assert.equal(inventory.uniquePositiveKeywords, 1);
    assert.equal(inventory.rawRowCount, 3);
    assert.equal(inventory.excludedRemoved, 1);
  });
});
