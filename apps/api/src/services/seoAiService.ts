import { createHash } from "node:crypto";
import OpenAI from "openai";
import puppeteer from "puppeteer";
import {
  bookings,
  orders,
  seoRecommendations,
  seoRecommendationApplyHistory,
  seoSettings,
  subscriptions,
  type Database,
  type SeoKeywordBuckets,
  type SeoRecommendationSnapshot,
} from "@wisdom/db";
import { SEO_PAGE_OPTIONS, SEO_PAGES, type SeoPageKey } from "@wisdom/utils";
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import {
  getAdminAnalyticsEvents,
  getAdminAnalyticsPageviews,
  getAdminAnalyticsSummary,
  getPreviousRange,
  type AnalyticsRange,
} from "./analyticsService.js";
import { updateSeoSetting } from "./seoService.js";
import { createHttpError } from "./booking/errors.js";

interface SeoActor {
  actorRole: string;
  actorUserId?: string | null;
}

interface SeoLogger {
  warn: (payload: Record<string, unknown>, message: string) => void;
  info?: (payload: Record<string, unknown>, message: string) => void;
  error?: (payload: Record<string, unknown>, message: string) => void;
}

type SeoRecommendationType =
  | "initial_generation"
  | "title_update"
  | "meta_description_update"
  | "keyword_update"
  | "no_change";

type SeoImpact = "low" | "medium" | "high";
type SeoIntent = "informational" | "transactional" | "navigational";
type RecommendationSource = "initial_scan" | "weekly_optimization";
type RecommendationStatus = "pending" | "approved" | "rejected" | "applied" | "superseded";
type PageTrend = "up" | "down" | "stable";
type PagePerformance = "high" | "medium" | "low";

interface StoredRecommendation {
  id: string;
  pageKey: SeoPageKey;
  type: SeoRecommendationType;
  reason: string | null;
  expectedOutcome: string | null;
  currentSnapshot: SeoRecommendationSnapshot;
  suggestedSnapshot: SeoRecommendationSnapshot;
  impact: SeoImpact | null;
  adminImpactOverride: SeoImpact | null;
  intent: SeoIntent | null;
  confidence: number;
  source: RecommendationSource;
  status: RecommendationStatus;
  modelName: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  lastRecommendationAt: string;
  createdAt: string;
  updatedAt: string;
}

interface GenerateRecommendationResult {
  recommendation: StoredRecommendation;
  created: boolean;
}

interface WeeklyRecommendationJobResult {
  range: AnalyticsRange;
  batchSize: number;
  consideredPages: number;
  processedPages: number;
  skippedCooldown: number;
  skippedDuplicates: number;
  storedRecommendations: number;
  highPerformerLocks: number;
  noChangeRecommendations: number;
}

interface ScrapedPageContent {
  pageKey: SeoPageKey;
  url: string;
  pageTitle: string;
  content: string;
}

interface PageAnalyticsInput {
  pageKey: SeoPageKey;
  pageviews: number;
  trend: PageTrend;
  events: number;
  conversions: number;
  previousConversions: number;
  performance: PagePerformance;
  priority: number;
}

interface ParsedInitialSeo {
  title: string;
  metaDescription: string;
  keywords: SeoKeywordBuckets;
  intent: SeoIntent;
  confidence: number;
}

interface ParsedWeeklyRecommendation {
  type: Exclude<SeoRecommendationType, "initial_generation">;
  reason: string | null;
  currentSnapshot: SeoRecommendationSnapshot;
  suggestedSnapshot: SeoRecommendationSnapshot;
  impact: SeoImpact | null;
  confidence: number;
  expectedOutcome: string;
}

interface PageTarget {
  path: string;
  selector: string;
}

interface ScrapeCacheEntry {
  expiresAt: number;
  value: ScrapedPageContent;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = process.env.OPENAI_SEO_MODEL?.trim()
  || process.env.OPENAI_MODEL?.trim()
  || "gpt-4.1";
const PROMPT_VERSION = "seo_ai_v1";
const SCRAPE_CACHE_TTL_MS = 15 * 60 * 1000;
const SCRAPE_CHAR_LIMIT = 4000;
const DEDUPE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_WEEKLY_BATCH_SIZE = 3;
const scrapeCache = new Map<string, ScrapeCacheEntry>();
const BOOKING_CONVERSION_STATUSES = ["paid", "scheduled", "completed"] as const;
const ORDER_CONVERSION_STATUSES = ["completed"] as const;
const SUBSCRIPTION_CONVERSION_STATUSES = ["active", "trialing"] as const;
const SEO_UPDATE_TYPES = new Set<SeoRecommendationType>([
  "initial_generation",
  "title_update",
  "meta_description_update",
  "keyword_update",
]);
const IMPACT_VALUES = new Set<SeoImpact>(["low", "medium", "high"]);
const INTENT_VALUES = new Set<SeoIntent>(["informational", "transactional", "navigational"]);
const PAGE_TARGETS: Record<SeoPageKey, PageTarget> = {
  global: { path: "/", selector: "main" },
  home: { path: "/", selector: "main" },
  sessions: { path: "/", selector: "#sessions" },
  reports: { path: "/", selector: "#reports" },
  subscriptions: { path: "/membership-signup", selector: "main" },
  events: { path: "/", selector: "#events" },
  about: { path: "/", selector: "#about" },
  contact: { path: "/contact", selector: "main" },
};
const HOME_SECTION_PAGE_KEYS = new Set<SeoPageKey>([
  SEO_PAGES.home,
  SEO_PAGES.sessions,
  SEO_PAGES.reports,
  SEO_PAGES.events,
  SEO_PAGES.about,
  SEO_PAGES.global,
]);

function assertAdminAccess(actor: SeoActor) {
  if (actor.actorRole !== "admin") {
    throw createHttpError(403, "Admin SEO access required");
  }
}

function assertOpenAiConfigured() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw createHttpError(503, "OPENAI_API_KEY is not configured");
  }
}

