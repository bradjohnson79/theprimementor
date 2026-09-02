import type { Database } from "@wisdom/db";
import { getValidAdsAccessToken } from "./googleAdsOAuthService.js";
import { collapseKeywordRows, last30DayRange, normalizeCampaign, normalizeKeyword, normalizeRecommendation, normalizeSearchTerm, summarizeCampaigns } from "./googleAdsNormalize.js";
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

export async function retryStoredGoogleAdsValidation(store: AdsGoogleStore, fetcher?: GoogleAdsFetch) {
  try {
    return await validateStoredGoogleAdsConnection(store, fetcher);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String((error as { code?: string }).code) : "";
    const status = code === "GOOGLE_ADS_OAUTH_INVALID"
      ? "auth_error"
      : code === "GOOGLE_ADS_DEVELOPER_TOKEN_ERROR"
        ? "developer_token_error"
        : code === "GOOGLE_ADS_CUSTOMER_ACCESS_ERROR"
          ? "access_error"
          : "api_error";
    const connection = await store.getConnection();
    if (connection) {
      await store.upsertConnection({ ...connection, status, validated_at: null });
    }
    throw error;
  }
}

const campaignSnapshotTtlMs = 45_000;
const campaignSnapshots = new Map<string, { expires: number; campaigns: AdsCampaign[] }>();

function campaignSnapshotKey(input: {
  range?: { from?: string; to?: string };
  campaignId?: string;
}) {
  return `${input.campaignId || "all"}:${dateClause(input.range)}`;
}

export async function loadCampaignPerformance(input: {
  store: AdsGoogleStore;
  range?: { from?: string; to?: string };
  campaignId?: string;
  fetcher?: GoogleAdsFetch;
}): Promise<AdsCampaign[]> {
  const key = campaignSnapshotKey(input);
  const cached = campaignSnapshots.get(key);
  if (cached && cached.expires > Date.now()) return cached.campaigns;
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
  const campaigns = rows.map((row) => normalizeCampaign(row));
  campaignSnapshots.set(key, { expires: Date.now() + campaignSnapshotTtlMs, campaigns });
  return campaigns;
}

export async function loadAccountSummary(input: {
  store: AdsGoogleStore;
  range?: { from?: string; to?: string };
  fetcher?: GoogleAdsFetch;
}): Promise<AdsAccountSummary> {
  const campaigns = await loadCampaignPerformance(input);
  return summarizeCampaigns(campaigns, input.range?.from && input.range.to
    ? { from: input.range.from, to: input.range.to, label: `${input.range.from} to ${input.range.to}` }
    : last30DayRange());
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
        ad_group_criterion.status,
        ad_group_criterion.negative,
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
  return collapseKeywordRows(rows.map((row) => normalizeKeyword(row)));
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
