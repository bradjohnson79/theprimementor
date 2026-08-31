import type { Database } from "@wisdom/db";
import { getValidAdsAccessToken } from "./googleAdsOAuthService.js";
import { last30DayRange, normalizeCampaign, normalizeKeyword, normalizeRecommendation, normalizeSearchTerm, summarizeCampaigns } from "./googleAdsNormalize.js";
import { searchGoogleAds, validateGoogleAdsAccess, type GoogleAdsFetch } from "./googleAdsRestClient.js";
import { createDbAdsGoogleStore, type AdsGoogleStore } from "./googleAdsStore.js";
import type { AdsAccountSummary, AdsCampaign, AdsKeyword, AdsRecommendation, AdsSearchTerm } from "./googleAdsTypes.js";
import type { AdsAgentContext } from "./types.js";

function dateClause(range?: { from?: string; to?: string }) {
  if (range?.from && range?.to && /^\d{4}-\d{2}-\d{2}$/.test(range.from) && /^\d{4}-\d{2}-\d{2}$/.test(range.to)) {
    return `segments.date BETWEEN '${range.from}' AND '${range.to}'`;
  }
  return "segments.date DURING LAST_30_DAYS";
}

export async function markConnectionValidated(store: AdsGoogleStore) {
  const connection = await store.getConnection();
  if (!connection) return;
  await store.upsertConnection({
    encrypted_tokens: connection.encrypted_tokens,
    token_expires_at: connection.token_expires_at,
    granted_scope: connection.granted_scope,
    status: "connected",
    validated_at: new Date(),
    connected_by_user_id: connection.connected_by_user_id,
  });
}

export async function validateStoredGoogleAdsConnection(store: AdsGoogleStore, fetcher?: GoogleAdsFetch) {
  const { accessToken } = await getValidAdsAccessToken(store, undefined, { forceRefresh: true });
  const validated = await validateGoogleAdsAccess({ accessToken, fetcher });
  await markConnectionValidated(store);
  return validated;
}

export async function loadCampaignPerformance(input: {
  store: AdsGoogleStore;
  range?: { from?: string; to?: string };
  campaignId?: string;
  fetcher?: GoogleAdsFetch;
}): Promise<AdsCampaign[]> {
  const { accessToken } = await getValidAdsAccessToken(input.store);
  const filters = [dateClause(input.range)];
  if (input.campaignId && /^\d+$/.test(input.campaignId)) {
    filters.push(`campaign.id = ${input.campaignId}`);
  }
  const rows = await searchGoogleAds({
    accessToken,
    fetcher: input.fetcher,
    query: `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign_budget.amount_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE ${filters.join(" AND ")}
    `.replace(/\s+/g, " ").trim(),
  });
  return rows.map((row) => normalizeCampaign(row));
}

export async function loadAccountSummary(input: {
  store: AdsGoogleStore;
  range?: { from?: string; to?: string };
  fetcher?: GoogleAdsFetch;
}): Promise<AdsAccountSummary> {
  const campaigns = await loadCampaignPerformance(input);
  const summary = summarizeCampaigns(campaigns, input.range?.from && input.range.to
    ? { from: input.range.from, to: input.range.to, label: `${input.range.from} to ${input.range.to}` }
    : last30DayRange());
  try {
    const { accessToken } = await getValidAdsAccessToken(input.store);
    const validated = await validateGoogleAdsAccess({ accessToken, fetcher: input.fetcher });
    summary.descriptiveName = validated.descriptiveName;
  } catch {
    // Summary metrics still stand if the lightweight customer lookup fails after campaigns loaded.
  }
  return summary;
}

export async function loadKeywordPerformance(input: {
  store: AdsGoogleStore;
  range?: { from?: string; to?: string };
  fetcher?: GoogleAdsFetch;
}): Promise<AdsKeyword[]> {
  const { accessToken } = await getValidAdsAccessToken(input.store);
  const rows = await searchGoogleAds({
    accessToken,
    fetcher: input.fetcher,
    query: `
      SELECT
        ad_group_criterion.criterion_id,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.cost_micros,
        metrics.conversions
      FROM keyword_view
      WHERE ${dateClause(input.range)}
    `.replace(/\s+/g, " ").trim(),
  });
  return rows.map((row) => normalizeKeyword(row));
}

export async function loadSearchTerms(input: {
  store: AdsGoogleStore;
  range?: { from?: string; to?: string };
  fetcher?: GoogleAdsFetch;
}): Promise<AdsSearchTerm[]> {
  const { accessToken } = await getValidAdsAccessToken(input.store);
  const rows = await searchGoogleAds({
    accessToken,
    fetcher: input.fetcher,
    query: `
      SELECT
        search_term_view.search_term,
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM search_term_view
      WHERE ${dateClause(input.range)}
    `.replace(/\s+/g, " ").trim(),
  });
  return rows.map((row) => normalizeSearchTerm(row));
}

export async function loadGoogleRecommendations(input: {
  store: AdsGoogleStore;
  fetcher?: GoogleAdsFetch;
}): Promise<AdsRecommendation[]> {
  const { accessToken } = await getValidAdsAccessToken(input.store);
  const rows = await searchGoogleAds({
    accessToken,
    fetcher: input.fetcher,
    query: "SELECT recommendation.resource_name, recommendation.type, recommendation.campaign FROM recommendation",
  });
  return rows.map((row) => normalizeRecommendation(row));
}

export function reportingStore(db: Database): AdsGoogleStore {
  return createDbAdsGoogleStore(db);
}
