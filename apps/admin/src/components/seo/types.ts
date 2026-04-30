import type { SeoPageKey } from "@wisdom/utils";

export interface SeoKeywordBuckets {
  primary: string[];
  secondary: string[];
}

export interface SeoRecord {
  id: string;
  pageKey: SeoPageKey;
  title: string | null;
  metaDescription: string | null;
  keywords: SeoKeywordBuckets;
  ogImage: string | null;
  robotsIndex: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SeoPageDefinition {
  key: SeoPageKey;
  label: string;
  description: string;
}

export interface SeoAuditSummary {
  pagesScanned: number;
  totalIssues: number;
  issuesBySeverity: Record<"low" | "medium" | "high", number>;
  pagesAffected: Array<{
    pageKey: string;
    issueCount: number;
  }>;
  healthScore: number;
  previousScore: number | null;
  delta: number | null;
}

export interface SeoAudit {
  id: string;
  initiatedBy: string | null;
  scope: string;
  mode: "quick" | "full";
  status: "pending" | "running" | "complete" | "failed";
  summaryJson: SeoAuditSummary | null;
  completedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeoAuditItem {
  id: string;
  auditId: string;
  pageKey: string;
  issueType: string;
  severity: "low" | "medium" | "high";
  description: string;
  detectedValue: unknown;
  recommendedValue: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface SeoRecommendationSnapshot {
  title: string | null;
  metaDescription: string | null;
  keywords: SeoKeywordBuckets;
  ogImage: string | null;
  robotsIndex: boolean;
}

export type SeoRecommendationField = "title" | "meta_description" | "keywords" | "og_image" | "indexing";

export interface SeoRecommendation {
  id: string;
  auditId: string | null;
  pageKey: string;
  type: string;
  field: SeoRecommendationField | null;
  currentValue: unknown;
  suggestedValue: unknown;
  editedValue: unknown;
  currentSnapshot: SeoRecommendationSnapshot;
  suggestedSnapshot: SeoRecommendationSnapshot;
  reasoning: string | null;
  expectedImpact: string | null;
  confidenceScore: number;
  action: "update" | "no_change";
  impact: "low" | "medium" | "high" | null;
  status: "pending" | "approved" | "rejected" | "edited" | "applied" | "superseded";
  version: number;
  modelName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface SeoReportJson {
  overview: {
    auditId: string;
    pagesScanned: number;
    totalIssues: number;
    healthScore: number;
    previousScore: number | null;
    delta: number | null;
    createdAt: string;
  };
  issuesFound: Array<{
    pageKey: string;
    severity: "low" | "medium" | "high";
    issueType: string;
    description: string;
    detectedValue: unknown;
    recommendedValue: unknown;
  }>;
  recommendations: Array<{
    recommendationId: string;
    pageKey: string;
    field: SeoRecommendationField;
    currentValue: unknown;
    suggestedValue: unknown;
    editedValue: unknown;
    reasoning: string | null;
    confidenceScore: number;
    expectedImpact: string | null;
    status: string;
  }>;
  actionsTaken: Array<{
    changeId: string;
    pageKey: string;
    field: SeoRecommendationField;
    source: string;
    oldValue: unknown;
    newValue: unknown;
    appliedAt: string;
    appliedBy: string | null;
  }>;
  strategicInsights: string[];
  nextSteps: string[];
}

export interface SeoReport {
  id: string;
  auditId: string;
  createdAt: string;
  updatedAt: string;
  pdfUrl: string | null;
  report?: SeoReportJson;
  reportJson?: SeoReportJson;
}
