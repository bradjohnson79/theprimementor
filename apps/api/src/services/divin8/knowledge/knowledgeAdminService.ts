import type { Database } from "@wisdom/db";
import {
  isDivin8KnowledgeAuthorityLevel,
  isDivin8KnowledgeCategory,
  isDivin8KnowledgeRetrievalMode,
} from "@wisdom/utils";
import { invalidateKnowledgeCache } from "./cache/knowledgeCache.js";
import { createKnowledgeConcept, updateKnowledgeConcept } from "./canon/conceptEditorService.js";
import { previewKnowledgeSource } from "./ingestion/dryRunIngestionService.js";
import {
  ingestKnowledgeSource,
  replaceKnowledgeSource,
  reprocessKnowledgeSourceVersion,
} from "./ingestion/knowledgeIngestionService.js";
import { createKnowledgeOverride, updateKnowledgeOverride } from "./overrides/overrideEditorService.js";
import { KnowledgeRepository } from "./repositories/knowledgeRepository.js";
import { testKnowledgeRetrieval } from "./retrieval/knowledgeRetrievalDebugService.js";
import type {
  CanonicalConceptDraft,
  KnowledgeIngestionInput,
  KnowledgeOverrideDraft,
} from "./types/knowledgeTypes.js";

function requireString(value: unknown, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new Error(`${label} is required.`);
  }
  return text;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim())).map((entry) => entry.trim())
    : [];
}

function stringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export function validateKnowledgeUploadInput(input: {
  name: unknown;
  category: unknown;
  authorityLevel: unknown;
  file: KnowledgeIngestionInput["file"];
  adminUserId: string;
}): KnowledgeIngestionInput {
  if (!isDivin8KnowledgeCategory(input.category)) {
    throw new Error("A valid knowledge category is required.");
  }
  if (!isDivin8KnowledgeAuthorityLevel(input.authorityLevel)) {
    throw new Error("A valid authority level is required.");
  }
  return {
    name: requireString(input.name, "Source name"),
    category: input.category,
    authorityLevel: input.authorityLevel,
    file: input.file,
    adminUserId: input.adminUserId,
  };
}

export function validateConceptInput(body: unknown, adminUserId: string): CanonicalConceptDraft & { adminUserId: string } {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  if (!isDivin8KnowledgeCategory(input.category)) {
    throw new Error("A valid knowledge category is required.");
  }
  if (!isDivin8KnowledgeAuthorityLevel(input.authorityLevel)) {
    throw new Error("A valid authority level is required.");
  }
  return {
    category: input.category,
    authorityLevel: input.authorityLevel,
    conceptKey: requireString(input.conceptKey, "Concept key"),
    displayName: requireString(input.displayName, "Display name"),
    canonicalMeanings: stringArray(input.canonicalMeanings),
    forbiddenInterpretations: stringArray(input.forbiddenInterpretations),
    preferredTerms: stringArray(input.preferredTerms),
    replacementRules: stringRecord(input.replacementRules),
    priority: typeof input.priority === "number" ? input.priority : 0,
    active: typeof input.active === "boolean" ? input.active : true,
    sourceKind: "manual",
    adminUserId,
  };
}

export function validateOverrideInput(body: unknown, adminUserId: string): KnowledgeOverrideDraft & { adminUserId: string } {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  if (!isDivin8KnowledgeCategory(input.category)) {
    throw new Error("A valid knowledge category is required.");
  }
  const authorityLevel = isDivin8KnowledgeAuthorityLevel(input.authorityLevel)
    ? input.authorityLevel
    : "hard_override";
  return {
    category: input.category,
    authorityLevel,
    ruleKey: requireString(input.ruleKey, "Rule key"),
    alwaysUse: typeof input.alwaysUse === "string" && input.alwaysUse.trim() ? input.alwaysUse.trim() : null,
    neverUse: stringArray(input.neverUse),
    replacements: stringRecord(input.replacements),
    priority: typeof input.priority === "number" ? input.priority : 100,
    active: typeof input.active === "boolean" ? input.active : true,
    sourceKind: "manual",
    conceptId: typeof input.conceptId === "string" && input.conceptId.trim() ? input.conceptId.trim() : null,
    adminUserId,
  };
}

export async function listKnowledgeSources(db: Database) {
  return { sources: await new KnowledgeRepository(db).listSources() };
}

export async function getKnowledgeSourceDetail(db: Database, sourceId: string) {
  return new KnowledgeRepository(db).getSourceDetail(sourceId);
}

export async function previewKnowledgeUpload(input: KnowledgeIngestionInput) {
  return previewKnowledgeSource(input);
}

export async function uploadKnowledgeSource(db: Database, input: KnowledgeIngestionInput) {
  return ingestKnowledgeSource(db, input);
}

export async function replaceKnowledgeSourceVersion(db: Database, sourceId: string, input: KnowledgeIngestionInput) {
  return replaceKnowledgeSource(db, sourceId, input);
}

export async function reprocessKnowledgeSource(db: Database, input: {
  sourceId: string;
  versionId: string;
  category: KnowledgeIngestionInput["category"];
  authorityLevel: KnowledgeIngestionInput["authorityLevel"];
  adminUserId: string;
}) {
  return reprocessKnowledgeSourceVersion(db, input);
}

export async function rollbackKnowledgeSource(db: Database, sourceId: string, versionId: string, adminUserId: string) {
  const repository = new KnowledgeRepository(db);
  await repository.rollbackSource({ sourceId, versionId, adminUserId });
  await repository.writeAuditLog({ adminUserId, actionType: "rollback", sourceId, versionId });
  invalidateKnowledgeCache();
  return repository.getSourceDetail(sourceId);
}

export async function disableKnowledgeSource(db: Database, sourceId: string, adminUserId: string) {
  const repository = new KnowledgeRepository(db);
  await repository.disableSource({ sourceId, adminUserId });
  await repository.writeAuditLog({ adminUserId, actionType: "disable", sourceId });
  invalidateKnowledgeCache();
  return repository.getSourceDetail(sourceId);
}

export async function deleteKnowledgeSource(db: Database, sourceId: string, adminUserId: string) {
  const repository = new KnowledgeRepository(db);
  await repository.softDeleteSource({ sourceId, adminUserId });
  await repository.writeAuditLog({ adminUserId, actionType: "delete", sourceId });
  invalidateKnowledgeCache();
  return { id: sourceId, deleted: true };
}

export { createKnowledgeConcept, updateKnowledgeConcept, createKnowledgeOverride, updateKnowledgeOverride };

export async function runKnowledgeRetrievalTest(db: Database, body: unknown) {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const query = requireString(input.query, "Query");
  const categories = Array.isArray(input.categories)
    ? input.categories.filter(isDivin8KnowledgeCategory)
    : undefined;
  const mode = isDivin8KnowledgeRetrievalMode(input.mode) ? input.mode : "chat";
  return testKnowledgeRetrieval(db, { query, categories, mode });
}
