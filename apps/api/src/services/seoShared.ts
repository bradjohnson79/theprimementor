import puppeteer from "puppeteer";
import {
  seoAudits,
  seoSettings,
  type Database,
  type SeoKeywordBuckets,
  type SeoRecommendationSnapshot,
  type SeoRecommendationValue,
} from "@wisdom/db";
import {
  SEO_PAGE_OPTIONS,
  SEO_PAGE_REGISTRY,
  SEO_PAGES,
  type SeoAuditablePageKey,
  type SeoPageIntent,
  type SeoPageKey,
  type SeoPageRegistryItem,
} from "@wisdom/utils";
import { desc, eq } from "drizzle-orm";
import { createHttpError } from "./booking/errors.js";

export interface SeoActor {
  actorRole: string;
  actorUserId?: string | null;
}

export interface SeoLogger {
  warn: (payload: Record<string, unknown>, message: string) => void;
  info?: (payload: Record<string, unknown>, message: string) => void;
  error?: (payload: Record<string, unknown>, message: string) => void;
}

export type SeoAuditMode = "quick" | "full";
export type SeoAuditSeverity = "low" | "medium" | "high";
export type SeoRecommendationField = "title" | "meta_description" | "keywords" | "og_image" | "indexing";
export type SeoRecommendationStatus = "pending" | "approved" | "rejected" | "edited";
export type SeoRecommendationAction = "update" | "no_change";
export type SeoChangeSource = "manual" | "ai_approved" | "ai_edited" | "rollback";

export interface SeoPageContent {
  pageKey: SeoAuditablePageKey;
  url: string;
  pageTitle: string;
  content: string | null;
}

const SCRAPE_CACHE_TTL_MS = 15 * 60 * 1000;
const SCRAPE_CHAR_LIMIT = 4000;
const scrapeCache = new Map<string, { expiresAt: number; value: SeoPageContent }>();

const LEGACY_PAGE_TARGETS: Partial<Record<SeoAuditablePageKey, { path: string; selector: string }[]>> = {
  home: [{ path: "/", selector: "main" }],
  sessions: [
    { path: "/sessions", selector: "main" },
    { path: "/", selector: "#sessions" },
  ],
  reports: [
    { path: "/reports", selector: "main" },
    { path: "/", selector: "#reports" },
  ],
  subscriptions: [
    { path: "/subscriptions", selector: "main" },
    { path: "/membership-signup", selector: "main" },
  ],
  events: [
    { path: "/events", selector: "main" },
    { path: "/", selector: "#events" },
  ],
  about: [
    { path: "/about", selector: "main" },
    { path: "/", selector: "#about" },
  ],
  contact: [{ path: "/contact", selector: "main" }],
};

export function assertAdminAccess(actor: SeoActor) {
  if (actor.actorRole !== "admin") {
    throw createHttpError(403, "Admin SEO access required");
  }
}

export function getSiteOrigin() {
  return process.env.PUBLIC_SITE_URL?.trim() || "https://www.theprimementor.com";
}

export function normalizeOptionalText(value: string | null | undefined) {
  const next = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return next.length > 0 ? next : null;
}

export function normalizeKeywords(
  value: SeoKeywordBuckets | Partial<Record<keyof SeoKeywordBuckets, string[]>> | null | undefined,
): SeoKeywordBuckets {
  const primary = Array.from(new Set((value?.primary ?? []).map((entry) => entry.trim()).filter(Boolean)));
  const secondary = Array.from(new Set((value?.secondary ?? []).map((entry) => entry.trim()).filter(Boolean)));
  return { primary, secondary };
}

export function normalizeRecommendationValue(value: SeoRecommendationValue | undefined): SeoRecommendationValue {
  if (typeof value === "string") {
    return normalizeOptionalText(value);
  }
  if (typeof value === "boolean" || value === null) {
    return value;
  }
  if (value && typeof value === "object") {
    return normalizeKeywords(value);
  }
  return null;
}

export function normalizeSnapshot(snapshot: Partial<SeoRecommendationSnapshot> | null | undefined): SeoRecommendationSnapshot {
  return {
    title: normalizeOptionalText(snapshot?.title),
    metaDescription: normalizeOptionalText(snapshot?.metaDescription),
    keywords: normalizeKeywords(snapshot?.keywords),
    ogImage: normalizeOptionalText(snapshot?.ogImage),
    robotsIndex: snapshot?.robotsIndex ?? true,
  };
}

export function emptySnapshot(): SeoRecommendationSnapshot {
  return normalizeSnapshot(undefined);
}

export function isSeoPageKey(value: string): value is SeoPageKey {
  return Object.values(SEO_PAGES).includes(value as SeoPageKey);
}

export function assertSeoPageKey(value: string | undefined): SeoPageKey {
  const next = typeof value === "string" ? value.trim() : "";
  if (!isSeoPageKey(next)) {
    throw createHttpError(400, "Invalid SEO page key");
  }
  return next;
}

export function assertAuditableSeoPageKey(value: string | undefined): SeoAuditablePageKey {
  const next = assertSeoPageKey(value);
  if (next === SEO_PAGES.global) {
    throw createHttpError(400, "Global SEO defaults are not an auditable page");
  }
  return next;
}

export function getSeoPageOption(pageKey: SeoPageKey) {
  return SEO_PAGE_OPTIONS.find((page) => page.key === pageKey) ?? null;
}

export function getSeoRegistryEntry(pageKey: SeoAuditablePageKey) {
  return SEO_PAGE_REGISTRY.find((page) => page.key === pageKey) ?? null;
}

export function getAuditableSeoPages(): SeoPageRegistryItem[] {
  return SEO_PAGE_REGISTRY;
}

