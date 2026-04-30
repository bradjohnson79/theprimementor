import { createHash } from "node:crypto";
import OpenAI from "openai";
import {
  seoAuditItems,
  seoAudits,
  seoRecommendations,
  type Database,
  type SeoRecommendationSnapshot,
  type SeoRecommendationValue,
} from "@wisdom/db";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  applyFieldValueToSnapshot,
  assertAdminAccess,
  assertAuditableSeoPageKey,
  getCurrentSeoSnapshot,
  getFieldValue,
  getSeoRegistryEntry,
  normalizeOptionalText,
  normalizeRecommendationValue,
  scrapeSeoPageContent,
  type SeoActor,
  type SeoLogger,
  type SeoRecommendationAction,
  type SeoRecommendationField,
  type SeoRecommendationStatus,
} from "./seoShared.js";
import { createHttpError } from "./booking/errors.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = process.env.OPENAI_SEO_MODEL?.trim()
  || process.env.OPENAI_MODEL?.trim()
  || "gpt-5.4-mini";

type RecommendationType =
  | "initial_generation"
  | "title_update"
  | "meta_description_update"
  | "keyword_update"
  | "og_image_update"
  | "indexing_update"
  | "no_change";

interface SeoRecommendationRecord {
  id: string;
  auditId: string | null;
  pageKey: string;
  type: RecommendationType;
  field: SeoRecommendationField | null;
  currentValue: SeoRecommendationValue;
  suggestedValue: SeoRecommendationValue;
  editedValue: SeoRecommendationValue;
  currentSnapshot: SeoRecommendationSnapshot;
  suggestedSnapshot: SeoRecommendationSnapshot;
  reasoning: string | null;
  expectedImpact: string | null;
  confidenceScore: number;
  action: SeoRecommendationAction;
  impact: "low" | "medium" | "high" | null;
  status: SeoRecommendationStatus | "applied" | "superseded";
  version: number;
  modelName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

interface GroupedAuditField {
  auditId: string;
  pageKey: string;
  field: SeoRecommendationField;
  severity: "low" | "medium" | "high";
  issueTypes: string[];
  descriptions: string[];
}

interface ParsedStructuredRecommendation {
  field: SeoRecommendationField;
  suggestedValue: SeoRecommendationValue;
  reasoning: string;
  confidenceScore: number;
  expectedImpact: string;
  action: SeoRecommendationAction;
}

function toRecommendationRecord(row: typeof seoRecommendations.$inferSelect): SeoRecommendationRecord {
  return {
    id: row.id,
    auditId: row.audit_id ?? null,
    pageKey: row.page_key,
    type: row.type,
    field: row.field ?? null,
    currentValue: (row.current_value as SeoRecommendationValue | null) ?? null,
    suggestedValue: (row.suggested_value as SeoRecommendationValue | null) ?? null,
    editedValue: (row.edited_value as SeoRecommendationValue | null) ?? null,
    currentSnapshot: row.current_snapshot,
    suggestedSnapshot: row.suggested_snapshot,
    reasoning: row.reasoning ?? row.reason ?? null,
    expectedImpact: row.expected_impact ?? row.expected_outcome ?? null,
    confidenceScore: row.confidence_score ?? row.confidence ?? 0,
    action: row.action ?? "update",
    impact: row.impact,
    status: row.status,
    version: row.version ?? 1,
    modelName: row.model_name ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at?.toISOString() ?? row.created_at.toISOString(),
    resolvedAt: row.resolved_at?.toISOString() ?? null,
  };
}

function mapIssueTypeToField(issueType: string): SeoRecommendationField | null {
  switch (issueType) {
    case "missing_title":
    case "weak_title_length":
    case "title_too_long":
    case "missing_primary_keyword_title":
    case "duplicate_title":
      return "title";
    case "missing_meta_description":
    case "weak_meta_description_length":
    case "meta_description_too_long":
    case "missing_description_cta":
    case "duplicate_meta_description":
    case "primary_keyword_gap":
      return "meta_description";
    case "missing_primary_keywords":
    case "missing_secondary_keywords":
      return "keywords";
    case "missing_og_image":
      return "og_image";
    case "noindex_blocked":
      return "indexing";
    default:
      return null;
  }
}

function mapFieldToType(field: SeoRecommendationField, action: SeoRecommendationAction): RecommendationType {
  if (action === "no_change") {
    return "no_change";
  }
  switch (field) {
    case "title":
      return "title_update";
    case "meta_description":
      return "meta_description_update";
    case "keywords":
      return "keyword_update";
    case "og_image":
      return "og_image_update";
    case "indexing":
      return "indexing_update";
  }
}

function getPromptEnvelope(systemPrompt: string, userPrompt: string) {
  return {
    model: OPENAI_MODEL,
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ],
    response_format: { type: "json_object" as const },
  };
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

function readAction(value: unknown) {
  const action = typeof value === "string" ? value.trim() : "";
  if (action !== "update" && action !== "no_change") {
    throw createHttpError(502, "OpenAI SEO response returned invalid action");
  }
  return action as SeoRecommendationAction;
}

function readConfidence(value: unknown) {
  const next = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(next)) {
    throw createHttpError(502, "OpenAI SEO response missing confidenceScore");
  }
  return Math.max(0, Math.min(100, Math.round(next)));
}

