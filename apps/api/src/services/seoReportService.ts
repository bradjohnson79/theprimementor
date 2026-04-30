import { exportPdfFromMarkdown } from "./reportExport.js";
import {
  seoAuditItems,
  seoAudits,
  seoChangesLog,
  seoRecommendations,
  seoReports,
  type Database,
  type SeoReportJson,
  type SeoRecommendationValue,
} from "@wisdom/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { assertAdminAccess, type SeoActor } from "./seoShared.js";
import { createHttpError } from "./booking/errors.js";

function toIso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function renderValue(value: SeoRecommendationValue) {
  if (value == null) {
    return "None";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function renderSeoReportMarkdown(report: SeoReportJson) {
  const lines: string[] = [];
  lines.push("## Overview");
  lines.push(`- Pages scanned: ${report.overview.pagesScanned}`);
  lines.push(`- Total issues: ${report.overview.totalIssues}`);
  lines.push(`- SEO health score: ${report.overview.healthScore}`);
  if (report.overview.previousScore != null && report.overview.delta != null) {
    lines.push(`- Previous score: ${report.overview.previousScore}`);
    lines.push(`- Delta: ${report.overview.delta >= 0 ? "+" : ""}${report.overview.delta}`);
  }

  lines.push("");
  lines.push("## Issues Found");
  for (const issue of report.issuesFound) {
    lines.push(`### ${issue.pageKey} · ${issue.severity}`);
    lines.push(`- Type: ${issue.issueType}`);
    lines.push(`- Description: ${issue.description}`);
    lines.push(`- Detected: ${renderValue(issue.detectedValue)}`);
    lines.push(`- Recommended: ${renderValue(issue.recommendedValue)}`);
  }

  lines.push("");
  lines.push("## Recommendations");
  for (const recommendation of report.recommendations) {
    lines.push(`### ${recommendation.pageKey} · ${recommendation.field}`);
    lines.push(`- Status: ${recommendation.status}`);
    lines.push(`- Current: ${renderValue(recommendation.currentValue)}`);
    lines.push(`- Suggested: ${renderValue(recommendation.suggestedValue)}`);
    if (recommendation.editedValue != null) {
      lines.push(`- Edited: ${renderValue(recommendation.editedValue)}`);
    }
    lines.push(`- Reasoning: ${recommendation.reasoning ?? "Not provided"}`);
    lines.push(`- Confidence: ${recommendation.confidenceScore}`);
    lines.push(`- Expected impact: ${recommendation.expectedImpact ?? "Not provided"}`);
  }

  lines.push("");
  lines.push("## Actions Taken");
  if (report.actionsTaken.length === 0) {
    lines.push("- No approved or rollback actions recorded yet.");
  } else {
    for (const action of report.actionsTaken) {
      lines.push(`### ${action.pageKey} · ${action.field}`);
      lines.push(`- Source: ${action.source}`);
      lines.push(`- Old value: ${renderValue(action.oldValue)}`);
      lines.push(`- New value: ${renderValue(action.newValue)}`);
      lines.push(`- Applied at: ${action.appliedAt}`);
    }
  }

  lines.push("");
  lines.push("## Strategic Insights");
  for (const insight of report.strategicInsights) {
    lines.push(`- ${insight}`);
  }

  lines.push("");
  lines.push("## Next Steps");
  for (const step of report.nextSteps) {
    lines.push(`- ${step}`);
  }

  return lines.join("\n");
}

export async function rebuildSeoReportForAudit(db: Database, auditId: string) {
  const [audit] = await db
    .select()
    .from(seoAudits)
    .where(eq(seoAudits.id, auditId))
    .limit(1);

  if (!audit) {
    throw createHttpError(404, "SEO audit not found");
  }

  const [items, recommendations] = await Promise.all([
    db.select().from(seoAuditItems).where(eq(seoAuditItems.audit_id, auditId)).orderBy(desc(seoAuditItems.created_at)),
    db.select().from(seoRecommendations).where(eq(seoRecommendations.audit_id, auditId)).orderBy(desc(seoRecommendations.created_at)),
  ]);
  const recommendationIds = recommendations.map((recommendation) => recommendation.id);
  const changes = recommendationIds.length === 0
    ? []
    : await db
      .select()
      .from(seoChangesLog)
      .where(inArray(seoChangesLog.recommendation_id, recommendationIds))
      .orderBy(desc(seoChangesLog.applied_at));

  const highSeverityCount = items.filter((item) => item.severity === "high").length;
  const mediumSeverityCount = items.filter((item) => item.severity === "medium").length;
  const rejectedCount = recommendations.filter((recommendation) => recommendation.status === "rejected").length;
  const pendingCount = recommendations.filter((recommendation) => recommendation.status === "pending").length;

  const reportJson: SeoReportJson = {
    overview: {
      auditId: audit.id,
      pagesScanned: audit.summary_json?.pagesScanned ?? 0,
      totalIssues: audit.summary_json?.totalIssues ?? items.length,
      healthScore: audit.summary_json?.healthScore ?? 0,
      previousScore: audit.summary_json?.previousScore ?? null,
      delta: audit.summary_json?.delta ?? null,
      createdAt: audit.created_at.toISOString(),
    },
    issuesFound: items.map((item) => ({
      pageKey: item.page_key,
      severity: item.severity,
      issueType: item.issue_type,
      description: item.description,
      detectedValue: (item.detected_value as SeoRecommendationValue | null) ?? null,
      recommendedValue: (item.recommended_value as SeoRecommendationValue | null) ?? null,
    })),
    recommendations: recommendations.map((recommendation) => ({
      recommendationId: recommendation.id,
      pageKey: recommendation.page_key,
      field: recommendation.field ?? "title",
      currentValue: (recommendation.current_value as SeoRecommendationValue | null) ?? null,
      suggestedValue: (recommendation.suggested_value as SeoRecommendationValue | null) ?? null,
      editedValue: (recommendation.edited_value as SeoRecommendationValue | null) ?? null,
      reasoning: recommendation.reasoning ?? recommendation.reason ?? null,
      confidenceScore: recommendation.confidence_score ?? recommendation.confidence ?? 0,
      expectedImpact: recommendation.expected_impact ?? recommendation.expected_outcome ?? null,
      status: recommendation.status,
    })),
    actionsTaken: changes.map((change) => ({
      changeId: change.id,
      pageKey: change.page_key,
      field: change.field,
      source: change.source,
      oldValue: (change.old_value as SeoRecommendationValue | null) ?? null,
      newValue: (change.new_value as SeoRecommendationValue | null) ?? null,
      appliedAt: change.applied_at.toISOString(),
      appliedBy: change.applied_by ?? null,
    })),
    strategicInsights: [
      highSeverityCount > 0
        ? `${highSeverityCount} high-severity issues should be resolved first to improve readiness.`
        : "No high-severity issues were detected in this audit.",
      mediumSeverityCount > 0
        ? `${mediumSeverityCount} medium-severity issues are limiting CTR or keyword alignment.`
        : "Medium-severity issue volume is currently low.",
      pendingCount > 0
        ? `${pendingCount} recommendations are still awaiting review.`
        : "All generated recommendations have been reviewed so far.",
      rejectedCount > 0
        ? `${rejectedCount} recommendations were rejected, indicating human review is actively filtering AI output.`
        : "No recommendations have been rejected from this audit yet.",
    ],
    nextSteps: [
      "Resolve all high-severity issues before broad experimentation.",
      "Review pending recommendations grouped by page intent and business priority.",
      "Re-run a quick audit after approval activity to measure score deltas.",
    ],
  };

  const [existing] = await db
    .select()
    .from(seoReports)
    .where(eq(seoReports.audit_id, auditId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(seoReports)
      .set({
        report_json: reportJson,
        pdf_url: `/api/seo/reports/${existing.id}/pdf`,
        updated_at: new Date(),
      })
      .where(eq(seoReports.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(seoReports)
    .values({
      audit_id: auditId,
      report_json: reportJson,
        pdf_url: "",
      updated_at: new Date(),
    })
    .returning();

  if (!created) {
    throw createHttpError(500, "Unable to create SEO report");
  }

  const [finalized] = await db
    .update(seoReports)
    .set({
      pdf_url: `/api/seo/reports/${created.id}/pdf`,
      updated_at: new Date(),
    })
    .where(eq(seoReports.id, created.id))
    .returning();

  return finalized ?? created;
}

export async function listSeoReports(db: Database, actor: SeoActor) {
  assertAdminAccess(actor);
  const rows = await db
    .select()
    .from(seoReports)
    .orderBy(desc(seoReports.created_at));

  return {
    reports: rows.map((row) => ({
      id: row.id,
      auditId: row.audit_id,
      createdAt: row.created_at.toISOString(),
      updatedAt: toIso(row.updated_at) ?? row.created_at.toISOString(),
      pdfUrl: row.pdf_url ?? null,
      report: row.report_json,
    })),
  };
}

export async function getSeoReportById(db: Database, actor: SeoActor, reportId: string) {
  assertAdminAccess(actor);
  const [report] = await db
    .select()
    .from(seoReports)
    .where(eq(seoReports.id, reportId))
    .limit(1);

  if (!report) {
    throw createHttpError(404, "SEO report not found");
  }

  return {
    report: {
      id: report.id,
      auditId: report.audit_id,
      createdAt: report.created_at.toISOString(),
      updatedAt: toIso(report.updated_at) ?? report.created_at.toISOString(),
      pdfUrl: report.pdf_url ?? null,
      reportJson: report.report_json,
    },
  };
}

export async function exportSeoReportPdf(db: Database, actor: SeoActor, reportId: string) {
  assertAdminAccess(actor);
  const { report } = await getSeoReportById(db, actor, reportId);
  const title = `Prime Mentor SEO Report ${report.createdAt.slice(0, 10)}`;
  const markdown = renderSeoReportMarkdown(report.reportJson);
  const pdf = await exportPdfFromMarkdown(title, markdown);
  return {
    filename: `prime-mentor-seo-report-${report.id}.pdf`,
    pdf,
  };
}

export async function getSeoReportByAuditId(db: Database, auditId: string) {
  const [report] = await db
    .select()
    .from(seoReports)
    .where(eq(seoReports.audit_id, auditId))
    .limit(1);
  return report ?? null;
}

export const __seoReportTestUtils = {
  renderSeoReportMarkdown,
};
