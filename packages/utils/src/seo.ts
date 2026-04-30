export const SEO_PAGES = {
  global: "global",
  home: "home",
  sessions: "sessions",
  reports: "reports",
  subscriptions: "subscriptions",
  events: "events",
  about: "about",
  contact: "contact",
} as const;

export type SeoPageKey = typeof SEO_PAGES[keyof typeof SEO_PAGES];
export type SeoAuditablePageKey = Exclude<SeoPageKey, typeof SEO_PAGES.global>;
export type SeoPageIntent = "authority" | "conversion" | "product" | "engagement" | "trust" | "clarity";

export interface SeoPageOption {
  key: SeoPageKey;
  label: string;
  description: string;
}

export interface SeoPageRegistryItem extends SeoPageOption {
  key: SeoAuditablePageKey;
  path: string;
  intent: SeoPageIntent;
}

export const SEO_PAGE_REGISTRY: SeoPageRegistryItem[] = [
  {
    key: SEO_PAGES.home,
    path: "/",
    intent: "authority",
    label: "Home",
    description: "Homepage messaging, featured services, and main brand discovery surface.",
  },
  {
    key: SEO_PAGES.sessions,
    path: "/sessions",
    intent: "conversion",
    label: "Sessions",
    description: "Session booking routes and service discovery for 1:1 work.",
  },
  {
    key: SEO_PAGES.reports,
    path: "/reports",
    intent: "product",
    label: "Reports",
    description: "Report purchase and delivery pages for Divin8 blueprint products.",
  },
  {
    key: SEO_PAGES.subscriptions,
    path: "/subscriptions",
    intent: "conversion",
    label: "Subscriptions",
    description: "Membership plan pages and Prime Mentor recurring offers.",
  },
  {
    key: SEO_PAGES.events,
    path: "/events",
    intent: "engagement",
    label: "Events",
    description: "Mentoring Circle and live event discovery surfaces.",
  },
  {
    key: SEO_PAGES.about,
    path: "/about",
    intent: "trust",
    label: "About",
    description: "Brand story, authority signals, and founder context.",
  },
  {
    key: SEO_PAGES.contact,
    path: "/contact",
    intent: "clarity",
    label: "Contact",
    description: "Support, contact, and issue reporting page metadata.",
  },
];

export const SEO_PAGE_OPTIONS: SeoPageOption[] = [
  {
    key: SEO_PAGES.global,
    label: "Global",
    description: "Default metadata and fallback keyword direction used across the site.",
  },
  ...SEO_PAGE_REGISTRY.map(({ key, label, description }) => ({
    key,
    label,
    description,
  })),
];
