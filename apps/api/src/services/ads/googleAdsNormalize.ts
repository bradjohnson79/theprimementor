import type { AdsAccountSummary, AdsCampaign, AdsKeyword, AdsKeywordInventory, AdsRecommendation, AdsSearchTerm, CampaignHealth } from "./googleAdsTypes.js";
import { configuredCustomerId, configuredLoginCustomerId, displayCustomerId } from "./googleAdsIds.js";

export function microsToAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n / 1_000_000;
}

export function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function safeRate(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

export function last30DayRange(now = new Date()) {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to), label: "Last 30 Days" };
}

function campaignHealth(input: {
  impressions: number | null;
  ctr: number | null;
  conversions: number | null;
  cost: number | null;
}): CampaignHealth | null {
  const impressions = input.impressions ?? 0;
  const cost = input.cost ?? 0;
  const conversions = input.conversions ?? 0;
  const ctr = input.ctr;
  if (impressions === 0 && cost === 0 && conversions === 0 && (ctr == null || ctr === 0)) {
    return null;
  }
  if (conversions > 0 && (ctr ?? 0) >= 0.03) return "Excellent";
  if (conversions > 0 || (ctr ?? 0) >= 0.02) return "Healthy";
  if (cost > 0 && conversions === 0) return "Needs Attention";
  return "Poor";
}

export function normalizeCampaign(row: Record<string, unknown>): AdsCampaign {
  const campaign = (row.campaign ?? {}) as Record<string, unknown>;
  const metrics = (row.metrics ?? {}) as Record<string, unknown>;
  const campaignBudget = (row.campaignBudget ?? {}) as Record<string, unknown>;
  const impressions = asNumber(metrics.impressions);
  const clicks = asNumber(metrics.clicks);
  const cost = microsToAmount(metrics.costMicros ?? metrics.cost_micros);
  const conversions = asNumber(metrics.conversions);
  const conversionValue = asNumber(metrics.conversionsValue ?? metrics.conversions_value);
  const ctr = asNumber(metrics.ctr) ?? safeRate(clicks, impressions);
  const averageCpc = microsToAmount(metrics.averageCpc ?? metrics.average_cpc);
  const conversionRate = safeRate(conversions, clicks);
  const costPerConversion = safeRate(cost, conversions);
  const roas = safeRate(conversionValue, cost);
  return {
    id: String(campaign.id ?? ""),
    name: String(campaign.name ?? "Untitled campaign"),
    status: String(campaign.status ?? "UNKNOWN"),
    type: String(campaign.advertisingChannelType ?? campaign.advertising_channel_type ?? "UNKNOWN"),
    budget: microsToAmount(campaignBudget.amountMicros ?? campaignBudget.amount_micros),
    impressions,
    clicks,
    ctr,
    averageCpc,
    cost,
    conversions,
    conversionRate,
    costPerConversion,
    conversionValue,
    roas,
    health: campaignHealth({ impressions, ctr, conversions, cost }),
  };
}

export function summarizeCampaigns(campaigns: AdsCampaign[], dateRange = last30DayRange()): AdsAccountSummary {
  const add = (values: Array<number | null>) => {
    const present = values.filter((value): value is number => value != null);
    return present.length ? present.reduce((sum, value) => sum + value, 0) : null;
  };
  const impressions = add(campaigns.map((item) => item.impressions));
  const clicks = add(campaigns.map((item) => item.clicks));
  const cost = add(campaigns.map((item) => item.cost));
  const conversions = add(campaigns.map((item) => item.conversions));
  const conversionValue = add(campaigns.map((item) => item.conversionValue));
  return {
    customerId: configuredCustomerId(),
    customerIdDisplay: displayCustomerId(configuredCustomerId()),
    loginCustomerIdDisplay: displayCustomerId(configuredLoginCustomerId()),
    descriptiveName: null,
    dateRange,
    spend: cost,
    impressions,
    clicks,
    ctr: safeRate(clicks, impressions),
    averageCpc: safeRate(cost, clicks),
    conversions,
    conversionRate: safeRate(conversions, clicks),
    costPerConversion: safeRate(cost, conversions),
    conversionValue,
    roas: safeRate(conversionValue, cost),
    campaignCount: campaigns.length,
  };
}

