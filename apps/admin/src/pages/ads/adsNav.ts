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

export const ADS_NAV: Array<{
  to: string;
  section: AdsSection;
  label: string;
  end?: boolean;
}> = [
  { to: "/admin/ads", section: "command_center", label: "Command Center", end: true },
  { to: "/admin/ads/campaigns", section: "campaigns", label: "Campaigns" },
  { to: "/admin/ads/ad-groups", section: "ad_groups", label: "Ad Groups" },
  { to: "/admin/ads/ad-copy", section: "ad_copy", label: "Ads" },
  { to: "/admin/ads/keywords", section: "keywords", label: "Keywords" },
  { to: "/admin/ads/keyword-strategy", section: "keyword_strategy", label: "Keyword Strategy" },
  { to: "/admin/ads/search-terms", section: "search_terms", label: "Search Terms" },
  { to: "/admin/ads/conversions", section: "conversions", label: "Conversions" },
  { to: "/admin/ads/opportunities", section: "opportunities", label: "Opportunities" },
  { to: "/admin/ads/campaign-lab", section: "campaign_lab", label: "Campaign Lab" },
  { to: "/admin/ads/divin8-intelligence", section: "divin8_intelligence", label: "Divin8 Intelligence" },
  { to: "/admin/ads/settings", section: "settings", label: "Settings" },
];

export function adsSectionFromPath(pathname: string): AdsSection {
  const match = ADS_NAV
    .filter((item) => item.to !== "/admin/ads")
    .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
  return match?.section ?? "command_center";
}

export function adsSectionLabel(section: AdsSection) {
  return ADS_NAV.find((item) => item.section === section)?.label ?? "Command Center";
}
