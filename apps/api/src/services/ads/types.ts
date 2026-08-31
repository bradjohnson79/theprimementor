export const ADS_CAPABILITY_MODES = ["DISCONNECTED", "READ_ONLY", "CONTROLLED_WRITE"] as const;
export type AdsCapabilityMode = (typeof ADS_CAPABILITY_MODES)[number];

export const ADS_SECTIONS = [
  "command_center",
  "campaigns",
  "ad_groups",
  "ad_copy",
  "keywords",
  "keyword_strategy",
  "search_terms",
  "conversions",
  "opportunities",
  "campaign_lab",
  "divin8_intelligence",
  "settings",
] as const;
export type AdsSection = (typeof ADS_SECTIONS)[number];

export const ADS_ENTITY_TYPES = ["campaign", "ad_group", "ad", "keyword", "search_term"] as const;
export type AdsEntityType = (typeof ADS_ENTITY_TYPES)[number];

export type AdsAgentContext = {
  section: AdsSection;
  entityType?: AdsEntityType;
  entityId?: string;
  dateRange?: { from: string; to: string };
  selectedRowIds?: string[];
  filters?: Record<string, string>;
};

export type AdsAgentHealthStatus =
  | "connected"
  | "not_configured"
  | "auth_error"
  | "model_missing"
  | "provider_error";

export type AdsAgentHealth = {
  provider: "openrouter";
  status: AdsAgentHealthStatus;
  model: string;
  modelLabel: string;
  apiKeyConfigured: boolean;
  reachable: boolean;
  message: string | null;
};

export type AdsAgentSettings = {
  provider: "openrouter";
  model: string;
  modelLabel: string;
  apiKeyConfigured: boolean;
};

export type AdsAgentMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  model: string | null;
  context: AdsAgentContext | null;
  createdAt: string;
};

export type AdsAgentConversationSummary = {
  id: string;
  title: string | null;
  model: string | null;
  updatedAt: string;
};

export const ADS_MEMORY_KINDS = [
  "rejected_angle",
  "approved_positioning",
  "test_result",
  "campaign_lesson",
  "keyword_lesson",
  "audience_observation",
  "landing_page_observation",
] as const;
export type AdsMemoryKind = (typeof ADS_MEMORY_KINDS)[number];

export function isAdsSection(value: unknown): value is AdsSection {
  return typeof value === "string" && (ADS_SECTIONS as readonly string[]).includes(value);
}

export function sanitizeAdsAgentContext(value: unknown): AdsAgentContext {
  if (!value || typeof value !== "object") {
    return { section: "command_center" };
  }
  const input = value as Record<string, unknown>;
  const section = isAdsSection(input.section) ? input.section : "command_center";
  const entityType = typeof input.entityType === "string"
    && (ADS_ENTITY_TYPES as readonly string[]).includes(input.entityType)
    ? input.entityType as AdsEntityType
    : undefined;
  const entityId = typeof input.entityId === "string" && input.entityId.trim()
    ? input.entityId.trim().slice(0, 128)
    : undefined;
  const dateRange = input.dateRange && typeof input.dateRange === "object"
    ? {
      from: String((input.dateRange as { from?: unknown }).from ?? "").slice(0, 32),
      to: String((input.dateRange as { to?: unknown }).to ?? "").slice(0, 32),
    }
    : undefined;
  const selectedRowIds = Array.isArray(input.selectedRowIds)
    ? input.selectedRowIds.filter((id): id is string => typeof id === "string").slice(0, 25)
    : undefined;
  const filters = input.filters && typeof input.filters === "object"
    ? Object.fromEntries(
      Object.entries(input.filters as Record<string, unknown>)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
        .slice(0, 12),
    )
    : undefined;
  return { section, entityType, entityId, dateRange, selectedRowIds, filters };
}
