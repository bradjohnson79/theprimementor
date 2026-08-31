import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAdsAgentSystemPrompt } from "./adsAgentPrompt.js";
import {
  DEFAULT_ADS_AGENT_MODEL,
  completeOpenRouterChat,
  configuredAdsAgentModel,
  openRouterApiKeyConfigured,
  probeOpenRouterHealth,
} from "./openRouterAdapter.js";

const LIVE = process.env.ADS_OPENROUTER_LIVE === "1";

describe("Ads Agent live OpenRouter smoke", () => {
  it("answers a CTR question through OpenRouter when ADS_OPENROUTER_LIVE=1", async (t) => {
    if (!LIVE) {
      t.skip("Set ADS_OPENROUTER_LIVE=1 to exercise a real OpenRouter request");
      return;
    }
    assert.equal(openRouterApiKeyConfigured(), true, "OPENROUTER_API_KEY must be set for the live smoke");
    assert.equal(configuredAdsAgentModel(), DEFAULT_ADS_AGENT_MODEL);

    const health = await probeOpenRouterHealth({ bypassCache: true });
    assert.equal(health.provider, "openrouter");
    assert.equal(health.status, "connected");
    assert.equal(health.model, DEFAULT_ADS_AGENT_MODEL);
    assert.doesNotMatch(JSON.stringify(health), /sk-or-v1-/);

    const answer = await completeOpenRouterChat({
      messages: [
        { role: "system", content: buildAdsAgentSystemPrompt({ section: "command_center" }, "DISCONNECTED") },
        { role: "user", content: "What is CTR in Google Ads?" },
      ],
    });
    assert.match(answer.toLowerCase(), /ctr|click/i);
    assert.doesNotMatch(answer, /GOOGLE_ADS_CLIENT_SECRET|refresh token|sk-or-v1-/i);
  });
});
