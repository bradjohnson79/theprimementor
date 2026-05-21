export const analyticsHelperText = {
  entryPages:
    "Entry pages show where visitors begin their journey. High-performing entry pages should be optimized with clear CTAs, trust-building copy, and next-step pathways.",
  exitPages:
    "Exit pages reveal where users are dropping off. If key sales pages have high exits, review CTA clarity, page speed, offer strength, and checkout friction.",
  devices:
    "Device data helps reveal whether Prime Mentor should prioritize desktop, mobile, or tablet layout improvements.",
  browsers:
    "Browser data helps identify where compatibility testing should be prioritized.",
  geography:
    "Geographic data helps identify where Prime Mentor is gaining attention and where ads, newsletters, and group promotion may be worth focusing.",
  campaigns:
    "UTM tracking helps measure which Facebook group posts, newsletters, YouTube links, ads, or campaigns are actually bringing traffic.",
  conversionPaths:
    "Conversion paths show traffic moving toward report, session, subscription, account, checkout, and member-area routes.",
  recommendations:
    "Recommendations are rule-based and use only visible analytics signals from this reporting period.",
};

export const utmEmptyState =
  "No campaign tracking data found for this period. Use UTM links in future Facebook group posts, newsletters, YouTube descriptions, and ad campaigns to measure which promotions are actually bringing traffic.";

export const utmExample = "?utm_source=facebook&utm_medium=group_post&utm_campaign=regeneration_monthly";

export const conversionRouteLabels = [
  { prefix: "/sessions/regeneration", label: "Regeneration Monthly Package interest" },
  { prefix: "/subscriptions/initiate", label: "Initiate subscription interest" },
  { prefix: "/subscriptions/seeker", label: "Seeker subscription interest" },
  { prefix: "/reports", label: "Divin8 Reports interest" },
  { prefix: "/sessions", label: "Private session interest" },
  { prefix: "/sign-up", label: "Account creation step" },
  { prefix: "/sign-in", label: "Returning user login" },
  { prefix: "/checkout", label: "Purchase/checkout step" },
  { prefix: "/dashboard", label: "Member area" },
];

export function getConversionRouteLabel(path: string) {
  const normalized = path === "/" ? path : path.replace(/\/+$/, "");
  return conversionRouteLabels.find((route) =>
    normalized === route.prefix || normalized.startsWith(`${route.prefix}/`),
  )?.label ?? null;
}
