import { seoChangesLog, seoSettings, type Database, type SeoKeywordBuckets, type SeoRecommendationValue } from "@wisdom/db";
import { SEO_PAGE_OPTIONS, SEO_PAGES, type SeoPageKey } from "@wisdom/utils";
import { asc, eq } from "drizzle-orm";
import { createHttpError } from "./booking/errors.js";

interface SeoActor {
  actorRole: string;
  actorUserId?: string | null;
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

function isSeoStorageMissing(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === "42P01") {
    return true;
  }

  const message = typeof candidate.message === "string" ? candidate.message : "";
  return message.includes("seo_settings") && (
    message.includes("does not exist")
    || message.includes("doesn't exist")
    || message.includes("undefined_table")
  );
}

function handleSeoStorageError(error: unknown): never {
  if (isSeoStorageMissing(error)) {
    throw createHttpError(503, "SEO storage is not ready yet. Run the seo_settings migration.");
  }

  throw error;
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

function seoValuesEqual(left: SeoRecommendationValue, right: SeoRecommendationValue) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

async function logManualSeoChanges(
  db: Database,
  actor: SeoActor,
  pageKey: SeoPageKey,
  input: {
    previous: {
      title: string | null;
      metaDescription: string | null;
      keywords: SeoKeywordBuckets;
      ogImage: string | null;
      robotsIndex: boolean;
    };
    next: {
      title: string | null;
      metaDescription: string | null;
      keywords: SeoKeywordBuckets;
      ogImage: string | null;
      robotsIndex: boolean;
    };
  },
) {
  const rows = [
    {
      field: "title" as const,
      oldValue: input.previous.title,
      newValue: input.next.title,
    },
    {
      field: "meta_description" as const,
      oldValue: input.previous.metaDescription,
      newValue: input.next.metaDescription,
    },
    {
      field: "keywords" as const,
      oldValue: input.previous.keywords,
      newValue: input.next.keywords,
    },
    {
      field: "og_image" as const,
      oldValue: input.previous.ogImage,
      newValue: input.next.ogImage,
    },
    {
      field: "indexing" as const,
      oldValue: input.previous.robotsIndex,
      newValue: input.next.robotsIndex,
    },
  ].filter((entry) => !seoValuesEqual(entry.oldValue, entry.newValue));

  if (rows.length === 0) {
    return;
  }

  await db.insert(seoChangesLog).values(
    rows.map((entry) => ({
      page_key: pageKey,
      field: entry.field,
      old_value: entry.oldValue ?? null,
      new_value: entry.newValue ?? null,
      source: "manual" as const,
      applied_by: actor.actorUserId ?? null,
    })),
  );
}

export async function listSeoSettings(db: Database, actor: SeoActor) {
  assertAdminAccess(actor);

  try {
    const rows = await db
      .select()
      .from(seoSettings)
      .orderBy(asc(seoSettings.page_key));

    return {
      pages: SEO_PAGE_OPTIONS,
      settings: rows.map(toSeoRecord),
    };
  } catch (error) {
    if (isSeoStorageMissing(error)) {
      return {
        pages: SEO_PAGE_OPTIONS,
        settings: [],
      };
    }

    throw error;
  }
}

export async function upsertSeoSetting(
  db: Database,
  actor: SeoActor,
  payload: SeoPayloadInput,
) {
  assertAdminAccess(actor);
  const pageKey = assertSeoPageKey(payload.pageKey);
  const values = buildSeoValues(pageKey, payload);
  let existing = null;
  try {
    [existing] = await db
      .select()
      .from(seoSettings)
      .where(eq(seoSettings.page_key, pageKey))
      .limit(1);
  } catch (error) {
    handleSeoStorageError(error);
  }

  let row;
  try {
    [row] = await db
      .insert(seoSettings)
      .values(values)
      .onConflictDoUpdate({
        target: seoSettings.page_key,
        set: values,
      })
      .returning();
  } catch (error) {
    handleSeoStorageError(error);
  }

  if (!row) {
    throw createHttpError(500, "Unable to save SEO settings");
  }

  await logManualSeoChanges(db, actor, pageKey, {
    previous: {
      title: existing?.title ?? null,
      metaDescription: existing?.meta_description ?? null,
      keywords: existing?.keywords ?? { primary: [], secondary: [] },
      ogImage: existing?.og_image ?? null,
      robotsIndex: existing?.robots_index ?? true,
    },
    next: {
      title: row.title,
      metaDescription: row.meta_description,
      keywords: row.keywords,
      ogImage: row.og_image,
      robotsIndex: row.robots_index,
    },
  });

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

  let existing;
  try {
    [existing] = await db
      .select()
      .from(seoSettings)
      .where(eq(seoSettings.page_key, pageKey))
      .limit(1);
  } catch (error) {
    handleSeoStorageError(error);
  }

  if (!existing) {
    return upsertSeoSetting(db, actor, {
      ...payload,
      pageKey,
    });
  }

  const nextKeywords = payload.keywords === undefined
    ? existing.keywords
    : normalizeKeywords(payload.keywords);

  let updated;
  try {
    [updated] = await db
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
  } catch (error) {
    handleSeoStorageError(error);
  }

  if (!updated) {
    throw createHttpError(500, "Unable to update SEO settings");
  }

  await logManualSeoChanges(db, actor, pageKey, {
    previous: {
      title: existing.title,
      metaDescription: existing.meta_description,
      keywords: existing.keywords,
      ogImage: existing.og_image,
      robotsIndex: existing.robots_index,
    },
    next: {
      title: updated.title,
      metaDescription: updated.meta_description,
      keywords: updated.keywords,
      ogImage: updated.og_image,
      robotsIndex: updated.robots_index,
    },
  });

  return toSeoRecord(updated);
}