function getSiteOrigin() {
  return process.env.PUBLIC_SITE_URL?.trim() || "https://www.theprimementor.com";
}

function normalizeOptionalText(value: string | null | undefined) {
  const next = typeof value === "string" ? value.trim() : "";
  return next.length > 0 ? next : null;
}

function normalizeTextWithLimit(value: string | null | undefined, limit: number) {
  const next = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!next) {
    return null;
  }
  return next.slice(0, limit).trim();
}

function normalizeKeywords(value: SeoKeywordBuckets | Partial<Record<keyof SeoKeywordBuckets, string[]>> | null | undefined): SeoKeywordBuckets {
  const primary = Array.from(new Set((value?.primary ?? []).map((entry) => entry.trim()).filter(Boolean)));
  const secondary = Array.from(new Set((value?.secondary ?? []).map((entry) => entry.trim()).filter(Boolean)));
  return { primary, secondary };
}

function normalizeSnapshot(snapshot: Partial<SeoRecommendationSnapshot> | null | undefined): SeoRecommendationSnapshot {
  return {
    title: normalizeOptionalText(snapshot?.title ?? null),
    metaDescription: normalizeOptionalText(snapshot?.metaDescription ?? null),
    keywords: normalizeKeywords(snapshot?.keywords),
    ogImage: normalizeOptionalText(snapshot?.ogImage ?? null),
    robotsIndex: snapshot?.robotsIndex ?? true,
  };
}

function emptySnapshot(): SeoRecommendationSnapshot {
  return normalizeSnapshot(undefined);
}

function isSeoPageKey(value: string): value is SeoPageKey {
  return Object.values(SEO_PAGES).includes(value as SeoPageKey);
}

function assertSeoPageKey(value: string | undefined): SeoPageKey {
  const next = typeof value === "string" ? value.trim() : "";
  if (!isSeoPageKey(next)) {
    throw createHttpError(400, "Invalid SEO page key");
  }
  return next;
}

function toStoredRecommendation(row: typeof seoRecommendations.$inferSelect): StoredRecommendation {
  return {
    id: row.id,
    pageKey: row.page_key as SeoPageKey,
    type: row.type,
    reason: row.reason,
    expectedOutcome: row.expected_outcome,
    currentSnapshot: normalizeSnapshot(row.current_snapshot),
    suggestedSnapshot: normalizeSnapshot(row.suggested_snapshot),
    impact: row.impact,
    adminImpactOverride: row.admin_impact_override,
    intent: row.intent,
    confidence: row.confidence,
    source: row.source,
    status: row.status,
    modelName: row.model_name,
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    reviewedBy: row.reviewed_by ?? null,
    lastRecommendationAt: row.last_recommendation_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at?.toISOString() ?? row.created_at.toISOString(),
  };
}

async function getCurrentSnapshot(db: Database, pageKey: SeoPageKey) {
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

function getCachedScrape(cacheKey: string) {
  const cached = scrapeCache.get(cacheKey);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt < Date.now()) {
    scrapeCache.delete(cacheKey);
    return null;
  }
  return cached.value;
}

function setCachedScrape(cacheKey: string, value: ScrapedPageContent) {
  scrapeCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + SCRAPE_CACHE_TTL_MS,
  });
}

async function scrapeLivePageContent(pageKey: SeoPageKey, logger: SeoLogger): Promise<ScrapedPageContent> {
  const siteOrigin = getSiteOrigin().replace(/\/+$/, "");
  const target = PAGE_TARGETS[pageKey];
  const cacheKey = `${siteOrigin}:${pageKey}:${target.path}:${target.selector}`;
  const cached = getCachedScrape(cacheKey);
  if (cached) {
    return cached;
  }

  const targetUrl = `${siteOrigin}${target.path}`;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 45000 });
    await page.waitForSelector(target.selector, { timeout: 15000 }).catch(() => undefined);

    const extracted = await page.evaluate(({ selector, pageKey: pageKeyArg }) => {
      const normalize = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim();
      const selectorNode = document.querySelector(selector) || document.querySelector("main") || document.body;
      const root = selectorNode.cloneNode(true) as HTMLElement;
      const removalSelectors = [
        "nav",
        "header",
        "footer",
        "aside",
        "button",
        "form",
        "script",
        "style",
        "noscript",
        "svg",
        "[role='navigation']",
        "[aria-hidden='true']",
      ];
      for (const entry of root.querySelectorAll(removalSelectors.join(","))) {
        entry.remove();
      }

      const parts: string[] = [];
      const sectionLabel = normalize((selectorNode as HTMLElement | null)?.getAttribute?.("id") || pageKeyArg);
      if (sectionLabel) {
        parts.push(sectionLabel);
      }

      const nodes = root.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li");
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

    const content = normalizeTextWithLimit(extracted.content, SCRAPE_CHAR_LIMIT);
    if (!content) {
      throw new Error(`No scrapeable SEO content found for ${pageKey}`);
    }

    const result = {
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
      "seo_live_scrape_failed",
    );
    throw createHttpError(502, `Unable to fetch live SEO content for ${pageKey}`);
  } finally {
    await browser.close();
  }
}

