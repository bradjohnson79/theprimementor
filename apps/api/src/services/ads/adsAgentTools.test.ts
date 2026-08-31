import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAdsAgentSystemPrompt } from "./adsAgentPrompt.js";
import { invokeAdsAgentTool } from "./adsAgentTools.js";

describe("Ads Agent read-only tools", () => {
  it("does not claim live data while disconnected", async () => {
    const prompt = buildAdsAgentSystemPrompt({ section: "command_center" }, "DISCONNECTED");
    assert.match(prompt, /no live Google Ads access/i);
    assert.doesNotMatch(prompt, /available through read-only tools/);
    const result = await invokeAdsAgentTool("getAccountSummary");
    assert.equal("available" in result && result.available, false);
  });

  it("describes live tools in READ_ONLY mode and still forbids mutations", async () => {
    const prompt = buildAdsAgentSystemPrompt({ section: "campaigns" }, "READ_ONLY");
    assert.match(prompt, /READ_ONLY/);
    assert.match(prompt, /read-only tools/i);
    const blocked = await invokeAdsAgentTool("changeBudget");
    assert.equal("available" in blocked && blocked.available, false);
  });
});
