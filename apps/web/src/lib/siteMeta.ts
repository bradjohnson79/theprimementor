import { HERO_SUBLINE, HERO_SUBLINE_SUPPORTING } from "./brandCopy";

export const SITE_ORIGIN = "https://theprimementor.com";
export const SITE_NAME = "The Prime Mentor";
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/images/divin8-reports-og.webp`;

export const HOME_META = {
  title: `The Prime Mentor | ${HERO_SUBLINE}`,
  description: `${HERO_SUBLINE} ${HERO_SUBLINE_SUPPORTING}`,
};

export function pageCanonical(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized.replace(/ /g, "%20")}`;
}
