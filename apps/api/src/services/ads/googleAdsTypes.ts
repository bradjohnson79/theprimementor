export type CampaignHealth = "Excellent" | "Healthy" | "Needs Attention" | "Poor";

export type AdsCampaign = {
  id: string;
  name: string;
  status: string;
  type: string;
  budget: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  averageCpc: number | null;
  cost: number | null;
  conversions: number | null;
  conversionRate: number | null;
  costPerConversion: number | null;
  conversionValue: number | null;
  roas: number | null;
  health: CampaignHealth | null;
};

export type AdsKeyword = {
  id: string;
  keyword: string;
  matchType: string;
  status: string;
  negative: boolean;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cost: number | null;
  conversions: number | null;
  costPerConversion: number | null;
};

export type AdsKeywordInventory = {
  uniquePositiveKeywords: number;
  rawRowCount: number;
  excludedRemoved: number;
  excludedNegatives: number;
  definition: string;
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

export type AdsRecommendation = {
  id: string;
  type: string;
  source: "Google Recommendation";
  campaignId: string | null;
};

export type AdsSearchTerm = {
  id: string;
  searchTerm: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  keyword: string | null;
  impressions: number | null;
  clicks: number | null;
  cost: number | null;
  conversions: number | null;
};

export type AdsCampaignProposal = {
  objective: string | null;
  campaignType: string | null;
  geography: string | null;
  audience: string | null;
  budget: string | null;
  adGroups: unknown[];
  keywords: unknown[];
  negativeKeywords: unknown[];
  headlines: unknown[];
  descriptions: unknown[];
  landingPage: string | null;
  strategyNotes: string | null;
  experimentHypothesis: string | null;
};
