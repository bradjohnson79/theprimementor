import type { Database } from "@wisdom/db";
import { getDivin8AdvertisingCatalog } from "./divin8AdsCatalog.js";
import { hasMutationAdsTool } from "./googleAdsConnectionService.js";
import { summarizeKeywordInventory } from "./googleAdsNormalize.js";
import { createDisconnectedGoogleAdsProvider, providerForDatabase } from "./googleAdsProvider.js";
import { getPmaWorkspace, summarizePmaForAgent } from "./pma/pmaService.js";
import type { AdsAgentContext } from "./types.js";

export const ADS_PMA_OPENROUTER_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "getPmaKeywordStrategy",
      description: "Read-only PMA keyword strategy summary for the current Divin8 project. Does not invent Google Ads metrics.",
      parameters: { type: "object", properties: { projectId: { type: "string" } }, additionalProperties: false },
    },
  },
];

export const ADS_AGENT_TOOL_NAMES = [
  "getAccountSummary",
  "getCampaigns",
  "getCampaignPerformance",
  "getCampaignDetails",
  "compareDateRanges",
  "compareCampaignDateRanges",
  "getAdGroupPerformance",
  "getKeywordPerformance",
  "getSearchTerms",
  "getConversionPerformance",
  "getAdPerformance",
  "getGoogleRecommendations",
  "getDivin8ProductContext",
  "getLandingPageContext",
  "getPmaKeywordStrategy",
] as const;

export type AdsAgentToolName = (typeof ADS_AGENT_TOOL_NAMES)[number];

export const ADS_AGENT_OPENROUTER_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "getAccountSummary",
      description: "Read-only last-30-day Google Ads account summary for the connected Prime Mentor advertising account.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getCampaigns",
      description: "Read-only list of Google Ads campaigns and last-30-day performance.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getCampaignPerformance",
      description: "Read-only campaign performance metrics. Same as getCampaigns.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getCampaignDetails",
      description: "Read-only details for one campaign when the Admin is viewing that campaign.",
      parameters: {
        type: "object",
        properties: { campaignId: { type: "string" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "compareCampaignDateRanges",
      description: "Compare two date ranges of account-level Google Ads performance.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          compareFrom: { type: "string" },
          compareTo: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getKeywordPerformance",
      description: "Read-only keyword performance for the connected account.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getSearchTerms",
      description: "Read-only search terms for the connected account.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getGoogleRecommendations",
      description: "Read-only Google Ads recommendations. These are Google suggestions, not Prime Mentor recommendations.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "compareDateRanges",
      description: "Compare two date ranges of account-level Google Ads performance. Same as compareCampaignDateRanges.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          compareFrom: { type: "string" },
          compareTo: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getAdGroupPerformance",
      description: "Read-only ad group reporting. Returns unavailable until that reporting surface is enabled.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getConversionPerformance",
      description: "Read-only conversion summary for the connected account. Uses the same account totals as getAccountSummary.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getAdPerformance",
      description: "Read-only ad creative reporting. Returns unavailable until that reporting surface is enabled.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getDivin8ProductContext",
      description: "Approved Divin8 advertising catalog facts. Use this instead of inventing product claims.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getLandingPageContext",
      description: "The public Divin8 Reports landing page used for PMA campaign proposals.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

function sanitizeToolPayload(value: unknown) {
  return JSON.parse(JSON.stringify(value).replace(/sk-or-v1-[A-Za-z0-9]+|ya29\.[A-Za-z0-9._-]+|GOCSPX-[A-Za-z0-9_-]+/g, "[redacted]"));
}

export async function invokeAdsAgentTool(
  name: string,
  input: {
    db?: Database | null;
    context?: AdsAgentContext;
    args?: Record<string, unknown>;
  } = {},
) {
  if (hasMutationAdsTool(name)) {
    return { available: false, reason: "MUTATION_FORBIDDEN", message: "Google Ads writes are not allowed." };
  }
  const provider = input.db ? providerForDatabase(input.db) : createDisconnectedGoogleAdsProvider();
  switch (name) {
    case "getAccountSummary":
      return sanitizeToolPayload(await provider.reporting.getAccountSummary());
    case "getCampaigns":
    case "getCampaignPerformance":
      return sanitizeToolPayload(await provider.reporting.getCampaignPerformance());
    case "getCampaignDetails":
      return sanitizeToolPayload(await provider.reporting.getCampaignDetails({
        ...(input.context ?? { section: "campaigns" }),
        entityId: typeof input.args?.campaignId === "string" ? input.args.campaignId : input.context?.entityId,
      }));
    case "compareDateRanges":
    case "compareCampaignDateRanges":
      return sanitizeToolPayload(await provider.reporting.compareDateRanges({
        from: typeof input.args?.from === "string" ? input.args.from : undefined,
        to: typeof input.args?.to === "string" ? input.args.to : undefined,
        compareFrom: typeof input.args?.compareFrom === "string" ? input.args.compareFrom : undefined,
        compareTo: typeof input.args?.compareTo === "string" ? input.args.compareTo : undefined,
      }));
    case "getAdGroupPerformance":
      return sanitizeToolPayload(await provider.reporting.getAdGroupPerformance());
    case "getKeywordPerformance": {
      const result = await provider.reporting.getKeywordPerformance();
      if (!result.available) return sanitizeToolPayload(result);
      return sanitizeToolPayload({
        ...result,
        inventory: summarizeKeywordInventory(result.data),
      });
    }
    case "getSearchTerms":
      return sanitizeToolPayload(await provider.reporting.getSearchTerms());
    case "getConversionPerformance":
      return sanitizeToolPayload(await provider.reporting.getConversionPerformance());
    case "getAdPerformance":
      return sanitizeToolPayload(await provider.reporting.getAdPerformance());
    case "getGoogleRecommendations":
      return sanitizeToolPayload(await provider.reporting.getGoogleRecommendations());
    case "getDivin8ProductContext":
      return { available: true, catalog: getDivin8AdvertisingCatalog() };
    case "getPmaKeywordStrategy":
      if (!input.db) return { available: false, reason: "DISCONNECTED" };
      return sanitizeToolPayload(summarizePmaForAgent(await getPmaWorkspace(
        input.db,
        typeof input.args?.projectId === "string" ? input.args.projectId : input.context?.filters?.pmaProjectId || "divin8-reports",
      )));
    case "getLandingPageContext":
      return {
        available: true,
        landingPage: {
          path: "/reports",
          url: "https://theprimementor.com/reports",
          purpose: "Divin8 Reports public landing and catalog",
        },
      };
    default:
      return { available: false, reason: "UNKNOWN_TOOL" as const };
  }
}