function createPromptEnvelope(systemPrompt: string, userPrompt: string) {
  return {
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      {
        role: "user" as const,
        content: userPrompt,
      },
    ],
    response_format: { type: "json_object" as const },
    temperature: 0.3,
  };
}

async function requestStructuredJson(systemPrompt: string, userPrompt: string) {
  assertOpenAiConfigured();
  const response = await openai.chat.completions.create(createPromptEnvelope(systemPrompt, userPrompt));
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw createHttpError(502, "OpenAI returned an empty SEO response");
  }

  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw createHttpError(502, "OpenAI returned invalid SEO JSON");
  }
}

const SYSTEM_GUARD_PROMPT = `You must ONLY return valid JSON.

Do NOT include:
- explanations
- markdown
- commentary
- extra text

If unsure, still return best possible structured JSON.`;

function buildInitialPrompt(pageKey: SeoPageKey, pageContent: ScrapedPageContent) {
  return `You are an expert SEO strategist specializing in modern search optimization, user intent modeling, and high-conversion metadata.

Your task is to analyze the provided website page content and generate optimal SEO metadata.

You must:
- Identify the primary search intent of the page
- Extract high-value keywords aligned with intent
- Avoid keyword stuffing
- Prioritize clarity, click-through rate, and relevance
- Write naturally for humans, not just search engines

Return structured SEO data for this page.

---

INPUT:

Page Key: ${pageKey}

Page Content:
${pageContent.content}

Optional Context:
- Site name: The Prime Mentor
- Domain: https://www.theprimementor.com
- Brand tone: spiritual, insightful, transformative, grounded

---

OUTPUT REQUIREMENTS:

Return ONLY valid JSON in this exact format:

{
  "title": "string (max 60 characters, compelling, keyword-aligned)",
  "meta_description": "string (max 155 characters, high CTR, clear benefit)",
  "keywords": {
    "primary": ["string", "string"],
    "secondary": ["string", "string", "string"]
  },
  "intent": "informational | transactional | navigational",
  "confidence": 0.0 to 1.0
}

---

RULES:

- Do not exceed character limits
- Titles must be engaging, not generic
- Meta descriptions must feel like a benefit-driven sentence
- Keywords must be relevant, not broad or spammy
- Avoid repeating the same phrase excessively
- Do not include explanations or extra text outside JSON`;
}

function buildWeeklyPrompt(
  pageKey: SeoPageKey,
  currentSeo: SeoRecommendationSnapshot,
  analytics: Pick<PageAnalyticsInput, "pageviews" | "trend" | "events" | "conversions">,
  pageContent: ScrapedPageContent,
) {
  return `You are an expert SEO analyst focused on performance-driven optimization.

Your task is to analyze page performance data and suggest targeted SEO improvements.

You must:
- Identify underperforming pages
- Preserve high-performing pages unless improvement is clearly justified
- Recommend only meaningful, high-impact changes
- Avoid unnecessary churn or frequent rewriting

---

INPUT:

Page Key: ${pageKey}

Current SEO:
${JSON.stringify(currentSeo, null, 2)}

Analytics Data:
{
  "pageviews": ${analytics.pageviews},
  "trend": "${analytics.trend}",
  "events": ${analytics.events},
  "conversions": ${analytics.conversions}
}

Page Content:
${pageContent.content}

---

OUTPUT REQUIREMENTS:

Return ONLY valid JSON:

{
  "recommendations": [
    {
      "type": "title_update | meta_description_update | keyword_update | no_change",
      "reason": "string explaining why change is needed",
      "current": {
        "title": "string",
        "meta_description": "string"
      },
      "suggested": {
        "title": "string",
        "meta_description": "string"
      },
      "impact": "low | medium | high",
      "confidence": 0.0 to 1.0
    }
  ]
}

---

RULES:

- If the page is performing well, return:
  {
    "recommendations": [
      { "type": "no_change" }
    ]
  }

- Do NOT suggest changes without strong justification
- Avoid rewriting everything - be surgical
- Prioritize CTR and clarity improvements
- Keep titles under 60 chars, descriptions under 155 chars
- No explanations outside JSON`;
}

function readString(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw createHttpError(502, `OpenAI SEO response missing ${fieldName}`);
  }
  const next = value.replace(/\s+/g, " ").trim();
  if (!next) {
    throw createHttpError(502, `OpenAI SEO response missing ${fieldName}`);
  }
  return next;
}

function readOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const next = value.replace(/\s+/g, " ").trim();
  return next || null;
}

function readConfidence(value: unknown) {
  const next = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(next)) {
    throw createHttpError(502, "OpenAI SEO response missing confidence");
  }
  return Math.max(0, Math.min(1, Number(next.toFixed(3))));
}

function readKeywordArray(value: unknown) {
  if (!Array.isArray(value)) {
    throw createHttpError(502, "OpenAI SEO response keywords are invalid");
  }
  return Array.from(new Set(
    value
      .map((entry) => (typeof entry === "string" ? entry.replace(/\s+/g, " ").trim() : ""))
      .filter(Boolean),
  ));
}

function parseInitialSeoResponse(payload: Record<string, unknown>): ParsedInitialSeo {
  const keywordsValue = payload.keywords;
  if (!keywordsValue || typeof keywordsValue !== "object") {
    throw createHttpError(502, "OpenAI SEO response missing keywords");
  }

  const title = readString(payload.title, "title").slice(0, 60);
  const metaDescription = readString(payload.meta_description, "meta_description").slice(0, 155);
  const intent = readString(payload.intent, "intent");
  if (!INTENT_VALUES.has(intent as SeoIntent)) {
    throw createHttpError(502, "OpenAI SEO response returned invalid intent");
  }

  return {
    title,
    metaDescription,
    keywords: normalizeKeywords({
      primary: readKeywordArray((keywordsValue as Record<string, unknown>).primary),
      secondary: readKeywordArray((keywordsValue as Record<string, unknown>).secondary),
    }),
    intent: intent as SeoIntent,
    confidence: readConfidence(payload.confidence),
  };
}

function deriveExpectedOutcome(type: ParsedWeeklyRecommendation["type"]) {
  switch (type) {
    case "title_update":
      return "Higher click-through rate from search results through clearer title positioning.";
    case "meta_description_update":
      return "Stronger search-result conversion through a more benefit-driven meta description.";
    case "keyword_update":
      return "Tighter keyword alignment around the page's actual search intent.";
    case "no_change":
      return "Protect current performance by avoiding unnecessary SEO churn.";
    default:
      return "Establish a clearer SEO baseline aligned with page intent.";
  }
}

export function isSeoRecommendationCoolingDown(lastRecommendationAt: Date, now = Date.now()) {
  return now - lastRecommendationAt.getTime() < COOLDOWN_MS;
}

function parseWeeklySeoResponse(
  payload: Record<string, unknown>,
  currentSnapshot: SeoRecommendationSnapshot,
): ParsedWeeklyRecommendation[] {
  if (!Array.isArray(payload.recommendations) || payload.recommendations.length === 0) {
    throw createHttpError(502, "OpenAI SEO recommendation response is invalid");
  }

  return payload.recommendations.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw createHttpError(502, "OpenAI SEO recommendation entry is invalid");
    }

    const type = readString((entry as Record<string, unknown>).type, "type") as ParsedWeeklyRecommendation["type"];
    if (!["title_update", "meta_description_update", "keyword_update", "no_change"].includes(type)) {
      throw createHttpError(502, "OpenAI SEO recommendation type is invalid");
    }

    if (type === "no_change") {
      return {
        type,
        reason: "The page is performing well enough that no meaningful SEO change is justified right now.",
        currentSnapshot,
        suggestedSnapshot: currentSnapshot,
        impact: "low",
        confidence: 1,
        expectedOutcome: deriveExpectedOutcome(type),
      };
    }

    const impact = readString((entry as Record<string, unknown>).impact, "impact");
    if (!IMPACT_VALUES.has(impact as SeoImpact)) {
      throw createHttpError(502, "OpenAI SEO recommendation impact is invalid");
    }

    const current = (entry as Record<string, unknown>).current;
    const suggested = (entry as Record<string, unknown>).suggested;
    if (!current || typeof current !== "object" || !suggested || typeof suggested !== "object") {
      throw createHttpError(502, "OpenAI SEO recommendation snapshot is invalid");
    }

    return {
      type,
      reason: readString((entry as Record<string, unknown>).reason, "reason"),
      currentSnapshot: normalizeSnapshot({
        ...currentSnapshot,
        title: readOptionalString((current as Record<string, unknown>).title) ?? currentSnapshot.title,
        metaDescription: readOptionalString((current as Record<string, unknown>).meta_description) ?? currentSnapshot.metaDescription,
      }),
      suggestedSnapshot: normalizeSnapshot({
        ...currentSnapshot,
        title: readString((suggested as Record<string, unknown>).title, "suggested.title").slice(0, 60),
        metaDescription: readString((suggested as Record<string, unknown>).meta_description, "suggested.meta_description").slice(0, 155),
      }),
      impact: impact as SeoImpact,
      confidence: readConfidence((entry as Record<string, unknown>).confidence),
      expectedOutcome: deriveExpectedOutcome(type),
    };
  });
}