export function normalizeKeyword(row: Record<string, unknown>): AdsKeyword {
  const criterion = (row.adGroupCriterion ?? row.ad_group_criterion ?? {}) as Record<string, unknown>;
  const keyword = (criterion.keyword ?? {}) as Record<string, unknown>;
  const campaign = (row.campaign ?? {}) as Record<string, unknown>;
  const adGroup = (row.adGroup ?? row.ad_group ?? {}) as Record<string, unknown>;
  const metrics = (row.metrics ?? {}) as Record<string, unknown>;
  const clicks = asNumber(metrics.clicks);
  const impressions = asNumber(metrics.impressions);
  const cost = microsToAmount(metrics.costMicros ?? metrics.cost_micros);
  const conversions = asNumber(metrics.conversions);
  return {
    id: String(criterion.criterionId ?? criterion.criterion_id ?? keyword.text ?? ""),
    keyword: String(keyword.text ?? ""),
    matchType: String(keyword.matchType ?? keyword.match_type ?? "UNKNOWN"),
    status: String(criterion.status ?? "UNKNOWN"),
    negative: criterion.negative === true || criterion.negative === "true",
    campaignId: String(campaign.id ?? ""),
    campaignName: String(campaign.name ?? ""),
    adGroupId: String(adGroup.id ?? ""),
    adGroupName: String(adGroup.name ?? ""),
    impressions,
    clicks,
    ctr: asNumber(metrics.ctr) ?? safeRate(clicks, impressions),
    cost,
    conversions,
    costPerConversion: safeRate(cost, conversions),
  };
}

function addNullable(left: number | null, right: number | null) {
  if (left == null && right == null) return null;
  return (left ?? 0) + (right ?? 0);
}

export function collapseKeywordRows(rows: AdsKeyword[]): AdsKeyword[] {
  const byId = new Map<string, AdsKeyword>();
  for (const row of rows) {
    const key = row.id || `${row.adGroupId}:${row.keyword}:${row.matchType}`;
    const current = byId.get(key);
    if (!current) {
      byId.set(key, { ...row, id: key });
      continue;
    }
    const impressions = addNullable(current.impressions, row.impressions);
    const clicks = addNullable(current.clicks, row.clicks);
    const cost = addNullable(current.cost, row.cost);
    const conversions = addNullable(current.conversions, row.conversions);
    byId.set(key, {
      ...current,
      impressions,
      clicks,
      cost,
      conversions,
      ctr: safeRate(clicks, impressions),
      costPerConversion: safeRate(cost, conversions),
    });
  }
  return [...byId.values()];
}

export function summarizeKeywordInventory(rows: AdsKeyword[], rawRowCount = rows.length): AdsKeywordInventory {
  const collapsed = collapseKeywordRows(rows);
  const excludedNegatives = collapsed.filter((item) => item.negative).length;
  const excludedRemoved = collapsed.filter((item) => !item.negative && item.status === "REMOVED").length;
  const uniquePositive = collapsed.filter((item) => !item.negative && item.status !== "REMOVED");
  return {
    uniquePositiveKeywords: uniquePositive.length,
    rawRowCount,
    excludedRemoved,
    excludedNegatives,
    definition: "Unique non-removed positive ad-group keywords. Date-segmented keyword_view rows are collapsed by criterion id so daily metric rows do not inflate the count.",
  };
}

export function normalizeSearchTerm(row: Record<string, unknown>): AdsSearchTerm {
  const searchTermView = (row.searchTermView ?? row.search_term_view ?? {}) as Record<string, unknown>;
  const campaign = (row.campaign ?? {}) as Record<string, unknown>;
  const adGroup = (row.adGroup ?? row.ad_group ?? {}) as Record<string, unknown>;
  const metrics = (row.metrics ?? {}) as Record<string, unknown>;
  return {
    id: String(searchTermView.searchTerm ?? searchTermView.search_term ?? ""),
    searchTerm: String(searchTermView.searchTerm ?? searchTermView.search_term ?? ""),
    campaignId: String(campaign.id ?? ""),
    campaignName: String(campaign.name ?? ""),
    adGroupId: String(adGroup.id ?? ""),
    adGroupName: String(adGroup.name ?? ""),
    keyword: typeof searchTermView.searchTermMatchSource === "string" ? searchTermView.searchTermMatchSource : null,
    impressions: asNumber(metrics.impressions),
    clicks: asNumber(metrics.clicks),
    cost: microsToAmount(metrics.costMicros ?? metrics.cost_micros),
    conversions: asNumber(metrics.conversions),
  };
}

export function normalizeRecommendation(row: Record<string, unknown>): AdsRecommendation {
  const recommendation = (row.recommendation ?? {}) as Record<string, unknown>;
  return {
    id: String(recommendation.resourceName ?? recommendation.resource_name ?? recommendation.type ?? ""),
    type: String(recommendation.type ?? "UNKNOWN"),
    source: "Google Recommendation",
    campaignId: typeof recommendation.campaign === "string" ? recommendation.campaign : null,
  };
}
