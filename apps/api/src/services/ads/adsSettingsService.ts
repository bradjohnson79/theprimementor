import type { Database } from "@wisdom/db";
import {
  ADS_AGENT_MODEL_LABEL,
  configuredAdsAgentModel,
  openRouterApiKeyConfigured,
} from "./openRouterAdapter.js";
import type { AdsAgentSettings } from "./types.js";

export async function getAdsAgentSettings(_db: Database | null): Promise<AdsAgentSettings> {
  return {
    provider: "openrouter",
    model: configuredAdsAgentModel(),
    modelLabel: ADS_AGENT_MODEL_LABEL,
    apiKeyConfigured: openRouterApiKeyConfigured(),
  };
}

export async function updateAdsAgentSettings(
  db: Database,
  _patch: Record<string, unknown> = {},
): Promise<AdsAgentSettings> {
  return getAdsAgentSettings(db);
}
