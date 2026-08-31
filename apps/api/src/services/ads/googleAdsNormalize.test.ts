import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { last30DayRange, microsToAmount, normalizeCampaign, safeRate, summarizeCampaigns } from "./googleAdsNormalize.js";

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
});
