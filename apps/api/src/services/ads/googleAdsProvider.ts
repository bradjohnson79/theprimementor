import type { Database } from "@wisdom/db";
import { serializeGoogleAdsStatus, type GoogleAdsPublicStatus } from "./googleAdsConnectionService.js";
import {
  loadAccountSummary,
  loadCampaignPerformance,
  loadGoogleRecommendations,
  loadKeywordPerformance,
  loadSearchTerms,
} from "./googleAdsReportingService.js";
import { createDbAdsGoogleStore, type AdsGoogleStore } from "./googleAdsStore.js";
import type { AdsAccountSummary, AdsCampaign, AdsKeyword, AdsRecommendation, AdsSearchTerm } from "./googleAdsTypes.js";
import type { AdsAgentContext, AdsCapabilityMode } from "./types.js";

export type GoogleAdsUnavailable = {
  available: false;
  reason: AdsCapabilityMode | "UNKNOWN_TOOL";
  message: string;
};

export type GoogleAdsAvailable<T> = {
  available: true;
  data: T;
};

export interface GoogleAdsReportingService {
  getAccountSummary(range?: { from?: string; to?: string }): Promise<GoogleAdsUnavailable | GoogleAdsAvailable<AdsAccountSummary>>;
  getCampaignPerformance(range?: { from?: string; to?: string }): Promise<GoogleAdsUnavailable | GoogleAdsAvailable<AdsCampaign[]>>;
  getCampaignDetails(context?: AdsAgentContext): Promise<GoogleAdsUnavailable | GoogleAdsAvailable<AdsCampaign[]>>;
  compareDateRanges(args?: { from?: string; to?: string; compareFrom?: string; compareTo?: string }): Promise<GoogleAdsUnavailable | GoogleAdsAvailable<{ current: AdsAccountSummary; previous: AdsAccountSummary }>>;
  getAdGroupPerformance(): Promise<GoogleAdsUnavailable>;
  getKeywordPerformance(range?: { from?: string; to?: string }): Promise<GoogleAdsUnavailable | GoogleAdsAvailable<AdsKeyword[]>>;
  getSearchTerms(range?: { from?: string; to?: string }): Promise<GoogleAdsUnavailable | GoogleAdsAvailable<AdsSearchTerm[]>>;
  getConversionPerformance(): Promise<GoogleAdsUnavailable | GoogleAdsAvailable<AdsAccountSummary>>;
  getAdPerformance(): Promise<GoogleAdsUnavailable>;
  getGoogleRecommendations(): Promise<GoogleAdsUnavailable | GoogleAdsAvailable<AdsRecommendation[]>>;
}

export interface GoogleAdsConnectionService {
  getStatus(): Promise<GoogleAdsPublicStatus>;
  getMode(): Promise<AdsCapabilityMode>;
}

export interface GoogleAdsProvider {
  connection: GoogleAdsConnectionService;
  reporting: GoogleAdsReportingService;
}

const DISCONNECTED: GoogleAdsUnavailable = {
  available: false,
  reason: "DISCONNECTED",
  message: "Google Ads has not been connected yet.",
};

async function requireReadOnly(store: AdsGoogleStore): Promise<GoogleAdsUnavailable | null> {
  const status = await serializeGoogleAdsStatus(store);
  if (status.mode !== "READ_ONLY") return DISCONNECTED;
  return null;
}

export function createGoogleAdsProvider(store: AdsGoogleStore): GoogleAdsProvider {
  return {
    connection: {
      getStatus: () => serializeGoogleAdsStatus(store),
      getMode: async () => (await serializeGoogleAdsStatus(store)).mode,
    },
    reporting: {
      async getAccountSummary(range) {
        return await requireReadOnly(store) ?? { available: true, data: await loadAccountSummary({ store, range }) };
      },
      async getCampaignPerformance(range) {
        return await requireReadOnly(store) ?? { available: true, data: await loadCampaignPerformance({ store, range }) };
      },
      async getCampaignDetails(context) {
        return await requireReadOnly(store) ?? {
          available: true,
          data: await loadCampaignPerformance({ store, campaignId: context?.entityId, range: context?.dateRange }),
        };
      },
      async compareDateRanges(args) {
        const blocked = await requireReadOnly(store);
        if (blocked) return blocked;
        const currentRange = args?.from && args.to ? { from: args.from, to: args.to } : undefined;
        const previousRange = args?.compareFrom && args.compareTo
          ? { from: args.compareFrom, to: args.compareTo }
          : undefined;
        const current = await loadAccountSummary({ store, range: currentRange });
        if (!previousRange) {
          return { available: true, data: { current, previous: current } };
        }
        const previous = await loadAccountSummary({ store, range: previousRange });
        return { available: true, data: { current, previous } };
      },
      async getAdGroupPerformance() {
        return await requireReadOnly(store) ?? {
          available: false,
          reason: "READ_ONLY",
          message: "Ad group reporting is not enabled in this mission.",
        };
      },
      async getKeywordPerformance(range) {
        return await requireReadOnly(store) ?? { available: true, data: await loadKeywordPerformance({ store, range }) };
      },
      async getSearchTerms(range) {
        return await requireReadOnly(store) ?? { available: true, data: await loadSearchTerms({ store, range }) };
      },
      async getConversionPerformance() {
        const result = await this.getAccountSummary();
        return result;
      },
      async getAdPerformance() {
        return await requireReadOnly(store) ?? {
          available: false,
          reason: "READ_ONLY",
          message: "Ad creative reporting is not enabled in this mission.",
        };
      },
      async getGoogleRecommendations() {
        return await requireReadOnly(store) ?? { available: true, data: await loadGoogleRecommendations({ store }) };
      },
    },
  };
}

export function createDisconnectedGoogleAdsProvider(): GoogleAdsProvider {
  return createGoogleAdsProvider({
    async insertOauthState() {},
    async consumeOauthState() { return null; },
    async getConnection() { return null; },
    async upsertConnection() { throw new Error("disconnected"); },
    async deleteConnection() {},
  });
}

export function providerForDatabase(db: Database | null) {
  if (!db) return createDisconnectedGoogleAdsProvider();
  return createGoogleAdsProvider(createDbAdsGoogleStore(db));
}

export const googleAdsProvider = createDisconnectedGoogleAdsProvider();