function parseSuggestedValue(field: SeoRecommendationField, value: unknown): SeoRecommendationValue {
  if (field === "indexing") {
    if (typeof value !== "boolean") {
      throw createHttpError(502, "OpenAI SEO response returned invalid indexing value");
    }
    return value;
  }
  if (field === "keywords") {
    if (!value || typeof value !== "object") {
      throw createHttpError(502, "OpenAI SEO response returned invalid keywords value");
    }
    return normalizeRecommendationValue({
      primary: Array.isArray((value as Record<string, unknown>).primary)
        ? (value as Record<string, unknown>).primary as string[]
        : [],
      secondary: Array.isArray((value as Record<string, unknown>).secondary)
        ? (value as Record<string, unknown>).secondary as string[]
        : [],
    });
  }
  if (typeof value !== "string") {
    throw createHttpError(502, "OpenAI SEO response returned invalid suggested value");
  }
  return normalizeOptionalText(value);
}

function parseRecommendationPayload(
  field: SeoRecommendationField,
  payload: Record<string, unknown>,
): ParsedStructuredRecommendation {
  const responseField = readString(payload.field, "field");
  if (responseField !== field) {
    throw createHttpError(502, "OpenAI SEO response returned mismatched field");
  }
  return {
    field,
    suggestedValue: parseSuggestedValue(field, payload.suggestedValue),
    reasoning: readString(payload.reasoning, "reasoning"),
    confidenceScore: readConfidence(payload.confidenceScore),
    expectedImpact: readString(payload.expectedImpact, "expectedImpact"),
    action: readAction(payload.action),
  };
}

async function requestRecommendation(
  systemPrompt: string,
  userPrompt: string,
) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw createHttpError(503, "OPENAI_API_KEY is not configured");
  }
  const response = await openai.chat.completions.create(getPromptEnvelope(systemPrompt, userPrompt));
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw createHttpError(502, "OpenAI returned an empty SEO recommendation");
  }
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw createHttpError(502, "OpenAI returned invalid SEO recommendation JSON");
  }
}

