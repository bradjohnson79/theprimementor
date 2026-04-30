import {
  seoChangesLog,
  seoRecommendationApplyHistory,
  seoRecommendations,
  seoSettings,
  type Database,
  type SeoKeywordBuckets,
  type SeoRecommendationValue,
} from "@wisdom/db";
import { and, eq } from "drizzle-orm";
import {
  applyFieldValueToSnapshot,
  assertAdminAccess,
  normalizeKeywords,
  normalizeOptionalText,
  type SeoActor,
  type SeoChangeSource,
  type SeoRecommendationField,
} from "./seoShared.js";
import { createHttpError } from "./booking/errors.js";
import { rebuildSeoReportForAudit } from "./seoReportService.js";

function assertExpectedVersion(value: number) {
  if (!Number.isFinite(value)) {
    throw createHttpError(400, "expectedVersion is required");
  }
}

function toChangeLogRecord(row: typeof seoChangesLog.$inferSelect) {
  return {
    id: row.id,
    recommendationId: row.recommendation_id ?? null,
    pageKey: row.page_key,
    field: row.field,
    oldValue: (row.old_value as SeoRecommendationValue | null) ?? null,
    newValue: (row.new_value as SeoRecommendationValue | null) ?? null,
    source: row.source,
    appliedBy: row.applied_by ?? null,
    appliedAt: row.applied_at.toISOString(),
  };
}

async function applyLiveSeoFieldChange(
  db: any,
  pageKey: string,
  field: SeoRecommendationField,
  value: SeoRecommendationValue,
) {
  const [existing] = await db
    .select()
    .from(seoSettings)
    .where(eq(seoSettings.page_key, pageKey))
    .limit(1);

  const values = existing
    ? {
      title: existing.title,
      meta_description: existing.meta_description,
      keywords: existing.keywords,
      og_image: existing.og_image,
      robots_index: existing.robots_index,
    }
    : {
      title: null,
      meta_description: null,
      keywords: { primary: [], secondary: [] } as SeoKeywordBuckets,
      og_image: null,
      robots_index: true,
    };

  switch (field) {
    case "title":
      values.title = typeof value === "string" ? normalizeOptionalText(value) : null;
      break;
    case "meta_description":
      values.meta_description = typeof value === "string" ? normalizeOptionalText(value) : null;
      break;
    case "keywords":
      values.keywords = normalizeKeywords((value as SeoKeywordBuckets | null | undefined) ?? undefined);
      break;
    case "og_image":
      values.og_image = typeof value === "string" ? normalizeOptionalText(value) : null;
      break;
    case "indexing":
      values.robots_index = typeof value === "boolean" ? value : true;
      break;
  }

  if (existing) {
    await db
      .update(seoSettings)
      .set({
        ...values,
        updated_at: new Date(),
      })
      .where(eq(seoSettings.page_key, pageKey));
    return;
  }

  await db.insert(seoSettings).values({
    page_key: pageKey,
    ...values,
    updated_at: new Date(),
  });
}

async function insertChangeLog(
  db: any,
  input: {
    recommendationId?: string | null;
    pageKey: string;
    field: SeoRecommendationField;
    oldValue: SeoRecommendationValue;
    newValue: SeoRecommendationValue;
    source: SeoChangeSource;
    appliedBy?: string | null;
  },
) {
  const [created] = await db
    .insert(seoChangesLog)
    .values({
      recommendation_id: input.recommendationId ?? null,
      page_key: input.pageKey,
      field: input.field,
      old_value: input.oldValue ?? null,
      new_value: input.newValue ?? null,
      source: input.source,
      applied_by: input.appliedBy ?? null,
    })
    .returning();

  if (!created) {
    throw createHttpError(500, "Unable to write SEO change log");
  }

  return created;
}

async function resolveRecommendationForWrite(
  db: any,
  input: {
    recommendationId: string;
    expectedVersion: number;
    nextStatus: "approved" | "rejected" | "edited";
    editedValue?: SeoRecommendationValue;
    actorUserId?: string | null;
  },
) {
  const [row] = await db
    .select()
    .from(seoRecommendations)
    .where(eq(seoRecommendations.id, input.recommendationId))
    .limit(1);

  if (!row) {
    throw createHttpError(404, "SEO recommendation not found");
  }

  if (row.version !== input.expectedVersion) {
    throw createHttpError(409, "This recommendation has changed. Refresh before acting.");
  }

  const [updated] = await db
    .update(seoRecommendations)
    .set({
      status: input.nextStatus,
      edited_value: input.editedValue ?? row.edited_value ?? null,
      reviewed_at: new Date(),
      reviewed_by: input.actorUserId ?? null,
      resolved_at: new Date(),
      version: row.version + 1,
      updated_at: new Date(),
    })
    .where(and(
      eq(seoRecommendations.id, input.recommendationId),
      eq(seoRecommendations.version, input.expectedVersion),
    ))
    .returning();

  if (!updated) {
    throw createHttpError(409, "Unable to update recommendation due to a concurrent change.");
  }

  return {
    previous: row,
    updated,
  };
}

