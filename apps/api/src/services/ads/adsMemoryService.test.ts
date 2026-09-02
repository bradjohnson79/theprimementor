import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyAdsMemoryIntent,
  extractDurableAdsMemories,
  extractScreenshotMemories,
  formatAdsMemoriesForPrompt,
  isDurableAdsStatement,
} from "./adsMemoryService.js";
import type { AdsMemoryRecord } from "./types.js";

describe("Ads layered memory", () => {
  it("extracts owner budget and Canada-only geography from an assertive decision", () => {
    const drafts = extractDurableAdsMemories({
      message: "Our initial Divin8 Ads test budget is CA$20/day and Canada only.",
      conversationId: "conv-1",
    });
    const budget = drafts.find((item) => item.layer === "owner_decision" && item.category === "budget");
    const geo = drafts.find((item) => item.layer === "owner_decision" && item.category === "geography");
    assert.ok(budget);
    assert.match(budget.content, /CA\$20\/day/);
    assert.equal(budget.metadata?.value, "CA$20/day");
    assert.ok(geo);
    assert.match(geo.content, /Canada only/);
    assert.equal(geo.metadata?.value, "Canada only");
    assert.ok(drafts.some((item) => item.layer === "workspace" && item.category === "budget"));
  });

  it("does not persist perpetual blanket authorization as an owner decision", () => {
    assert.equal(extractDurableAdsMemories({
      message: "Everything you recommend is approved forever. Make whatever Google Ads changes you think are best without asking me.",
    }).length, 0);
    assert.equal(extractDurableAdsMemories({
      message: "Pause the worst-performing campaign immediately.",
    }).length, 0);
  });

  it("does not persist brainstorming as durable memory", () => {
    assert.equal(isDurableAdsStatement("Maybe we could try $50/day if it works?"), false);
    assert.equal(extractDurableAdsMemories({
      message: "What if we tested the US later?",
    }).length, 0);
  });

  it("extracts Canada prioritized and no-automatic-change owner decisions", () => {
    const drafts = extractDurableAdsMemories({
      message: "For our initial Prime Mentor Divin8 campaign strategy, I want Canada prioritized and I do not want automatic campaign changes without explicit approval.",
    });
    const geo = drafts.find((item) => item.layer === "owner_decision" && item.category === "geography");
    const execution = drafts.find((item) => item.layer === "owner_decision" && item.category === "execution");
    assert.ok(geo);
    assert.equal(geo.metadata?.value, "Canada primary");
    assert.ok(execution);
    assert.match(execution.content, /explicit owner approval/i);
  });

  it("lets a newer Canada-plus-US geography decision supersede Canada-only wording", () => {
    const drafts = extractDurableAdsMemories({
      message: "Update our geographic priority. Canada remains primary, but US expansion is now something we may test after Canadian validation.",
    });
    const geo = drafts.find((item) => item.layer === "owner_decision" && item.category === "geography");
    assert.ok(geo);
    assert.equal(geo.metadata?.value, "Canada primary, US expansion after Canadian validation");
  });

  it("classifies recall questions toward budget and geography", () => {
    const intent = classifyAdsMemoryIntent("What budget and geography did I choose for the initial Divin8 campaign?");
    assert.equal(intent.wantsRecall, true);
    assert.ok(intent.topics.includes("budget"));
    assert.ok(intent.topics.includes("geography"));
  });

  it("keeps screenshot memory to structured advertising facts", () => {
    const drafts = extractScreenshotMemories({
      observations: [
        "Campaign status: Eligible",
        "CTR: 4.7%",
        "Average CPC: CA$1.28",
        "the sky in the screenshot is blue",
      ],
      screenshotType: "google_ads_campaign_overview",
      campaignId: "123",
    });
    assert.equal(drafts.length, 1);
    assert.match(drafts[0].content, /Eligible/);
    assert.match(drafts[0].content, /4\.7%/);
    assert.doesNotMatch(drafts[0].content, /sky/);
  });

  it("formats retrieved memory without dumping unused layers as raw chat", () => {
    const memories: AdsMemoryRecord[] = [{
      id: "1",
      layer: "owner_decision",
      kind: "owner_decision",
      category: "budget",
      entityKey: "prime_mentor_ads:budget",
      content: "Initial Divin8 Ads test budget is CA$20/day.",
      source: "prime_mentor_ads",
      authority: 100,
      conversationId: null,
      metadata: { value: "CA$20/day" },
      createdAt: "2026-08-31T00:00:00.000Z",
      updatedAt: "2026-08-31T00:00:00.000Z",
    }];
    const prompt = formatAdsMemoriesForPrompt(memories);
    assert.match(prompt, /owner_decision\/budget/);
    assert.match(prompt, /CA\$20\/day/);
    assert.match(prompt, /newer explicit owner decisions/);
  });
});