function buildRecommendationPrompt(input: {
  pageKey: string;
  pageLabel: string;
  pageIntent: string;
  field: SeoRecommendationField;
  currentValue: SeoRecommendationValue;
  issueTypes: string[];
  issueDescriptions: string[];
  severity: "low" | "medium" | "high";
  pageContent: string | null;
}) {
  return `You are generating a review-only SEO recommendation for The Prime Mentor admin dashboard.

You must think like a senior SEO strategist, but return ONLY strict JSON.

Rules:
- This is a controlled system. Never auto-apply changes.
- Respect the page intent:
  - home = authority + brand
  - sessions = conversion
  - reports = product intent
  - about = trust
  - contact = clarity
- Avoid keyword stuffing
- Keep titles under 60 characters
- Keep descriptions between 140 and 160 characters when possible
- If the current value is already strong and aligned, return action "no_change"
- Do not invent cosmetic rewrites
- expectedImpact must describe one likely outcome such as "better keyword alignment", "improved clarity", or "higher CTR"

Input:
Page Key: ${input.pageKey}
Page Label: ${input.pageLabel}
Page Intent: ${input.pageIntent}
Field: ${input.field}
Severity: ${input.severity}
Current Value: ${JSON.stringify(input.currentValue)}
Issue Types: ${JSON.stringify(input.issueTypes)}
Issue Descriptions: ${JSON.stringify(input.issueDescriptions)}
Page Content Excerpt: ${JSON.stringify(input.pageContent)}

Return ONLY JSON in this format:
{
  "field": "${input.field}",
  "suggestedValue": "field-appropriate value",
  "reasoning": "why this improves SEO",
  "confidenceScore": 0-100,
  "expectedImpact": "higher CTR | better keyword alignment | improved clarity",
  "action": "update" | "no_change"
}`;
}

function buildRecommendationHash(input: {
  auditId: string;
  pageKey: string;
  field: SeoRecommendationField;
  suggestedValue: SeoRecommendationValue;
  action: SeoRecommendationAction;
}) {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

function groupAuditItems(rows: Array<typeof seoAuditItems.$inferSelect>): GroupedAuditField[] {
  const grouped = new Map<string, GroupedAuditField>();
  const severityRank = new Map<"low" | "medium" | "high", number>([
    ["low", 1],
    ["medium", 2],
    ["high", 3],
  ]);

  for (const row of rows) {
    const field = mapIssueTypeToField(row.issue_type);
    if (!field) {
      continue;
    }
    const key = `${row.audit_id}:${row.page_key}:${field}`;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        auditId: row.audit_id,
        pageKey: row.page_key,
        field,
        severity: row.severity,
        issueTypes: [row.issue_type],
        descriptions: [row.description],
      });
      continue;
    }
    current.issueTypes.push(row.issue_type);
    current.descriptions.push(row.description);
    if ((severityRank.get(row.severity) ?? 0) > (severityRank.get(current.severity) ?? 0)) {
      current.severity = row.severity;
    }
  }

  return Array.from(grouped.values());
}

async function insertRecommendation(
  db: Database,
  input: {
    auditId: string;
    pageKey: string;
    field: SeoRecommendationField;
    currentSnapshot: SeoRecommendationSnapshot;
    currentValue: SeoRecommendationValue;
    suggestedSnapshot: SeoRecommendationSnapshot;
    suggestedValue: SeoRecommendationValue;
    reasoning: string;
    expectedImpact: string;
    confidenceScore: number;
    action: SeoRecommendationAction;
    severity: "low" | "medium" | "high";
  },
) {
  const dedupeHash = buildRecommendationHash({
    auditId: input.auditId,
    pageKey: input.pageKey,
    field: input.field,
    suggestedValue: input.suggestedValue,
    action: input.action,
  });
  const [created] = await db
    .insert(seoRecommendations)
    .values({
      audit_id: input.auditId,
      page_key: input.pageKey,
      type: mapFieldToType(input.field, input.action),
      field: input.field,
      current_value: input.currentValue,
      suggested_value: input.suggestedValue,
      current_snapshot: input.currentSnapshot,
      suggested_snapshot: input.suggestedSnapshot,
      reasoning: input.reasoning,
      reason: input.reasoning,
      expected_impact: input.expectedImpact,
      expected_outcome: input.expectedImpact,
      confidence_score: input.confidenceScore,
      confidence: Number((input.confidenceScore / 100).toFixed(3)),
      action: input.action,
      impact: input.severity,
      source: "initial_scan",
      status: "pending",
      dedupe_hash: dedupeHash,
      model_name: OPENAI_MODEL,
      updated_at: new Date(),
      last_recommendation_at: new Date(),
    })
    .returning();

  if (!created) {
    throw createHttpError(500, "Unable to store SEO recommendation");
  }

  return toRecommendationRecord(created);
}

