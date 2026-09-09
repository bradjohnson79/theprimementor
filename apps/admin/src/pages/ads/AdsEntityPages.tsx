import AdsReportingTable from "./AdsReportingTable";
import { formatAdsNumber, type AdsAd, type AdsAdGroup, type AdsKeyword } from "./adsApi";

export function AdsAdGroups() {
  return (
    <AdsReportingTable<AdsAdGroup>
      title="Ad Groups"
      path="/admin/ads/reporting/ad-groups"
      testId="ad-groups"
      emptyLabel="No ad groups were found in the connected account."
      rowKey={(row) => row.id}
      columns={[
        { key: "name", label: "Ad Group", render: (row) => row.name },
        { key: "campaign", label: "Campaign", render: (row) => row.campaignName || "—" },
        { key: "status", label: "Status", render: (row) => row.status },
        { key: "type", label: "Type", render: (row) => row.type },
        { key: "spend", label: "Spend", render: (row) => formatAdsNumber(row.cost, "money") },
        { key: "impressions", label: "Impressions", render: (row) => formatAdsNumber(row.impressions) },
        { key: "clicks", label: "Clicks", render: (row) => formatAdsNumber(row.clicks) },
        { key: "ctr", label: "CTR", render: (row) => formatAdsNumber(row.ctr, "percent") },
        { key: "conversions", label: "Conversions", render: (row) => formatAdsNumber(row.conversions) },
        { key: "cpa", label: "Cost per Conversion", render: (row) => formatAdsNumber(row.costPerConversion, "money") },
      ]}
    />
  );
}

export function AdsAdCopy() {
  return (
    <AdsReportingTable<AdsAd>
      title="Ads"
      path="/admin/ads/reporting/ads"
      testId="ads"
      emptyLabel="No ads were found in the connected account."
      rowKey={(row) => row.id}
      columns={[
        { key: "name", label: "Ad", render: (row) => row.name },
        { key: "campaign", label: "Campaign", render: (row) => row.campaignName || "—" },
        { key: "adGroup", label: "Ad Group", render: (row) => row.adGroupName || "—" },
        { key: "status", label: "Status", render: (row) => row.status },
        { key: "type", label: "Type", render: (row) => row.type },
        { key: "headlines", label: "Headlines", render: (row) => row.headlines.slice(0, 2).join(" · ") || "—" },
        { key: "spend", label: "Spend", render: (row) => formatAdsNumber(row.cost, "money") },
        { key: "impressions", label: "Impressions", render: (row) => formatAdsNumber(row.impressions) },
        { key: "clicks", label: "Clicks", render: (row) => formatAdsNumber(row.clicks) },
        { key: "ctr", label: "CTR", render: (row) => formatAdsNumber(row.ctr, "percent") },
        { key: "conversions", label: "Conversions", render: (row) => formatAdsNumber(row.conversions) },
      ]}
    />
  );
}

export function AdsKeywords() {
  return (
    <AdsReportingTable<AdsKeyword>
      title="Keywords"
      path="/admin/ads/reporting/keywords"
      testId="keywords"
      emptyLabel="No keywords were found in the connected account."
      rowKey={(row) => row.id}
      columns={[
        { key: "keyword", label: "Keyword", render: (row) => row.keyword },
        { key: "match", label: "Match", render: (row) => row.matchType },
        { key: "campaign", label: "Campaign", render: (row) => row.campaignName || "—" },
        { key: "adGroup", label: "Ad Group", render: (row) => row.adGroupName || "—" },
        { key: "status", label: "Status", render: (row) => row.negative ? "NEGATIVE" : row.status },
        { key: "spend", label: "Spend", render: (row) => formatAdsNumber(row.cost, "money") },
        { key: "impressions", label: "Impressions", render: (row) => formatAdsNumber(row.impressions) },
        { key: "clicks", label: "Clicks", render: (row) => formatAdsNumber(row.clicks) },
        { key: "ctr", label: "CTR", render: (row) => formatAdsNumber(row.ctr, "percent") },
        { key: "conversions", label: "Conversions", render: (row) => formatAdsNumber(row.conversions) },
      ]}
    />
  );
}