function buildRecommendationHash(input: {
  pageKey: SeoPageKey;
  type: SeoRecommendationType;
  source: RecommendationSource;
  reason: string | null;
  suggestedSnapshot: SeoRecommendationSnapshot;
}) {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

async function findRecentDuplicateRecommendation(
  db: Database,
  pageKey: SeoPageKey,
  dedupeHash: string,
) {
  const [row] = await db
    .select()
    .from(seoRecommendations)
    .where(and(
      eq(seoRecommendations.page_key, pageKey),
      eq(seoRecommendations.dedupe_hash, dedupeHash),
      inArray(seoRecommendations.status, ["pending", "rejected"]),
      gte(seoRecommendations.created_at, new Date(Date.now() - DEDUPE_WINDOW_MS)),
    ))
    .orderBy(desc(seoRecommendations.created_at))
    .limit(1);

  return row ?? null;
}

async function getLatestRecommendationByPage(db: Database) {
  const rows = await db
    .select({
      pageKey: seoRecommendations.page_key,
      lastRecommendationAt: seoRecommendations.last_recommendation_at,
    })
    .from(seoRecommendations)
    .orderBy(desc(seoRecommendations.last_recommendation_at), desc(seoRecommendations.created_at));

  const latestByPage = new Map<SeoPageKey, Date>();
  for (const row of rows) {
    if (!isSeoPageKey(row.pageKey) || latestByPage.has(row.pageKey)) {
      continue;
    }
    latestByPage.set(row.pageKey, row.lastRecommendationAt);
  }
  return latestByPage;
}

async function supersedePendingRecommendations(
  db: Database,
  pageKey: SeoPageKey,
  source: RecommendationSource,
  keepId: string,
) {
  await db
    .update(seoRecommendations)
    .set({
      status: "superseded",
      updated_at: new Date(),
    })
    .where(and(
      eq(seoRecommendations.page_key, pageKey),
      eq(seoRecommendations.source, source),
      eq(seoRecommendations.status, "pending"),
      lt(seoRecommendations.created_at, new Date()),
    ));

  await db
    .update(seoRecommendations)
    .set({
      status: "pending",
      updated_at: new Date(),
    })
    .where(eq(seoRecommendations.id, keepId));
}

async function persistRecommendation(
  db: Database,
  input: {
    pageKey: SeoPageKey;
    type: SeoRecommendationType;
    reason: string | null;
    expectedOutcome: string;
    currentSnapshot: SeoRecommendationSnapshot;
    suggestedSnapshot: SeoRecommendationSnapshot;
    impact: SeoImpact | null;
    adminImpactOverride?: SeoImpact | null;
    intent: SeoIntent | null;
    confidence: number;
    source: RecommendationSource;
  },
) {
  const dedupeHash = buildRecommendationHash({
    pageKey: input.pageKey,
    type: input.type,
    source: input.source,
    reason: input.reason,
    suggestedSnapshot: input.suggestedSnapshot,
  });
  const duplicate = await findRecentDuplicateRecommendation(db, input.pageKey, dedupeHash);
  if (duplicate) {
    return {
      recommendation: toStoredRecommendation(duplicate),
      created: false,
      duplicate: true,
    };
  }

  const [created] = await db
    .insert(seoRecommendations)
    .values({
      page_key: input.pageKey,
      type: input.type,
      reason: input.reason,
      expected_outcome: input.expectedOutcome,
      current_snapshot: input.currentSnapshot,
      suggested_snapshot: input.suggestedSnapshot,
      impact: input.impact,
      admin_impact_override: input.adminImpactOverride ?? null,
      intent: input.intent,
      confidence: input.confidence,
      source: input.source,
      status: "pending",
      dedupe_hash: dedupeHash,
      model_name: `${OPENAI_MODEL}#${PROMPT_VERSION}`,
      last_recommendation_at: new Date(),
      updated_at: new Date(),
    })
    .returning();

  if (!created) {
    throw createHttpError(500, "Unable to store SEO recommendation");
  }

  await supersedePendingRecommendations(db, input.pageKey, input.source, created.id);

  return {
    recommendation: toStoredRecommendation(created),
    created: true,
    duplicate: false,
  };
}

async function storeNoChangeRecommendation(
  db: Database,
  pageKey: SeoPageKey,
  source: RecommendationSource,
  currentSnapshot: SeoRecommendationSnapshot,
  reason: string,
  confidence = 1,
) {
  return persistRecommendation(db, {
    pageKey,
    type: "no_change",
    reason,
    expectedOutcome: deriveExpectedOutcome("no_change"),
    currentSnapshot,
    suggestedSnapshot: currentSnapshot,
    impact: "low",
    intent: null,
    confidence,
    source,
  });
}

export async function listSeoRecommendations(
  db: Database,
  actor: SeoActor,
  filters?: { pageKey?: string; status?: string },
) {
  assertAdminAccess(actor);
  const conditions = [];

  if (filters?.pageKey) {
    conditions.push(eq(seoRecommendations.page_key, assertSeoPageKey(filters.pageKey)));
  }

  if (filters?.status) {
    const status = filters.status.trim() as RecommendationStatus;
    if (["pending", "approved", "rejected", "applied", "superseded"].includes(status)) {
      conditions.push(eq(seoRecommendations.status, status));
    }
  }

  const rows = await db
    .select()
    .from(seoRecommendations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(seoRecommendations.last_recommendation_at), desc(seoRecommendations.created_at));

  return {
    recommendations: rows.map(toStoredRecommendation),
  };
}

export async function generateInitialSeo(
  db: Database,
  actor: SeoActor,
  pageKeyInput: string,
  logger: SeoLogger,
): Promise<GenerateRecommendationResult> {
  assertAdminAccess(actor);
  const pageKey = assertSeoPageKey(pageKeyInput);
  const currentSnapshot = await getCurrentSnapshot(db, pageKey);
  const scraped = await scrapeLivePageContent(pageKey, logger);
  const parsed = parseInitialSeoResponse(
    await requestStructuredJson(
      SYSTEM_GUARD_PROMPT,
      buildInitialPrompt(pageKey, scraped),
    ),
  );

  const suggestedSnapshot = normalizeSnapshot({
    ...currentSnapshot,
    title: parsed.title,
    metaDescription: parsed.metaDescription,
    keywords: parsed.keywords,
  });

  const result = await persistRecommendation(db, {
    pageKey,
    type: "initial_generation",
    reason: `Initial AI SEO baseline generated from the live ${pageKey} page content.`,
    expectedOutcome: "Establish a keyword-aligned baseline for search visibility and click-through rate.",
    currentSnapshot,
    suggestedSnapshot,
    impact: !currentSnapshot.title || !currentSnapshot.metaDescription ? "high" : "medium",
    intent: parsed.intent,
    confidence: parsed.confidence,
    source: "initial_scan",
  });

  return {
    recommendation: result.recommendation,
    created: result.created,
  };
}

function classifyTrend(current: number, previous: number): PageTrend {
  if (current > previous) {
    return "up";
  }
  if (current < previous) {
    return "down";
  }
  return "stable";
}

function resolvePathMetric(
  pageKey: SeoPageKey,
  topPages: Array<{ path: string; pageviews: number }>,
) {
  const byPath = new Map(topPages.map((row) => [row.path, row.pageviews]));

  if (HOME_SECTION_PAGE_KEYS.has(pageKey)) {
    return byPath.get("/") ?? 0;
  }
  if (pageKey === SEO_PAGES.subscriptions) {
    return byPath.get("/membership-signup") ?? 0;
  }
  if (pageKey === SEO_PAGES.contact) {
    return byPath.get("/contact") ?? 0;
  }
  return 0;
}

async function loadPageConversionStats(db: Database, range: AnalyticsRange) {
  const window = getPreviousRange(range);
  const [bookingRows, orderRows, subscriptionRows] = await Promise.all([
    db.select({
      status: bookings.status,
      sessionType: bookings.session_type,
      createdAt: bookings.created_at,
    }).from(bookings),
    db.select({
      status: orders.status,
      type: orders.type,
      createdAt: orders.created_at,
    }).from(orders),
    db.select({
      status: subscriptions.status,
      createdAt: subscriptions.created_at,
      archived: subscriptions.archived,
    }).from(subscriptions),
  ]);

  const counts = new Map<SeoPageKey, { current: number; previous: number }>();
  for (const page of SEO_PAGE_OPTIONS) {
    if (page.key === SEO_PAGES.global) {
      continue;
    }
    counts.set(page.key, { current: 0, previous: 0 });
  }

  const mark = (pageKey: SeoPageKey, createdAt: Date) => {
    const bucket = counts.get(pageKey);
    if (!bucket) {
      return;
    }
    const time = createdAt.getTime();
    if (time >= window.startAt && time <= window.endAt) {
      bucket.current += 1;
    } else if (time >= window.previousStartAt && time < window.previousEndAt) {
      bucket.previous += 1;
    }
  };

  for (const row of bookingRows) {
    if (!BOOKING_CONVERSION_STATUSES.includes(row.status as (typeof BOOKING_CONVERSION_STATUSES)[number])) {
      continue;
    }
    if (row.sessionType === "mentoring_circle") {
      mark(SEO_PAGES.events, row.createdAt);
    } else {
      mark(SEO_PAGES.sessions, row.createdAt);
    }
  }

  for (const row of orderRows) {
    if (!ORDER_CONVERSION_STATUSES.includes(row.status as (typeof ORDER_CONVERSION_STATUSES)[number])) {
      continue;
    }
    if (row.type === "report") {
      mark(SEO_PAGES.reports, row.createdAt);
    } else if (row.type === "subscription" || row.type === "subscription_initial" || row.type === "subscription_renewal") {
      mark(SEO_PAGES.subscriptions, row.createdAt);
    }
  }

  for (const row of subscriptionRows) {
    if (row.archived || !SUBSCRIPTION_CONVERSION_STATUSES.includes(row.status as (typeof SUBSCRIPTION_CONVERSION_STATUSES)[number])) {
      continue;
    }
    mark(SEO_PAGES.subscriptions, row.createdAt);
  }

  return counts;
}

function classifyPerformance(pageviews: number, conversions: number, trend: PageTrend): PagePerformance {
  if (pageviews >= 40 && conversions >= 2 && trend !== "down") {
    return "high";
  }
  if (conversions === 0 || trend === "down") {
    return "low";
  }
  return "medium";
}

function calculatePriority(performance: PagePerformance, conversions: number, pageviews: number, trend: PageTrend) {
  let score = performance === "low" ? 100 : performance === "medium" ? 50 : 10;
  score += conversions === 0 ? 20 : Math.max(0, 10 - conversions);
  score += trend === "down" ? 15 : trend === "stable" ? 5 : 0;
  score += pageviews < 20 ? 5 : 0;
  return score;
}

function buildPageAnalyticsInputs(args: {
  summary: Awaited<ReturnType<typeof getAdminAnalyticsSummary>>;
  pageviews: Awaited<ReturnType<typeof getAdminAnalyticsPageviews>>;
  events: Awaited<ReturnType<typeof getAdminAnalyticsEvents>>;
  conversionStats: Map<SeoPageKey, { current: number; previous: number }>;
}) {
  const purchaseEvents = args.events.items.find((item) => item.name === "purchase")?.total ?? 0;
  const sessionBookedEvents = args.events.items.find((item) => item.name === "session_booked")?.total ?? 0;
  const subscriptionEvents = args.events.items.find((item) => item.name === "subscription_started")?.total ?? 0;
  const defaultTrend = args.summary.status === "ok"
    ? (args.summary.trends.pageviews.direction === "neutral" ? "stable" : args.summary.trends.pageviews.direction)
    : "stable";

  return SEO_PAGE_OPTIONS
    .filter((page) => page.key !== SEO_PAGES.global)
    .map<PageAnalyticsInput>((page) => {
      const stats = args.conversionStats.get(page.key) ?? { current: 0, previous: 0 };
      const trend = stats.current !== stats.previous
        ? classifyTrend(stats.current, stats.previous)
        : defaultTrend;
      const pageviews = args.pageviews.status === "ok"
        ? resolvePathMetric(page.key, args.pageviews.topPages)
        : 0;
      const conversions = stats.current;
      const events = page.key === SEO_PAGES.sessions
        ? sessionBookedEvents
        : page.key === SEO_PAGES.subscriptions
          ? subscriptionEvents
          : page.key === SEO_PAGES.reports || page.key === SEO_PAGES.events
            ? purchaseEvents
            : 0;
      const performance = classifyPerformance(pageviews, conversions, trend);

      return {
        pageKey: page.key,
        pageviews,
        trend,
        events,
        conversions,
        previousConversions: stats.previous,
        performance,
        priority: calculatePriority(performance, conversions, pageviews, trend),
      };
    })
    .sort((left, right) => right.priority - left.priority);
}

async function generateWeeklyRecommendationsForPage(
  db: Database,
  pageAnalytics: PageAnalyticsInput,
  logger: SeoLogger,
) {
  const currentSnapshot = await getCurrentSnapshot(db, pageAnalytics.pageKey);

  if (pageAnalytics.performance === "high") {
    return {
      stored: [
        await storeNoChangeRecommendation(
          db,
          pageAnalytics.pageKey,
          "weekly_optimization",
          currentSnapshot,
          "High traffic, strong conversions, and stable performance make a change unnecessary this cycle.",
        ),
      ],
      noChange: 1,
    };
  }

  const scraped = await scrapeLivePageContent(pageAnalytics.pageKey, logger);
  const parsed = parseWeeklySeoResponse(
    await requestStructuredJson(
      SYSTEM_GUARD_PROMPT,
      buildWeeklyPrompt(pageAnalytics.pageKey, currentSnapshot, pageAnalytics, scraped),
    ),
    currentSnapshot,
  );

  const stored = [];
  let noChange = 0;

  for (const recommendation of parsed) {
    const persisted = await persistRecommendation(db, {
      pageKey: pageAnalytics.pageKey,
      type: recommendation.type,
      reason: recommendation.reason,
      expectedOutcome: recommendation.expectedOutcome,
      currentSnapshot: recommendation.currentSnapshot,
      suggestedSnapshot: recommendation.suggestedSnapshot,
      impact: recommendation.impact,
      intent: null,
      confidence: recommendation.confidence,
      source: "weekly_optimization",
    });
    stored.push(persisted);
    if (recommendation.type === "no_change") {
      noChange += 1;
    }
  }

  return { stored, noChange };
}

export async function runWeeklySeoRecommendationJob(
  db: Database,
  logger: SeoLogger,
): Promise<WeeklyRecommendationJobResult> {
  const range: AnalyticsRange = "30d";
  const batchSize = Math.max(
    1,
    Number.parseInt(process.env.SEO_WEEKLY_BATCH_SIZE?.trim() || "", 10) || DEFAULT_WEEKLY_BATCH_SIZE,
  );

  const [summary, pageviews, events, conversionStats, latestByPage] = await Promise.all([
    getAdminAnalyticsSummary(
      { actorRole: "admin" },
      range,
      { warn: (payload, message) => logger.warn(payload, message) },
    ),
    getAdminAnalyticsPageviews(
      { actorRole: "admin" },
      range,
      { warn: (payload, message) => logger.warn(payload, message) },
    ),
    getAdminAnalyticsEvents(
      { actorRole: "admin" },
      range,
      { warn: (payload, message) => logger.warn(payload, message) },
    ),
    loadPageConversionStats(db, range),
    getLatestRecommendationByPage(db),
  ]);

  const candidates = buildPageAnalyticsInputs({
    summary,
    pageviews,
    events,
    conversionStats,
  });

  let processedPages = 0;
  let skippedCooldown = 0;
  let skippedDuplicates = 0;
  let storedRecommendations = 0;
  let highPerformerLocks = 0;
  let noChangeRecommendations = 0;

  for (const candidate of candidates.slice(0, batchSize)) {
    const latest = latestByPage.get(candidate.pageKey);
    if (latest && isSeoRecommendationCoolingDown(latest)) {
      skippedCooldown += 1;
      continue;
    }

    processedPages += 1;

    const result = await generateWeeklyRecommendationsForPage(db, candidate, logger);
    if (candidate.performance === "high") {
      highPerformerLocks += 1;
    }
    noChangeRecommendations += result.noChange;

    for (const item of result.stored) {
      if (item.created) {
        storedRecommendations += 1;
      } else {
        skippedDuplicates += 1;
      }
    }
  }

  return {
    range,
    batchSize,
    consideredPages: candidates.length,
    processedPages,
    skippedCooldown,
    skippedDuplicates,
    storedRecommendations,
    highPerformerLocks,
    noChangeRecommendations,
  };
}

async function loadRecommendationOrThrow(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(seoRecommendations)
    .where(eq(seoRecommendations.id, id))
    .limit(1);

  if (!row) {
    throw createHttpError(404, "SEO recommendation not found");
  }
  return row;
}

export async function approveSeoRecommendation(
  db: Database,
  actor: SeoActor,
  recommendationId: string,
  options?: { adminImpactOverride?: string | null },
) {
  assertAdminAccess(actor);

  const recommendation = await loadRecommendationOrThrow(db, recommendationId);
  if (recommendation.type === "no_change") {
    throw createHttpError(400, "No-change recommendations cannot be applied");
  }
  if (!SEO_UPDATE_TYPES.has(recommendation.type)) {
    throw createHttpError(400, "Unsupported SEO recommendation type");
  }

  const adminImpactOverride = options?.adminImpactOverride?.trim() || null;
  if (adminImpactOverride && !IMPACT_VALUES.has(adminImpactOverride as SeoImpact)) {
    throw createHttpError(400, "Invalid SEO impact override");
  }

  const previousSnapshot = await getCurrentSnapshot(db, recommendation.page_key as SeoPageKey);
  const appliedSetting = await updateSeoSetting(
    db,
    { actorRole: actor.actorRole },
    recommendation.page_key,
    {
      title: recommendation.suggested_snapshot.title,
      metaDescription: recommendation.suggested_snapshot.metaDescription,
      keywords: recommendation.suggested_snapshot.keywords,
      ogImage: recommendation.suggested_snapshot.ogImage,
      robotsIndex: recommendation.suggested_snapshot.robotsIndex,
    },
  );

  const appliedSnapshot = normalizeSnapshot({
    title: appliedSetting.title,
    metaDescription: appliedSetting.metaDescription,
    keywords: appliedSetting.keywords,
    ogImage: appliedSetting.ogImage,
    robotsIndex: appliedSetting.robotsIndex,
  });

  await db.insert(seoRecommendationApplyHistory).values({
    recommendation_id: recommendation.id,
    page_key: recommendation.page_key,
    previous_value: previousSnapshot,
    new_value: appliedSnapshot,
    applied_at: new Date(),
    applied_by: actor.actorUserId ?? null,
  });

  const [updated] = await db
    .update(seoRecommendations)
    .set({
      status: "applied",
      admin_impact_override: (adminImpactOverride as SeoImpact | null) ?? recommendation.admin_impact_override,
      reviewed_at: new Date(),
      reviewed_by: actor.actorUserId ?? null,
      updated_at: new Date(),
    })
    .where(eq(seoRecommendations.id, recommendation.id))
    .returning();

  if (!updated) {
    throw createHttpError(500, "Unable to finalize SEO recommendation");
  }

  return toStoredRecommendation(updated);
}

export async function rejectSeoRecommendation(
  db: Database,
  actor: SeoActor,
  recommendationId: string,
) {
  assertAdminAccess(actor);
  await loadRecommendationOrThrow(db, recommendationId);

  const [updated] = await db
    .update(seoRecommendations)
    .set({
      status: "rejected",
      reviewed_at: new Date(),
      reviewed_by: actor.actorUserId ?? null,
      updated_at: new Date(),
    })
    .where(eq(seoRecommendations.id, recommendationId))
    .returning();

  if (!updated) {
    throw createHttpError(500, "Unable to reject SEO recommendation");
  }

  return toStoredRecommendation(updated);
}

export const __seoAiTestUtils = {
  buildRecommendationHash,
  classifyPerformance,
  isSeoRecommendationCoolingDown,
  parseInitialSeoResponse,
  parseWeeklySeoResponse,
};