export function getIntentLabel(intent: SeoPageIntent) {
  return intent;
}

export function getFieldValue(
  snapshot: SeoRecommendationSnapshot,
  field: SeoRecommendationField,
): SeoRecommendationValue {
  switch (field) {
    case "title":
      return snapshot.title;
    case "meta_description":
      return snapshot.metaDescription;
    case "keywords":
      return snapshot.keywords;
    case "og_image":
      return snapshot.ogImage;
    case "indexing":
      return snapshot.robotsIndex;
  }
}

export function applyFieldValueToSnapshot(
  snapshot: SeoRecommendationSnapshot,
  field: SeoRecommendationField,
  value: SeoRecommendationValue,
): SeoRecommendationSnapshot {
  const current = normalizeSnapshot(snapshot);
  switch (field) {
    case "title":
      return { ...current, title: typeof value === "string" ? normalizeOptionalText(value) : null };
    case "meta_description":
      return { ...current, metaDescription: typeof value === "string" ? normalizeOptionalText(value) : null };
    case "keywords":
      return { ...current, keywords: normalizeKeywords((value as SeoKeywordBuckets | null | undefined) ?? undefined) };
    case "og_image":
      return { ...current, ogImage: typeof value === "string" ? normalizeOptionalText(value) : null };
    case "indexing":
      return { ...current, robotsIndex: typeof value === "boolean" ? value : current.robotsIndex };
  }
}

export async function getCurrentSeoSnapshot(db: Database, pageKey: SeoPageKey) {
  const [row] = await db
    .select()
    .from(seoSettings)
    .where(eq(seoSettings.page_key, pageKey))
    .limit(1);

  if (!row) {
    return emptySnapshot();
  }

  return normalizeSnapshot({
    title: row.title,
    metaDescription: row.meta_description,
    keywords: row.keywords,
    ogImage: row.og_image,
    robotsIndex: row.robots_index,
  });
}

export async function listCurrentSeoSnapshots(db: Database) {
  const rows = await db.select().from(seoSettings);
  return new Map(
    rows.map((row) => [
      row.page_key as SeoPageKey,
      normalizeSnapshot({
        title: row.title,
        metaDescription: row.meta_description,
        keywords: row.keywords,
        ogImage: row.og_image,
        robotsIndex: row.robots_index,
      }),
    ]),
  );
}

export async function getPreviousAuditSummary(db: Database) {
  const [previous] = await db
    .select({
      summaryJson: seoAudits.summary_json,
    })
    .from(seoAudits)
    .where(eq(seoAudits.status, "complete"))
    .orderBy(desc(seoAudits.created_at))
    .limit(1);

  return previous?.summaryJson ?? null;
}

function getCachedScrape(key: string) {
  const cached = scrapeCache.get(key);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    scrapeCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedScrape(key: string, value: SeoPageContent) {
  scrapeCache.set(key, {
    value,
    expiresAt: Date.now() + SCRAPE_CACHE_TTL_MS,
  });
}

export async function scrapeSeoPageContent(
  pageKey: SeoAuditablePageKey,
  logger: SeoLogger,
): Promise<SeoPageContent> {
  const siteOrigin = getSiteOrigin().replace(/\/+$/, "");
  const targets = LEGACY_PAGE_TARGETS[pageKey] ?? [{ path: getSeoRegistryEntry(pageKey)?.path ?? "/", selector: "main" }];

  for (const target of targets) {
    const cacheKey = `${siteOrigin}:${pageKey}:${target.path}:${target.selector}`;
    const cached = getCachedScrape(cacheKey);
    if (cached) {
      return cached;
    }

    const targetUrl = `${siteOrigin}${target.path}`;
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    try {
      const page = await browser.newPage();
      await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 45000 });
      await page.waitForSelector(target.selector, { timeout: 15000 }).catch(() => undefined);

      const extracted = await page.evaluate(({ selector, pageKey: pageKeyArg }) => {
        const normalize = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim();
        const selectorNode = document.querySelector(selector) || document.querySelector("main") || document.body;
        const root = selectorNode.cloneNode(true) as HTMLElement;
        for (const entry of root.querySelectorAll("nav,header,footer,aside,button,form,script,style,noscript,svg,[role='navigation'],[aria-hidden='true']")) {
          entry.remove();
        }

        const parts: string[] = [];
        const sectionLabel = normalize((selectorNode as HTMLElement | null)?.getAttribute?.("id") || pageKeyArg);
        if (sectionLabel) {
          parts.push(sectionLabel);
        }

        const nodes = root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li");
        const seen = new Set<string>();
        for (const node of nodes) {
          const text = normalize(node.textContent);
          if (text.length < 18 || seen.has(text)) {
            continue;
          }
          seen.add(text);
          parts.push(text);
        }

        return {
          pageTitle: normalize(document.title),
          content: parts.join("\n").slice(0, 5000),
        };
      }, { selector: target.selector, pageKey });

      const content = normalizeOptionalText(extracted.content)?.slice(0, SCRAPE_CHAR_LIMIT) ?? null;
      const result: SeoPageContent = {
        pageKey,
        url: targetUrl,
        pageTitle: extracted.pageTitle || "The Prime Mentor",
        content,
      };
      setCachedScrape(cacheKey, result);
      return result;
    } catch (error) {
      logger.warn(
        {
          pageKey,
          targetUrl,
          error: error instanceof Error ? error.message : String(error),
        },
        "seo_page_scrape_attempt_failed",
      );
    } finally {
      await browser.close().catch(() => {});
    }
  }

  return {
    pageKey,
    url: `${siteOrigin}${getSeoRegistryEntry(pageKey)?.path ?? "/"}`,
    pageTitle: "The Prime Mentor",
    content: null,
  };
}
