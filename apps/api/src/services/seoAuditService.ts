import {
  seoAuditItems,
  seoAudits,
  type Database,
  type SeoAuditSummaryJson,
  type SeoRecommendationValue,
} from "@wisdom/db";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  assertAdminAccess,
  getAuditableSeoPages,
  getCurrentSeoSnapshot,
  getPreviousAuditSummary,
  scrapeSeoPageContent,
  type SeoActor,
  type SeoAuditMode,
  type SeoAuditSeverity,
  type SeoLogger,
  type SeoRecommendationField,
} from "./seoShared.js";
import { createHttpError } from "./booking/errors.js";
import { generateSeoRecommendationsForAudit } from "./seoRecommendationService.js";
import { rebuildSeoReportForAudit } from "./seoReportService.js";

interface SeoAuditRecord {
  id: string;
  initiatedBy: string | null;
  scope: string;
  mode: SeoAuditMode;
  status: "pending" | "running" | "complete" | "failed";
  summaryJson: SeoAuditSummaryJson | null;
  completedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SeoAuditItemRecord {
  id: string;
  auditId: string;
  pageKey: string;
  issueType: string;
  severity: SeoAuditSeverity;
  description: string;
  detectedValue: SeoRecommendationValue;
  recommendedValue: SeoRecommendationValue;
  createdAt: string;
  updatedAt: string;
}

interface AuditIssueInput {
  pageKey: string;
  issueType: string;
  severity: SeoAuditSeverity;
  description: string;
  detectedValue: SeoRecommendationValue;
  recommendedValue: SeoRecommendationValue;
}

const CTA_REGEX = /\b(book|discover|explore|learn|start|contact|join|unlock|register|get|begin|shop|view|buy)\b/i;

function toAuditRecord(row: typeof seoAudits.$inferSelect): SeoAuditRecord {
  return {
    id: row.id,
    initiatedBy: row.initiated_by ?? null,
    scope: row.scope,
    mode: (row.mode as SeoAuditMode) ?? "full",
    status: row.status,
    summaryJson: row.summary_json ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
    failureReason: row.failure_reason ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at?.toISOString() ?? row.created_at.toISOString(),
  };
}

function toAuditItemRecord(row: typeof seoAuditItems.$inferSelect): SeoAuditItemRecord {
  return {
    id: row.id,
    auditId: row.audit_id,
    pageKey: row.page_key,
    issueType: row.issue_type,
    severity: row.severity,
    description: row.description,
    detectedValue: row.detected_value ?? null,
    recommendedValue: row.recommended_value ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at?.toISOString() ?? row.created_at.toISOString(),
  };
}

function normalizeText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasKeyword(text: string, keyword: string) {
  if (!keyword.trim()) {
    return false;
  }
  return new RegExp(`\\b${escapeRegex(keyword.trim())}\\b`, "i").test(text);
}

function pushIssue(issues: AuditIssueInput[], issue: AuditIssueInput) {
  issues.push(issue);
}

function detectPageIssues(input: {
  pageKey: string;
  title: string;
  metaDescription: string;
  ogImage: string;
  robotsIndex: boolean;
  keywordsPrimary: string[];
  keywordsSecondary: string[];
  content: string;
}) {
  const issues: AuditIssueInput[] = [];
  const titleLength = input.title.length;
  const descriptionLength = input.metaDescription.length;
  const primaryKeyword = input.keywordsPrimary[0] ?? "";
  const titleHasPrimaryKeyword = primaryKeyword ? hasKeyword(input.title, primaryKeyword) : false;
  const descriptionHasPrimaryKeyword = primaryKeyword ? hasKeyword(input.metaDescription, primaryKeyword) : false;
  const contentHasPrimaryKeyword = primaryKeyword ? hasKeyword(input.content, primaryKeyword) : false;
  const descriptionHasCta = CTA_REGEX.test(input.metaDescription);

  if (!input.title) {
    pushIssue(issues, {
      pageKey: input.pageKey,
      issueType: "missing_title",
      severity: "high",
      description: "The page is missing an SEO title.",
      detectedValue: null,
      recommendedValue: "Create a title between 30 and 60 characters that reflects page intent.",
    });
  } else {
    if (titleLength < 30) {
      pushIssue(issues, {
        pageKey: input.pageKey,
        issueType: "weak_title_length",
        severity: "medium",
        description: "The SEO title is shorter than 30 characters and may undersell intent.",
        detectedValue: input.title,
        recommendedValue: "Expand the title to 30-60 characters with clearer search intent.",
      });
    }
    if (titleLength > 60) {
      pushIssue(issues, {
        pageKey: input.pageKey,
        issueType: "title_too_long",
        severity: "medium",
        description: "The SEO title exceeds 60 characters and may truncate in search results.",
        detectedValue: input.title,
        recommendedValue: "Trim the title below 60 characters without losing the primary keyword.",
      });
    }
  }

  if (!input.metaDescription) {
    pushIssue(issues, {
      pageKey: input.pageKey,
      issueType: "missing_meta_description",
      severity: "high",
      description: "The page is missing a meta description.",
      detectedValue: null,
      recommendedValue: "Add a concise 140-160 character benefit-driven meta description.",
    });
  } else {
    if (descriptionLength < 100) {
      pushIssue(issues, {
        pageKey: input.pageKey,
        issueType: "weak_meta_description_length",
        severity: "medium",
        description: "The meta description is shorter than 100 characters and may lack context.",
        detectedValue: input.metaDescription,
        recommendedValue: "Expand the description to 100-170 characters with stronger context.",
      });
    }
    if (descriptionLength > 170) {
      pushIssue(issues, {
        pageKey: input.pageKey,
        issueType: "meta_description_too_long",
        severity: "medium",
        description: "The meta description exceeds 170 characters and may truncate in search.",
        detectedValue: input.metaDescription,
        recommendedValue: "Trim the description below 170 characters while keeping clarity.",
      });
    }
    if (!descriptionHasCta) {
      pushIssue(issues, {
        pageKey: input.pageKey,
        issueType: "missing_description_cta",
        severity: "medium",
        description: "The meta description lacks CTA-oriented language that can improve click-through rate.",
        detectedValue: input.metaDescription,
        recommendedValue: "Add light CTA language aligned with the page intent.",
      });
    }
  }

  if (!input.ogImage) {
    pushIssue(issues, {
      pageKey: input.pageKey,
      issueType: "missing_og_image",
      severity: "high",
      description: "The page is missing an Open Graph image.",
      detectedValue: null,
      recommendedValue: "Add a branded OG image for social sharing previews.",
    });
  }

  if (!input.robotsIndex) {
    pushIssue(issues, {
      pageKey: input.pageKey,
      issueType: "noindex_blocked",
      severity: "high",
      description: "The page is set to noindex and is not ready for search discovery.",
      detectedValue: false,
      recommendedValue: true,
    });
  }

  if (input.keywordsPrimary.length === 0) {
    pushIssue(issues, {
      pageKey: input.pageKey,
      issueType: "missing_primary_keywords",
      severity: "high",
      description: "The page has no primary keyword targets configured.",
      detectedValue: { primary: [], secondary: input.keywordsSecondary },
      recommendedValue: "Add at least one primary keyword aligned to page intent.",
    });
  } else if (!titleHasPrimaryKeyword) {
    pushIssue(issues, {
      pageKey: input.pageKey,
      issueType: "missing_primary_keyword_title",
      severity: "medium",
      description: "The SEO title does not include the primary keyword.",
      detectedValue: input.title || null,
      recommendedValue: primaryKeyword,
    });
  }

  if (input.keywordsPrimary.length > 0 && !(descriptionHasPrimaryKeyword || contentHasPrimaryKeyword)) {
    pushIssue(issues, {
      pageKey: input.pageKey,
      issueType: "primary_keyword_gap",
      severity: "medium",
      description: "The primary keyword is not reinforced in the description or page content.",
      detectedValue: primaryKeyword,
      recommendedValue: "Align page copy and description to the configured primary keyword.",
    });
  }

  if (input.keywordsSecondary.length === 0) {
    pushIssue(issues, {
      pageKey: input.pageKey,
      issueType: "missing_secondary_keywords",
      severity: "low",
      description: "The page has no secondary keyword support terms configured.",
      detectedValue: { primary: input.keywordsPrimary, secondary: [] },
      recommendedValue: "Add secondary keywords that support the primary search intent.",
    });
  }

  return issues;
}

function addDuplicateIssues(items: AuditIssueInput[]) {
  const titles = new Map<string, string[]>();
  const descriptions = new Map<string, string[]>();

  for (const item of items) {
    // no-op, duplicates added from snapshots below
    void item;
  }

  return { titles, descriptions };
}

function roundScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateSeoHealthScore(input: {
  pages: Array<{
    hasTitle: boolean;
    hasDescription: boolean;
    hasPrimaryKeyword: boolean;
    hasOgImage: boolean;
    robotsIndex: boolean;
    titleHasPrimaryKeyword: boolean;
    descriptionOrContentHasPrimaryKeyword: boolean;
    hasSecondaryKeywords: boolean;
  }>;
  duplicateTitlePages: number;
  duplicateDescriptionPages: number;
}) {
  const pageCount = Math.max(input.pages.length, 1);
  const metadataCompletenessScore = roundScore(
    (input.pages.reduce((total, page) => total + (
      Number(page.hasTitle) + Number(page.hasDescription) + Number(page.hasOgImage)
    ) / 3, 0) / pageCount) * 100,
  );
  const keywordAlignmentScore = roundScore(
    (input.pages.reduce((total, page) => total + (
      Number(page.hasPrimaryKeyword)
      + Number(page.titleHasPrimaryKeyword)
      + Number(page.descriptionOrContentHasPrimaryKeyword)
      + Number(page.hasSecondaryKeywords)
    ) / 4, 0) / pageCount) * 100,
  );
  const duplicateAvoidanceScore = roundScore(
    100 - (((input.duplicateTitlePages + input.duplicateDescriptionPages) / (pageCount * 2)) * 100),
  );
  const indexingReadinessScore = roundScore(
    (input.pages.reduce((total, page) => total + Number(page.robotsIndex), 0) / pageCount) * 100,
  );

  const total = roundScore(
    metadataCompletenessScore * 0.30
      + keywordAlignmentScore * 0.30
      + duplicateAvoidanceScore * 0.20
      + indexingReadinessScore * 0.20,
  );

  return {
    total,
    metadataCompletenessScore,
    keywordAlignmentScore,
    duplicateAvoidanceScore,
    indexingReadinessScore,
  };
}

export async function createSeoAudit(
  db: Database,
  actor: SeoActor,
  input: {
    scope?: string;
    mode?: SeoAuditMode;
  },
) {
  assertAdminAccess(actor);
  const [created] = await db
    .insert(seoAudits)
    .values({
      initiated_by: actor.actorUserId ?? null,
      scope: input.scope?.trim() || "all_pages",
      mode: input.mode ?? "full",
      status: "pending",
      updated_at: new Date(),
    })
    .returning();

  if (!created) {
    throw createHttpError(500, "Unable to create SEO audit");
  }

  return toAuditRecord(created);
}

export async function getSeoAuditById(db: Database, actor: SeoActor, auditId: string) {
  assertAdminAccess(actor);
  const [audit] = await db
    .select()
    .from(seoAudits)
    .where(eq(seoAudits.id, auditId))
    .limit(1);

  if (!audit) {
    throw createHttpError(404, "SEO audit not found");
  }

  return {
    audit: toAuditRecord(audit),
  };
}

export async function listSeoAuditItems(db: Database, actor: SeoActor, auditId: string) {
  assertAdminAccess(actor);
  const rows = await db
    .select()
    .from(seoAuditItems)
    .where(eq(seoAuditItems.audit_id, auditId))
    .orderBy(asc(seoAuditItems.page_key), asc(seoAuditItems.severity), asc(seoAuditItems.created_at));

  return {
    items: rows.map(toAuditItemRecord),
  };
}

export async function listSeoAudits(db: Database, actor: SeoActor) {
  assertAdminAccess(actor);
  const rows = await db
    .select()
    .from(seoAudits)
    .orderBy(desc(seoAudits.created_at));

  return {
    audits: rows.map(toAuditRecord),
  };
}

export async function runSeoAuditJob(
  db: Database,
  auditId: string,
  logger: SeoLogger,
) {
  const [audit] = await db
    .select()
    .from(seoAudits)
    .where(eq(seoAudits.id, auditId))
    .limit(1);

  if (!audit) {
    throw createHttpError(404, "SEO audit not found");
  }

  if (audit.status === "running") {
    return;
  }

  await db
    .update(seoAudits)
    .set({
      status: "running",
      failure_reason: null,
      updated_at: new Date(),
    })
    .where(eq(seoAudits.id, auditId));

  try {
    const pages = getAuditableSeoPages();
    const snapshots = await Promise.all(
      pages.map(async (page) => {
        const snapshot = await getCurrentSeoSnapshot(db, page.key);
        const scraped = audit.mode === "full"
          ? await scrapeSeoPageContent(page.key, logger)
          : { pageKey: page.key, url: page.path, pageTitle: page.label, content: null };
        return {
          page,
          snapshot,
          scraped,
        };
      }),
    );

    const issues: AuditIssueInput[] = [];
    const titleMap = new Map<string, string[]>();
    const descriptionMap = new Map<string, string[]>();
    const scoringPages: Array<{
      hasTitle: boolean;
      hasDescription: boolean;
      hasPrimaryKeyword: boolean;
      hasOgImage: boolean;
      robotsIndex: boolean;
      titleHasPrimaryKeyword: boolean;
      descriptionOrContentHasPrimaryKeyword: boolean;
      hasSecondaryKeywords: boolean;
    }> = [];

    for (const entry of snapshots) {
      const title = normalizeText(entry.snapshot.title);
      const metaDescription = normalizeText(entry.snapshot.metaDescription);
      const ogImage = normalizeText(entry.snapshot.ogImage);
      const content = normalizeText(entry.scraped.content);
      const primaryKeyword = entry.snapshot.keywords.primary[0] ?? "";
      const titleHasPrimaryKeyword = primaryKeyword ? hasKeyword(title, primaryKeyword) : false;
      const descriptionOrContentHasPrimaryKeyword = primaryKeyword
        ? hasKeyword(metaDescription, primaryKeyword) || hasKeyword(content, primaryKeyword)
        : false;

      if (title) {
        const bucket = titleMap.get(title) ?? [];
        bucket.push(entry.page.key);
        titleMap.set(title, bucket);
      }
      if (metaDescription) {
        const bucket = descriptionMap.get(metaDescription) ?? [];
        bucket.push(entry.page.key);
        descriptionMap.set(metaDescription, bucket);
      }

      scoringPages.push({
        hasTitle: Boolean(title),
        hasDescription: Boolean(metaDescription),
        hasPrimaryKeyword: entry.snapshot.keywords.primary.length > 0,
        hasOgImage: Boolean(ogImage),
        robotsIndex: entry.snapshot.robotsIndex,
        titleHasPrimaryKeyword,
        descriptionOrContentHasPrimaryKeyword,
        hasSecondaryKeywords: entry.snapshot.keywords.secondary.length > 0,
      });

      issues.push(...detectPageIssues({
        pageKey: entry.page.key,
        title,
        metaDescription,
        ogImage,
        robotsIndex: entry.snapshot.robotsIndex,
        keywordsPrimary: entry.snapshot.keywords.primary,
        keywordsSecondary: entry.snapshot.keywords.secondary,
        content,
      }));
    }

    for (const [title, pageKeys] of titleMap.entries()) {
      if (pageKeys.length > 1) {
        for (const pageKey of pageKeys) {
          pushIssue(issues, {
            pageKey,
            issueType: "duplicate_title",
            severity: "high",
            description: "This title exactly matches another audited page title.",
            detectedValue: title,
            recommendedValue: "Differentiate this title so each page has unique search intent.",
          });
        }
      }
    }

    for (const [description, pageKeys] of descriptionMap.entries()) {
      if (pageKeys.length > 1) {
        for (const pageKey of pageKeys) {
          pushIssue(issues, {
            pageKey,
            issueType: "duplicate_meta_description",
            severity: "high",
            description: "This meta description exactly matches another audited page description.",
            detectedValue: description,
            recommendedValue: "Differentiate the description for the page's specific intent.",
          });
        }
      }
    }

    await db.delete(seoAuditItems).where(eq(seoAuditItems.audit_id, auditId));

    if (issues.length > 0) {
      await db.insert(seoAuditItems).values(
        issues.map((issue) => ({
          audit_id: auditId,
          page_key: issue.pageKey,
          issue_type: issue.issueType,
          severity: issue.severity,
          description: issue.description,
          detected_value: issue.detectedValue ?? null,
          recommended_value: issue.recommendedValue ?? null,
          updated_at: new Date(),
        })),
      );
    }

    const issuesBySeverity = {
      low: issues.filter((issue) => issue.severity === "low").length,
      medium: issues.filter((issue) => issue.severity === "medium").length,
      high: issues.filter((issue) => issue.severity === "high").length,
    };

    const pageIssueCounts = new Map<string, number>();
    for (const issue of issues) {
      pageIssueCounts.set(issue.pageKey, (pageIssueCounts.get(issue.pageKey) ?? 0) + 1);
    }

    const duplicateTitlePages = Array.from(titleMap.values()).filter((pageKeys) => pageKeys.length > 1)
      .reduce((count, pageKeys) => count + pageKeys.length, 0);
    const duplicateDescriptionPages = Array.from(descriptionMap.values()).filter((pageKeys) => pageKeys.length > 1)
      .reduce((count, pageKeys) => count + pageKeys.length, 0);

    const score = calculateSeoHealthScore({
      pages: scoringPages,
      duplicateTitlePages,
      duplicateDescriptionPages,
    });
    const previousSummary = await getPreviousAuditSummary(db);
    const previousScore = previousSummary?.healthScore ?? null;
    const summaryJson: SeoAuditSummaryJson = {
      pagesScanned: pages.length,
      totalIssues: issues.length,
      issuesBySeverity,
      pagesAffected: pages
        .filter((page) => pageIssueCounts.has(page.key))
        .map((page) => ({
          pageKey: page.key,
          issueCount: pageIssueCounts.get(page.key) ?? 0,
        })),
      healthScore: score.total,
      previousScore,
      delta: previousScore == null ? null : score.total - previousScore,
    };

    await db
      .update(seoAudits)
      .set({
        summary_json: summaryJson,
        status: "complete",
        completed_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(seoAudits.id, auditId));

    await generateSeoRecommendationsForAudit(db, auditId, logger);
    await rebuildSeoReportForAudit(db, auditId);
  } catch (error) {
    await db
      .update(seoAudits)
      .set({
        status: "failed",
        failure_reason: error instanceof Error ? error.message : String(error),
        updated_at: new Date(),
      })
      .where(eq(seoAudits.id, auditId));

    logger.error?.(
      {
        auditId,
        error: error instanceof Error ? error.message : String(error),
      },
      "seo_audit_job_failed",
    );
    throw error;
  }
}

export async function listLatestCompletedAudit(db: Database, actor: SeoActor) {
  assertAdminAccess(actor);
  const [audit] = await db
    .select()
    .from(seoAudits)
    .where(eq(seoAudits.status, "complete"))
    .orderBy(desc(seoAudits.created_at))
    .limit(1);

  return {
    audit: audit ? toAuditRecord(audit) : null,
  };
}