export async function generateSeoRecommendationsForAudit(
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

  const itemRows = await db
    .select()
    .from(seoAuditItems)
    .where(eq(seoAuditItems.audit_id, auditId))
    .orderBy(asc(seoAuditItems.page_key), asc(seoAuditItems.created_at));

  const grouped = groupAuditItems(itemRows);
  if (grouped.length === 0) {
    return { recommendations: [] as SeoRecommendationRecord[] };
  }

  await db.delete(seoRecommendations).where(eq(seoRecommendations.audit_id, auditId));

  const recommendations: SeoRecommendationRecord[] = [];
  for (const group of grouped) {
    const pageKey = assertAuditableSeoPageKey(group.pageKey);
    const page = getSeoRegistryEntry(pageKey);
    if (!page) {
      continue;
    }
    const currentSnapshot = await getCurrentSeoSnapshot(db, page.key);
    const currentValue = getFieldValue(currentSnapshot, group.field);
    const pageContent = audit.mode === "full"
      ? await scrapeSeoPageContent(page.key, logger)
      : { pageKey: page.key, url: page.path, pageTitle: page.label, content: null };

    const payload = await requestRecommendation(
      "Return only valid JSON. Do not include markdown, commentary, or extra text.",
      buildRecommendationPrompt({
        pageKey: page.key,
        pageLabel: page.label,
        pageIntent: page.intent,
        field: group.field,
        currentValue,
        issueTypes: group.issueTypes,
        issueDescriptions: group.descriptions,
        severity: group.severity,
        pageContent: pageContent.content,
      }),
    );

    const parsed = parseRecommendationPayload(group.field, payload);
    const suggestedValue = parsed.action === "no_change"
      ? currentValue
      : parsed.suggestedValue;
    const suggestedSnapshot = applyFieldValueToSnapshot(currentSnapshot, group.field, suggestedValue);
    recommendations.push(await insertRecommendation(db, {
      auditId,
      pageKey: page.key,
      field: group.field,
      currentSnapshot,
      currentValue,
      suggestedSnapshot,
      suggestedValue,
      reasoning: parsed.reasoning,
      expectedImpact: parsed.expectedImpact,
      confidenceScore: parsed.confidenceScore,
      action: parsed.action,
      severity: group.severity,
    }));
  }

  return { recommendations };
}

export async function listSeoRecommendations(
  db: Database,
  actor: SeoActor,
  filters?: { auditId?: string; pageKey?: string; status?: string },
) {
  assertAdminAccess(actor);
  const conditions = [];
  if (filters?.auditId) {
    conditions.push(eq(seoRecommendations.audit_id, filters.auditId));
  }
  if (filters?.pageKey) {
    conditions.push(eq(seoRecommendations.page_key, assertAuditableSeoPageKey(filters.pageKey)));
  }
  if (filters?.status) {
    const status = filters.status.trim() as SeoRecommendationRecord["status"];
    if (["pending", "approved", "rejected", "edited", "applied", "superseded"].includes(status)) {
      conditions.push(eq(seoRecommendations.status, status));
    }
  }

  const rows = await db
    .select()
    .from(seoRecommendations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(seoRecommendations.created_at), asc(seoRecommendations.page_key));

  return {
    recommendations: rows.map(toRecommendationRecord),
  };
}

export const __seoRecommendationTestUtils = {
  mapIssueTypeToField,
  parseRecommendationPayload,
};