export async function approveSeoRecommendation(
  db: Database,
  actor: SeoActor,
  recommendationId: string,
  input: { expectedVersion: number },
) {
  assertAdminAccess(actor);
  assertExpectedVersion(input.expectedVersion);

  let reportAuditId: string | null = null;
  const result = await db.transaction(async (tx) => {
    const { previous, updated } = await resolveRecommendationForWrite(tx, {
      recommendationId,
      expectedVersion: input.expectedVersion,
      nextStatus: "approved",
      actorUserId: actor.actorUserId,
    });

    reportAuditId = previous.audit_id ?? null;
    if (!previous.field || previous.action === "no_change") {
      return updated;
    }

    const oldValue = (previous.current_value as SeoRecommendationValue | null) ?? null;
    const nextValue = (previous.suggested_value as SeoRecommendationValue | null) ?? null;
    const oldSnapshot = previous.current_snapshot;
    const nextSnapshot = applyFieldValueToSnapshot(oldSnapshot, previous.field, nextValue);

    await applyLiveSeoFieldChange(tx, previous.page_key, previous.field, nextValue);
    await tx.insert(seoRecommendationApplyHistory).values({
      recommendation_id: previous.id,
      page_key: previous.page_key,
      previous_value: oldSnapshot,
      new_value: nextSnapshot,
      applied_by: actor.actorUserId ?? null,
    });
    await insertChangeLog(tx, {
      recommendationId: previous.id,
      pageKey: previous.page_key,
      field: previous.field,
      oldValue,
      newValue: nextValue,
      source: "ai_approved",
      appliedBy: actor.actorUserId ?? null,
    });

    return updated;
  });

  if (reportAuditId) {
    await rebuildSeoReportForAudit(db, reportAuditId).catch(() => {});
  }

  return { recommendation: result };
}

export async function editSeoRecommendation(
  db: Database,
  actor: SeoActor,
  recommendationId: string,
  input: {
    expectedVersion: number;
    editedValue: SeoRecommendationValue;
  },
) {
  assertAdminAccess(actor);
  assertExpectedVersion(input.expectedVersion);

  let reportAuditId: string | null = null;
  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(seoRecommendations)
      .where(eq(seoRecommendations.id, recommendationId))
      .limit(1);

    if (!current) {
      throw createHttpError(404, "SEO recommendation not found");
    }
    if (!current.field) {
      throw createHttpError(400, "This recommendation cannot be edited.");
    }

    const { updated } = await resolveRecommendationForWrite(tx, {
      recommendationId,
      expectedVersion: input.expectedVersion,
      nextStatus: "edited",
      editedValue: input.editedValue,
      actorUserId: actor.actorUserId,
    });

    reportAuditId = current.audit_id ?? null;
    const oldValue = (current.current_value as SeoRecommendationValue | null) ?? null;
    const nextValue = input.editedValue ?? null;
    const nextSnapshot = applyFieldValueToSnapshot(current.current_snapshot, current.field, nextValue);

    await applyLiveSeoFieldChange(tx, current.page_key, current.field, nextValue);
    await tx.insert(seoRecommendationApplyHistory).values({
      recommendation_id: current.id,
      page_key: current.page_key,
      previous_value: current.current_snapshot,
      new_value: nextSnapshot,
      applied_by: actor.actorUserId ?? null,
    });
    await insertChangeLog(tx, {
      recommendationId: current.id,
      pageKey: current.page_key,
      field: current.field,
      oldValue,
      newValue: nextValue,
      source: "ai_edited",
      appliedBy: actor.actorUserId ?? null,
    });

    return updated;
  });

  if (reportAuditId) {
    await rebuildSeoReportForAudit(db, reportAuditId).catch(() => {});
  }

  return { recommendation: result };
}

export async function rejectSeoRecommendation(
  db: Database,
  actor: SeoActor,
  recommendationId: string,
  input: { expectedVersion: number },
) {
  assertAdminAccess(actor);
  assertExpectedVersion(input.expectedVersion);
  const { updated } = await resolveRecommendationForWrite(db, {
    recommendationId,
    expectedVersion: input.expectedVersion,
    nextStatus: "rejected",
    actorUserId: actor.actorUserId,
  });

  if (updated.audit_id) {
    await rebuildSeoReportForAudit(db, updated.audit_id).catch(() => {});
  }

  return { recommendation: updated };
}

export async function rollbackSeoChange(
  db: Database,
  actor: SeoActor,
  changeId: string,
) {
  assertAdminAccess(actor);
  const [change] = await db
    .select()
    .from(seoChangesLog)
    .where(eq(seoChangesLog.id, changeId))
    .limit(1);

  if (!change) {
    throw createHttpError(404, "SEO change log entry not found");
  }

  const restoredValue = (change.old_value as SeoRecommendationValue | null) ?? null;
  await applyLiveSeoFieldChange(db, change.page_key, change.field, restoredValue);
  const created = await insertChangeLog(db, {
    recommendationId: change.recommendation_id ?? null,
    pageKey: change.page_key,
    field: change.field,
    oldValue: (change.new_value as SeoRecommendationValue | null) ?? null,
    newValue: restoredValue,
    source: "rollback",
    appliedBy: actor.actorUserId ?? null,
  });

  if (change.recommendation_id) {
    const [recommendation] = await db
      .select({
        auditId: seoRecommendations.audit_id,
      })
      .from(seoRecommendations)
      .where(eq(seoRecommendations.id, change.recommendation_id))
      .limit(1);
    if (recommendation?.auditId) {
      await rebuildSeoReportForAudit(db, recommendation.auditId).catch(() => {});
    }
  }

  return {
    change: toChangeLogRecord(created),
  };
}

export const __seoReviewTestUtils = {
  assertExpectedVersion,
};
