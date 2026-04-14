import { seoSettings, type Database, type SeoKeywordBuckets } from "@wisdom/db";
import { SEO_PAGE_OPTIONS, SEO_PAGES, type SeoPageKey } from "@wisdom/utils";
import { asc, eq } from "drizzle-orm";
import { createHttpError } from "./booking/errors.js";

interface SeoActor {
  actorRole: string;
}

export interface SeoPayloadInput {
  pageKey?: string;
  title?: string | null;
  metaDescription?: string | null;
  keywords?: string[] | Partial<Record<keyof SeoKeywordBuckets, string[]>> | null;
  ogImage?: string | null;
  robotsIndex?: boolean | null;
}

function assertAdminAccess(actor: SeoActor) {
  if (actor.actorRole !== "admin") {
    throw createHttpError(403, "Admin SEO access required");
  }
}

function normalizeOptionalText(value: string | null | undefined) {
  const next = typeof value === "string" ? value.trim() : "";
  return next.length > 0 ? next : null;
}

function normalizeKeywords(value: SeoPayloadInput["keywords"]): SeoKeywordBuckets {
  if (Array.isArray(value)) {
    return {
      primary: Array.from(new Set(value.map((entry) => entry.trim()).filter(Boolean))),
      secondary: [],
    };
  }

  const primary = Array.from(new Set((value?.primary ?? []).map((entry) => entry.trim()).filter(Boolean)));
  const secondary = Array.from(new Set((value?.secondary ?? []).map((entry) => entry.trim()).filter(Boolean)));

  return { primary, secondary };
}

function assertSeoPageKey(value: string | undefined): SeoPageKey {
  const pageKey = typeof value === "string" ? value.trim() : "";
  const validKeys = new Set(Object.values(SEO_PAGES));
  if (!validKeys.has(pageKey as SeoPageKey)) {
    throw createHttpError(400, "Invalid SEO page key");
  }
  return pageKey as SeoPageKey;
}

function toSeoRecord(row: typeof seoSettings.$inferSelect) {
  return {
    id: row.id,
    pageKey: row.page_key,
    title: row.title,
    metaDescription: row.meta_description,
    keywords: row.keywords,
    ogImage: row.og_image,
    robotsIndex: row.robots_index,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at?.toISOString() ?? row.created_at.toISOString(),
  };
}

function buildSeoValues(pageKey: SeoPageKey, payload: SeoPayloadInput) {
  return {
    page_key: pageKey,
    title: normalizeOptionalText(payload.title),
    meta_description: normalizeOptionalText(payload.metaDescription),
    keywords: normalizeKeywords(payload.keywords),
    og_image: normalizeOptionalText(payload.ogImage),
    robots_index: payload.robotsIndex ?? true,
    updated_at: new Date(),
  };
}

export async function listSeoSettings(db: Database, actor: SeoActor) {
  assertAdminAccess(actor);

  const rows = await db
    .select()
    .from(seoSettings)
    .orderBy(asc(seoSettings.page_key));

  return {
    pages: SEO_PAGE_OPTIONS,
    settings: rows.map(toSeoRecord),
  };
}

export async function upsertSeoSetting(
  db: Database,
  actor: SeoActor,
  payload: SeoPayloadInput,
) {
  assertAdminAccess(actor);
  const pageKey = assertSeoPageKey(payload.pageKey);
  const values = buildSeoValues(pageKey, payload);

  const [row] = await db
    .insert(seoSettings)
    .values(values)
    .onConflictDoUpdate({
      target: seoSettings.page_key,
      set: values,
    })
    .returning();

  if (!row) {
    throw createHttpError(500, "Unable to save SEO settings");
  }

  return toSeoRecord(row);
}

export async function updateSeoSetting(
  db: Database,
  actor: SeoActor,
  pageKeyInput: string,
  payload: Omit<SeoPayloadInput, "pageKey">,
) {
  assertAdminAccess(actor);
  const pageKey = assertSeoPageKey(pageKeyInput);

  const [existing] = await db
    .select()
    .from(seoSettings)
    .where(eq(seoSettings.page_key, pageKey))
    .limit(1);

  if (!existing) {
    return upsertSeoSetting(db, actor, {
      ...payload,
      pageKey,
    });
  }

  const nextKeywords = payload.keywords === undefined
    ? existing.keywords
    : normalizeKeywords(payload.keywords);

  const [updated] = await db
    .update(seoSettings)
    .set({
      title: payload.title === undefined ? existing.title : normalizeOptionalText(payload.title),
      meta_description: payload.metaDescription === undefined
        ? existing.meta_description
        : normalizeOptionalText(payload.metaDescription),
      keywords: nextKeywords,
      og_image: payload.ogImage === undefined ? existing.og_image : normalizeOptionalText(payload.ogImage),
      robots_index: payload.robotsIndex ?? existing.robots_index,
      updated_at: new Date(),
    })
    .where(eq(seoSettings.page_key, pageKey))
    .returning();

  if (!updated) {
    throw createHttpError(500, "Unable to update SEO settings");
  }

  return toSeoRecord(updated);
}
