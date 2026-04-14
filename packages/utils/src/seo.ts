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

export interface SeoPageOption {
  key: SeoPageKey;
  label: string;
  description: string;
}

export const SEO_PAGE_OPTIONS: SeoPageOption[] = [
  {
    key: SEO_PAGES.global,
    label: "Global",
    description: "Default metadata and fallback keyword direction used across the site.",
  },
  {
    key: SEO_PAGES.home,
    label: "Home",
    description: "Homepage messaging, featured services, and main brand discovery surface.",
  },
  {
    key: SEO_PAGES.sessions,
    label: "Sessions",
    description: "Session booking routes and service discovery for 1:1 work.",
  },
  {
    key: SEO_PAGES.reports,
    label: "Reports",
    description: "Report purchase and delivery pages for Divin8 blueprint products.",
  },
  {
    key: SEO_PAGES.subscriptions,
    label: "Subscriptions",
    description: "Membership plan pages and Prime Mentor recurring offers.",
  },
  {
    key: SEO_PAGES.events,
    label: "Events",
    description: "Mentoring Circle and live event discovery surfaces.",
  },
  {
    key: SEO_PAGES.about,
    label: "About",
    description: "Brand story, authority signals, and founder context.",
  },
  {
    key: SEO_PAGES.contact,
    label: "Contact",
    description: "Support, contact, and issue reporting page metadata.",
  },
];
