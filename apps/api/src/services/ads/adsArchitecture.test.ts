import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../");

function read(rel: string) {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

describe("Ads Intelligence architecture", () => {
  it("does not add Ads tables to schema repair", () => {
    const repair = read("apps/api/src/services/schemaRepairService.ts");
    assert.doesNotMatch(repair, /ads_agent_|ads_divin8_|ads_campaign_proposals|ads_google_|ads_pma_/);
  });

  it("routes Ads Agent inference through OpenRouter only with no fallbacks", () => {
    const service = read("apps/api/src/services/ads/adsAgentService.ts");
    const adapter = read("apps/api/src/services/ads/openRouterAdapter.ts");
    const prompt = read("apps/api/src/services/ads/adsAgentPrompt.ts");
    assert.match(service, /completeOpenRouterChat/);
    assert.match(service, /probeOpenRouterHealth/);
    assert.match(service, /enqueueAdsAgentChat/);
    assert.match(service, /generateAdsAgentReply/);
    assert.match(service, /GENERATION_DEADLINE_MS = 90_000/);
    assert.match(service, /ads_agent_timing/);
    assert.doesNotMatch(service, /ollama|openai|anthropic|gemini/i);
    assert.match(adapter, /https:\/\/openrouter\.ai\/api\/v1/);
    assert.match(adapter, /z-ai\/glm-5\.3-flash/);
    assert.match(adapter, /export const CHAT_TIMEOUT_MS = 20_000/);
    assert.doesNotMatch(service, /ADS_AGENT_HTTP_DEADLINE_MS/);
    assert.doesNotMatch(adapter, /ollama|openai\.com|anthropic|generativelanguage\.googleapis/i);
    assert.doesNotMatch(prompt, /ollama|openai|anthropic|gemini/i);
    assert.equal(existsSync(path.join(repoRoot, "apps/api/src/services/ads/ollamaAdapter.ts")), false);
  });

  it("keeps OpenRouter calls on the API and out of the browser", () => {
    const adminFiles = [
      "apps/admin/src/components/ads/AdsAgentDrawer.tsx",
      "apps/admin/src/context/AdsAgentProvider.tsx",
      "apps/admin/src/pages/ads/adsApi.ts",
      "apps/admin/src/pages/ads/Settings.tsx",
      "apps/admin/src/pages/ads/CommandCenter.tsx",
      "apps/admin/src/layouts/AdsLayout.tsx",
    ];
    for (const file of adminFiles) {
      const source = read(file);
      assert.doesNotMatch(source, /openrouter\.ai/);
      assert.doesNotMatch(source, /VITE_OPENROUTER/);
      assert.doesNotMatch(source, /localhost:11434|127\.0\.0\.1:11434|ollama/i);
    }
    const env = read("apps/api/.env.example");
    assert.doesNotMatch(env, /VITE_OPENROUTER/);
  });

  it("keeps the Ads Agent drawer in AdsLayout", () => {
    const layout = read("apps/admin/src/layouts/AdsLayout.tsx");
    const drawer = read("apps/admin/src/components/ads/AdsAgentDrawer.tsx");
    const app = read("apps/admin/src/App.tsx");
    const sidebar = read("apps/admin/src/components/Sidebar.tsx");
    assert.match(layout, /AdsAgentProvider/);
    assert.match(layout, /AdsAgentDrawer/);
    assert.match(layout, /AdsSubnav/);
    assert.match(drawer, /data-ads-agent-rail/);
    assert.match(drawer, /data-ads-agent-drawer/);
    assert.match(drawer, /AdsAgentMarkdown/);
    assert.match(drawer, /ADS AI/);
    assert.match(app, /AdsLayout/);
    assert.match(app, /admin\/ads/);
    assert.match(sidebar, /label: "Ads"/);
    assert.match(sidebar, /\/admin\/ads/);
    const provider = read("apps/admin/src/context/AdsAgentProvider.tsx");
    assert.match(provider, /\/admin\/ads\/agent\/conversations/);
    assert.match(provider, /setMessages\(detail\.messages\)/);
    assert.match(provider, /status: "generating"/);
    assert.match(provider, /adsAgentUserError/);
  });

  it("registers layered Ads memory without schema-repair tables", () => {
    const inventory = read("apps/api/src/routeInventory.ts");
    const memory = read("apps/api/src/services/ads/adsMemoryService.ts");
    const settings = read("apps/admin/src/pages/ads/Settings.tsx");
    assert.match(inventory, /\/api\/admin\/ads\/agent\/memory/);
    assert.match(inventory, /\/api\/admin\/ads\/agent\/memory\/clear-workspace/);
    assert.match(memory, /owner_decision/);
    assert.match(memory, /workspace/);
    assert.match(memory, /screenshot/);
    assert.match(memory, /performance/);
    assert.match(settings, /data-ads-memory/);
    assert.match(settings, /View Ads Memory/);
  });

  it("does not expose Google Ads secret fields in Settings UI", () => {
    const settings = read("apps/admin/src/pages/ads/Settings.tsx");
    assert.doesNotMatch(settings, /GOOGLE_ADS_CLIENT_SECRET|GOOGLE_ADS_REFRESH_TOKEN|developer token input|type="password"/i);
    assert.match(settings, /Not Connected/);
    assert.match(settings, /Test Connection/);
    assert.match(settings, /Connect Google Ads/);
    assert.match(settings, /Validate API access/);
    assert.match(settings, /OpenRouter/);
    assert.match(settings, /GLM 5\.3 Flash/);
    const labels = read("apps/admin/src/pages/ads/adsApi.ts");
    assert.match(labels, /Connected — GLM 5\.3 Flash via OpenRouter/);
    assert.match(labels, /OpenRouter Not Configured/);
    assert.match(labels, /OpenRouter Authentication Error/);
    assert.match(labels, /GLM 5\.3 Flash Unavailable/);
    assert.match(labels, /The Ads Agent could not reach OpenRouter/);
  });

  it("registers Ads routes and env example names only", () => {
    const inventory = read("apps/api/src/routeInventory.ts");
    const env = read("apps/api/.env.example");
    const adsEnv = env.slice(env.indexOf("Admin Ads Intelligence"));
    assert.match(inventory, /\/api\/admin\/ads\/status/);
    assert.match(inventory, /\/api\/admin\/ads\/agent\/chat/);
    assert.match(read("apps/api/src/routes/adminAds.ts"), /status\(202\)/);
    assert.match(inventory, /\/api\/admin\/ads\/agent\/memory/);
    assert.match(inventory, /\/api\/admin\/ads\/google\/oauth\/start/);
    assert.match(inventory, /\/api\/admin\/ads\/google\/validate/);
    assert.match(inventory, /\/api\/admin\/ads\/google\/oauth\/callback/);
    assert.match(inventory, /\/api\/admin\/ads\/reporting\/campaigns/);
    assert.match(inventory, /\/api\/admin\/ads\/pma\/analyze/);
    assert.match(read("apps/admin/src/App.tsx"), /keyword-strategy/);
    const rest = read("apps/api/src/services/ads/googleAdsRestClient.ts");
    assert.match(rest, /GOOGLE_ADS_API_VERSION = "v25"/);
    assert.doesNotMatch(inventory, /pauseCampaign|mutate|changeBudget/);
    const vision = read("apps/api/src/services/ads/pma/pmaVision.ts");
    assert.match(vision, /image_url/);
    assert.doesNotMatch(vision, /tesseract|ocr\.space|createWorker/i);
    assert.match(vision, /untrusted visual data/);
    assert.match(adsEnv, /GOOGLE_ADS_DEVELOPER_TOKEN=/);
    assert.match(adsEnv, /GOOGLE_ADS_REDIRECT_URI=/);
    assert.match(adsEnv, /ADS_TOKEN_ENCRYPTION_KEY=/);
    assert.match(adsEnv, /OPENROUTER_API_KEY=/);
    assert.match(adsEnv, /ADS_AGENT_MODEL=z-ai\/glm-5\.3-flash/);
    assert.match(adsEnv, /OPENROUTER_APP_TITLE=Prime Mentor Ads Agent/);
    assert.doesNotMatch(adsEnv, /ADS_OLLAMA_URL|ADS_AGENT_PREFERRED_MODEL/);
    assert.doesNotMatch(adsEnv, /ya29\.|AIza[0-9A-Za-z]|sk-[A-Za-z0-9]/);
  });
});
