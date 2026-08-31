export function unwrapData<T>(response: unknown): T {
  if (response && typeof response === "object" && "data" in response) {
    return (response as { data: T }).data;
  }
  return response as T;
}

export type AdsCapabilityMode = "DISCONNECTED" | "READ_ONLY" | "CONTROLLED_WRITE";

export type GoogleAdsConnectionStatus =
  | "disconnected"
  | "oauth_required"
  | "connected_read_only"
  | "auth_error"
  | "access_error"
  | "developer_token_error"
  | "api_error";

export type GoogleAdsStatus = {
  configured: boolean;
  authenticated: boolean;
  customerIdConfigured: boolean;
  hasDeveloperToken: boolean;
  oauthClientConfigured: boolean;
  oauthConfigured: boolean;
  authorizationConnected: boolean;
  apiAccessValidated: boolean;
  mode: AdsCapabilityMode;
  connectionStatus: GoogleAdsConnectionStatus;
  customerIdMasked: string | null;
  customerIdDisplay: string | null;
  loginCustomerIdDisplay: string | null;
  lastError: string | null;
};

export type AdsAccountSummary = {
  customerId: string;
  customerIdDisplay: string | null;
  loginCustomerIdDisplay: string | null;
  descriptiveName: string | null;
  dateRange: { from: string; to: string; label: string };
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  averageCpc: number | null;
  conversions: number | null;
  conversionRate: number | null;
  costPerConversion: number | null;
  conversionValue: number | null;
  roas: number | null;
  campaignCount: number | null;
};

export type AdsCampaign = {
  id: string;
  name: string;
  status: string;
  type: string;
  spend?: number | null;
  cost: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  conversions: number | null;
  costPerConversion: number | null;
};

export type ReportingEnvelope<T> = {
  available: boolean;
  data?: T;
  message?: string;
};

export function formatAdsNumber(value: number | null | undefined, kind: "count" | "money" | "percent" = "count") {
  if (value == null || Number.isNaN(value)) return "—";
  if (kind === "money") return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (kind === "percent") return `${(value * 100).toFixed(2)}%`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export type AdsAgentHealth = {
  provider: "openrouter";
  status: "connected" | "not_configured" | "auth_error" | "model_missing" | "provider_error";
  model: string;
  modelLabel: string;
  apiKeyConfigured: boolean;
  reachable: boolean;
  message: string | null;
};

export type AdsAgentContext = {
  section: string;
  entityType?: string;
  entityId?: string;
  dateRange?: { from: string; to: string };
  selectedRowIds?: string[];
  filters?: Record<string, string>;
};

export type AdsAgentMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  model: string | null;
  createdAt: string;
};

export type Divin8AdsCatalogEntry = {
  key: string;
  displayName: string;
  price: string;
  shortDescription: string;
  systems: string[];
  landingPath: string;
  orderPath: string;
  source: string;
};

export type Divin8KnowledgeResponse = {
  catalog: Divin8AdsCatalogEntry[];
  customEntries: Array<{
    id: string;
    title: string;
    body: string;
    category: string;
    updatedAt: string;
  }>;
};

export function agentStatusLabel(health: AdsAgentHealth | null) {
  if (!health) return "Initializing";
  if (health.status === "connected") return "Connected — GLM 5.3 Flash via OpenRouter";
  if (health.status === "not_configured") return "OpenRouter Not Configured";
  if (health.status === "auth_error") return "OpenRouter Authentication Error";
  if (health.status === "model_missing") return "GLM 5.3 Flash Unavailable";
  if (health.status === "provider_error") return "The Ads Agent could not reach OpenRouter";
  return "Initializing";
}
