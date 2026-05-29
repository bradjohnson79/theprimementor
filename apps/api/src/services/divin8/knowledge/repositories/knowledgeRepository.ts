import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  divin8CanonicalConcepts,
  divin8KnowledgeAuditLogs,
  divin8KnowledgeChunks,
  divin8KnowledgeExtractedTexts,
  divin8KnowledgeOverrides,
  divin8KnowledgeSources,
  divin8KnowledgeSourceVersions,
  type Database,
} from "@wisdom/db";
import type {
  Divin8CanonicalConceptResponse,
  Divin8KnowledgeAuthorityLevel,
  Divin8KnowledgeCategory,
  Divin8KnowledgeOverrideResponse,
  Divin8KnowledgeSourceDetailResponse,
  Divin8KnowledgeSourceSummary,
  Divin8KnowledgeSourceVersion,
  Divin8KnowledgeStatus,
} from "@wisdom/utils";
import type {
  CanonicalConceptDraft,
  KnowledgeAuditInput,
  KnowledgeChunkDraft,
  KnowledgeOverrideDraft,
} from "../types/knowledgeTypes.js";

type SourceRow = typeof divin8KnowledgeSources.$inferSelect;
type VersionRow = typeof divin8KnowledgeSourceVersions.$inferSelect;
type ChunkRow = typeof divin8KnowledgeChunks.$inferSelect;
type ConceptRow = typeof divin8CanonicalConcepts.$inferSelect;
type OverrideRow = typeof divin8KnowledgeOverrides.$inferSelect;

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim())).map((entry) => entry.trim())
    : [];
}

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export function mapKnowledgeSource(row: SourceRow): Divin8KnowledgeSourceSummary {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Divin8KnowledgeCategory,
    authorityLevel: row.authority_level as Divin8KnowledgeAuthorityLevel,
    status: row.status as Divin8KnowledgeStatus,
    enabled: row.enabled,
    currentVersionId: row.current_version_id,
    currentVersionLabel: row.current_version_label,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    uploadedAt: row.created_at.toISOString(),
    updatedAt: row.updated_at?.toISOString() ?? null,
    lastProcessedAt: row.last_processed_at?.toISOString() ?? null,
  };
}

export function mapKnowledgeVersion(row: VersionRow): Divin8KnowledgeSourceVersion {
  return {
    id: row.id,
    sourceId: row.source_id,
    versionNumber: row.version_number,
    versionLabel: row.version_label,
    status: row.status as Divin8KnowledgeStatus,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    failureReason: row.failure_reason,
    processedAt: row.processed_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export function mapKnowledgeConcept(row: ConceptRow): Divin8CanonicalConceptResponse {
  return {
    id: row.id,
    category: row.category as Divin8KnowledgeCategory,
    conceptKey: row.concept_key,
    displayName: row.display_name,
    canonicalMeanings: asStringArray(row.canonical_meanings),
    forbiddenInterpretations: asStringArray(row.forbidden_interpretations),
    preferredTerms: asStringArray(row.preferred_terms),
    replacementRules: asRecord(row.replacement_rules),
    authorityLevel: row.authority_level as Divin8KnowledgeAuthorityLevel,
    priority: row.priority,
    active: row.active,
    sourceKind: row.source_kind === "manual" ? "manual" : "extracted",
    sourceId: row.source_id,
    versionId: row.version_id,
    updatedAt: row.updated_at?.toISOString() ?? null,
  };
}

export function mapKnowledgeOverride(row: OverrideRow): Divin8KnowledgeOverrideResponse {
  return {
    id: row.id,
    category: row.category as Divin8KnowledgeCategory,
    ruleKey: row.rule_key,
    alwaysUse: row.always_use,
    neverUse: asStringArray(row.never_use),
    replacements: asRecord(row.replacements),
    authorityLevel: row.authority_level as Divin8KnowledgeAuthorityLevel,
    priority: row.priority,
    active: row.active,
    sourceKind: row.source_kind === "extracted" ? "extracted" : "manual",
    conceptId: row.concept_id,
    updatedAt: row.updated_at?.toISOString() ?? null,
  };
}

function mapChunkPreview(row: ChunkRow) {
  return {
    title: row.title,
    content: row.content,
    concepts: asStringArray(row.concepts),
    keywords: asStringArray(row.keywords),
  };
}

export class KnowledgeRepository {
  constructor(private readonly db: Database) {}

  async listSources() {
    const rows = await this.db
      .select()
      .from(divin8KnowledgeSources)
      .where(isNull(divin8KnowledgeSources.deleted_at))
      .orderBy(desc(divin8KnowledgeSources.updated_at), desc(divin8KnowledgeSources.created_at));
    return rows.map(mapKnowledgeSource);
  }

  async getSourceDetail(sourceId: string): Promise<Divin8KnowledgeSourceDetailResponse> {
    const [source] = await this.db
      .select()
      .from(divin8KnowledgeSources)
      .where(and(eq(divin8KnowledgeSources.id, sourceId), isNull(divin8KnowledgeSources.deleted_at)))
      .limit(1);
    if (!source) {
      throw new Error("Knowledge source not found.");
    }

    const [versions, concepts, overrides, chunks] = await Promise.all([
      this.db
        .select()
        .from(divin8KnowledgeSourceVersions)
        .where(eq(divin8KnowledgeSourceVersions.source_id, sourceId))
        .orderBy(desc(divin8KnowledgeSourceVersions.version_number)),
      this.db
        .select()
        .from(divin8CanonicalConcepts)
        .where(eq(divin8CanonicalConcepts.source_id, sourceId))
        .orderBy(desc(divin8CanonicalConcepts.priority), desc(divin8CanonicalConcepts.updated_at)),
      this.db
        .select()
        .from(divin8KnowledgeOverrides)
        .where(eq(divin8KnowledgeOverrides.source_id, sourceId))
        .orderBy(desc(divin8KnowledgeOverrides.priority), desc(divin8KnowledgeOverrides.updated_at)),
      this.db
        .select()
        .from(divin8KnowledgeChunks)
        .where(eq(divin8KnowledgeChunks.source_id, sourceId))
        .orderBy(divin8KnowledgeChunks.chunk_index)
        .limit(25),
    ]);

    return {
      source: mapKnowledgeSource(source),
      versions: versions.map(mapKnowledgeVersion),
      concepts: concepts.map(mapKnowledgeConcept),
      overrides: overrides.map(mapKnowledgeOverride),
      chunks: chunks.map(mapChunkPreview),
    };
  }

  async createInitialSource(input: {
    name: string;
    category: Divin8KnowledgeCategory;
    authorityLevel: Divin8KnowledgeAuthorityLevel;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    sourcePath: string;
    contentHash: string;
    adminUserId: string;
  }) {
    const now = new Date();
    const [source] = await this.db
      .insert(divin8KnowledgeSources)
      .values({
        name: input.name,
        category: input.category,
        authority_level: input.authorityLevel,
        status: "processing",
        enabled: true,
        original_filename: input.originalFilename,
        mime_type: input.mimeType,
        file_size: input.fileSize,
        source_path: input.sourcePath,
        content_hash: input.contentHash,
        created_by: input.adminUserId,
        updated_by: input.adminUserId,
        created_at: now,
        updated_at: now,
      })
      .returning();

    const [version] = await this.db
      .insert(divin8KnowledgeSourceVersions)
      .values({
        source_id: source.id,
        version_number: 1,
        version_label: "v1",
        status: "processing",
        source_path: input.sourcePath,
        original_filename: input.originalFilename,
        mime_type: input.mimeType,
        file_size: input.fileSize,
        content_hash: input.contentHash,
        created_by: input.adminUserId,
        created_at: now,
        updated_at: now,
      })
      .returning();

    await this.db
      .update(divin8KnowledgeSources)
      .set({
        current_version_id: version.id,
        current_version_label: version.version_label,
        updated_at: now,
      })
      .where(eq(divin8KnowledgeSources.id, source.id));

    return {
      source: mapKnowledgeSource({ ...source, current_version_id: version.id, current_version_label: version.version_label }),
      version: mapKnowledgeVersion(version),
    };
  }

  async createReplacementVersion(input: {
    sourceId: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    sourcePath: string;
    contentHash: string;
    adminUserId: string;
  }) {
    const versions = await this.db
      .select()
      .from(divin8KnowledgeSourceVersions)
      .where(eq(divin8KnowledgeSourceVersions.source_id, input.sourceId))
      .orderBy(desc(divin8KnowledgeSourceVersions.version_number))
      .limit(1);
    const nextVersionNumber = (versions[0]?.version_number ?? 0) + 1;
    const now = new Date();
    const [version] = await this.db
      .insert(divin8KnowledgeSourceVersions)
      .values({
        source_id: input.sourceId,
        version_number: nextVersionNumber,
        version_label: `v${nextVersionNumber}`,
        status: "processing",
        source_path: input.sourcePath,
        original_filename: input.originalFilename,
        mime_type: input.mimeType,
        file_size: input.fileSize,
        content_hash: input.contentHash,
        created_by: input.adminUserId,
        created_at: now,
        updated_at: now,
      })
      .returning();

    await this.db
      .update(divin8KnowledgeSources)
      .set({
        status: "processing",
        original_filename: input.originalFilename,
        mime_type: input.mimeType,
        file_size: input.fileSize,
        source_path: input.sourcePath,
        content_hash: input.contentHash,
        updated_by: input.adminUserId,
        updated_at: now,
      })
      .where(eq(divin8KnowledgeSources.id, input.sourceId));

    return mapKnowledgeVersion(version);
  }

  async saveExtractedText(input: {
    sourceId: string;
    versionId: string;
    extractedText: string;
    textHash: string;
  }) {
    await this.db
      .insert(divin8KnowledgeExtractedTexts)
      .values({
        source_id: input.sourceId,
        version_id: input.versionId,
        extracted_text: input.extractedText,
        text_hash: input.textHash,
      })
      .onConflictDoUpdate({
        target: divin8KnowledgeExtractedTexts.version_id,
        set: {
          extracted_text: input.extractedText,
          text_hash: input.textHash,
          updated_at: new Date(),
        },
      });
  }

  async getExtractedText(versionId: string) {
    const [row] = await this.db
      .select()
      .from(divin8KnowledgeExtractedTexts)
      .where(eq(divin8KnowledgeExtractedTexts.version_id, versionId))
      .limit(1);
    return row?.extracted_text ?? null;
  }

  async replaceVersionDerivedRecords(input: {
    sourceId: string;
    versionId: string;
    category: Divin8KnowledgeCategory;
    authorityLevel: Divin8KnowledgeAuthorityLevel;
    chunks: KnowledgeChunkDraft[];
    concepts: CanonicalConceptDraft[];
    overrides: KnowledgeOverrideDraft[];
  }) {
    await this.db
      .delete(divin8KnowledgeChunks)
      .where(eq(divin8KnowledgeChunks.version_id, input.versionId));
    await this.db
      .delete(divin8CanonicalConcepts)
      .where(and(
        eq(divin8CanonicalConcepts.version_id, input.versionId),
        eq(divin8CanonicalConcepts.source_kind, "extracted"),
      ));
    await this.db
      .delete(divin8KnowledgeOverrides)
      .where(and(
        eq(divin8KnowledgeOverrides.version_id, input.versionId),
        eq(divin8KnowledgeOverrides.source_kind, "extracted"),
      ));

    const insertedChunks = input.chunks.length > 0
      ? await this.db
          .insert(divin8KnowledgeChunks)
          .values(input.chunks.map((chunk, index) => ({
            source_id: input.sourceId,
            version_id: input.versionId,
            category: input.category,
            authority_level: input.authorityLevel,
            chunk_index: index,
            title: chunk.title,
            content: chunk.content,
            keywords: chunk.keywords,
            concepts: chunk.concepts,
            metadata: chunk.metadata ?? {},
            enabled: true,
          })))
          .returning()
      : [];

    if (input.concepts.length > 0) {
      await this.db.insert(divin8CanonicalConcepts).values(input.concepts.map((concept) => ({
        source_id: input.sourceId,
        version_id: input.versionId,
        chunk_id: insertedChunks.find((chunk) => asStringArray(chunk.concepts).includes(concept.conceptKey))?.id ?? null,
        category: concept.category,
        concept_key: concept.conceptKey,
        display_name: concept.displayName,
        canonical_meanings: concept.canonicalMeanings,
        forbidden_interpretations: concept.forbiddenInterpretations,
        preferred_terms: concept.preferredTerms,
        replacement_rules: concept.replacementRules,
        authority_level: concept.authorityLevel,
        priority: concept.priority,
        source_kind: "extracted",
        active: concept.active,
      })));
    }

    if (input.overrides.length > 0) {
      await this.db.insert(divin8KnowledgeOverrides).values(input.overrides.map((override) => ({
        source_id: input.sourceId,
        version_id: input.versionId,
        category: override.category,
        rule_key: override.ruleKey,
        always_use: override.alwaysUse,
        never_use: override.neverUse,
        replacements: override.replacements,
        authority_level: override.authorityLevel,
        priority: override.priority,
        active: override.active,
        source_kind: "extracted",
      })));
    }
  }

  async markVersionReady(input: {
    sourceId: string;
    versionId: string;
    extractedTextHash: string;
    adminUserId: string;
  }) {
    const now = new Date();
    const [version] = await this.db
      .update(divin8KnowledgeSourceVersions)
      .set({
        status: "ready",
        extracted_text_hash: input.extractedTextHash,
        failure_reason: null,
        processed_at: now,
        updated_at: now,
      })
      .where(eq(divin8KnowledgeSourceVersions.id, input.versionId))
      .returning();

    await this.db
      .update(divin8KnowledgeSources)
      .set({
        status: "ready",
        current_version_id: input.versionId,
        current_version_label: version.version_label,
        last_processed_at: now,
        updated_by: input.adminUserId,
        updated_at: now,
      })
      .where(eq(divin8KnowledgeSources.id, input.sourceId));
  }

  async markVersionFailed(input: {
    sourceId: string;
    versionId: string;
    reason: string;
    adminUserId: string;
  }) {
    const now = new Date();
    await this.db
      .update(divin8KnowledgeSourceVersions)
      .set({ status: "failed", failure_reason: input.reason, updated_at: now })
      .where(eq(divin8KnowledgeSourceVersions.id, input.versionId));
    await this.db
      .update(divin8KnowledgeSources)
      .set({ status: "failed", updated_by: input.adminUserId, updated_at: now })
      .where(eq(divin8KnowledgeSources.id, input.sourceId));
  }

  async rollbackSource(input: { sourceId: string; versionId: string; adminUserId: string }) {
    const [version] = await this.db
      .select()
      .from(divin8KnowledgeSourceVersions)
      .where(and(
        eq(divin8KnowledgeSourceVersions.id, input.versionId),
        eq(divin8KnowledgeSourceVersions.source_id, input.sourceId),
      ))
      .limit(1);
    if (!version) {
      throw new Error("Knowledge version not found.");
    }
    const now = new Date();
    await this.db
      .update(divin8KnowledgeSources)
      .set({
        current_version_id: version.id,
        current_version_label: version.version_label,
        status: version.status,
        updated_by: input.adminUserId,
        updated_at: now,
      })
      .where(eq(divin8KnowledgeSources.id, input.sourceId));
  }

  async disableSource(input: { sourceId: string; adminUserId: string }) {
    await this.db
      .update(divin8KnowledgeSources)
      .set({
        enabled: false,
        status: "disabled",
        updated_by: input.adminUserId,
        updated_at: new Date(),
      })
      .where(eq(divin8KnowledgeSources.id, input.sourceId));
  }

  async softDeleteSource(input: { sourceId: string; adminUserId: string }) {
    await this.db
      .update(divin8KnowledgeSources)
      .set({
        enabled: false,
        status: "deleted",
        deleted_at: new Date(),
        updated_by: input.adminUserId,
        updated_at: new Date(),
      })
      .where(eq(divin8KnowledgeSources.id, input.sourceId));
  }

  async listCurrentConcepts(input: { categories?: Divin8KnowledgeCategory[]; conceptKeys?: string[] }) {
    const clauses = [eq(divin8CanonicalConcepts.active, true)];
    if (input.categories?.length) {
      clauses.push(inArray(divin8CanonicalConcepts.category, input.categories));
    }
    if (input.conceptKeys?.length) {
      clauses.push(inArray(divin8CanonicalConcepts.concept_key, input.conceptKeys));
    }
    const rows = await this.db
      .select()
      .from(divin8CanonicalConcepts)
      .where(and(...clauses))
      .orderBy(desc(divin8CanonicalConcepts.priority), desc(divin8CanonicalConcepts.updated_at))
      .limit(80);
    return rows.map(mapKnowledgeConcept);
  }

  async listCurrentOverrides(input: { categories?: Divin8KnowledgeCategory[]; ruleKeys?: string[] }) {
    const clauses = [eq(divin8KnowledgeOverrides.active, true)];
    if (input.categories?.length) {
      clauses.push(inArray(divin8KnowledgeOverrides.category, input.categories));
    }
    if (input.ruleKeys?.length) {
      clauses.push(inArray(divin8KnowledgeOverrides.rule_key, input.ruleKeys));
    }
    const rows = await this.db
      .select()
      .from(divin8KnowledgeOverrides)
      .where(and(...clauses))
      .orderBy(desc(divin8KnowledgeOverrides.priority), desc(divin8KnowledgeOverrides.updated_at))
      .limit(80);
    return rows.map(mapKnowledgeOverride);
  }

  async listCurrentChunks(input: { categories?: Divin8KnowledgeCategory[] }) {
    const clauses = [
      eq(divin8KnowledgeChunks.enabled, true),
      eq(divin8KnowledgeSources.enabled, true),
      isNull(divin8KnowledgeSources.deleted_at),
      eq(divin8KnowledgeChunks.version_id, divin8KnowledgeSources.current_version_id),
    ];
    if (input.categories?.length) {
      clauses.push(inArray(divin8KnowledgeChunks.category, input.categories));
    }

    const rows = await this.db
      .select({
        chunk: divin8KnowledgeChunks,
        sourceName: divin8KnowledgeSources.name,
      })
      .from(divin8KnowledgeChunks)
      .innerJoin(divin8KnowledgeSources, eq(divin8KnowledgeChunks.source_id, divin8KnowledgeSources.id))
      .where(and(...clauses))
      .orderBy(desc(divin8KnowledgeChunks.updated_at))
      .limit(200);

    return rows.map(({ chunk, sourceName }) => ({
      id: chunk.id,
      sourceId: chunk.source_id,
      sourceName,
      category: chunk.category as Divin8KnowledgeCategory,
      authorityLevel: chunk.authority_level as Divin8KnowledgeAuthorityLevel,
      title: chunk.title,
      content: chunk.content,
      keywords: asStringArray(chunk.keywords),
      concepts: asStringArray(chunk.concepts),
      updatedAt: chunk.updated_at?.toISOString() ?? null,
    }));
  }

  async createManualConcept(input: CanonicalConceptDraft & { adminUserId: string }) {
    const [row] = await this.db
      .insert(divin8CanonicalConcepts)
      .values({
        category: input.category,
        concept_key: input.conceptKey,
        display_name: input.displayName,
        canonical_meanings: input.canonicalMeanings,
        forbidden_interpretations: input.forbiddenInterpretations,
        preferred_terms: input.preferredTerms,
        replacement_rules: input.replacementRules,
        authority_level: input.authorityLevel,
        priority: input.priority,
        source_kind: "manual",
        active: input.active,
        created_by: input.adminUserId,
        updated_by: input.adminUserId,
      })
      .returning();
    return mapKnowledgeConcept(row);
  }

  async updateManualConcept(conceptId: string, input: Partial<CanonicalConceptDraft> & { adminUserId: string }) {
    const [row] = await this.db
      .update(divin8CanonicalConcepts)
      .set({
        ...(input.category ? { category: input.category } : {}),
        ...(input.conceptKey ? { concept_key: input.conceptKey } : {}),
        ...(input.displayName ? { display_name: input.displayName } : {}),
        ...(input.canonicalMeanings ? { canonical_meanings: input.canonicalMeanings } : {}),
        ...(input.forbiddenInterpretations ? { forbidden_interpretations: input.forbiddenInterpretations } : {}),
        ...(input.preferredTerms ? { preferred_terms: input.preferredTerms } : {}),
        ...(input.replacementRules ? { replacement_rules: input.replacementRules } : {}),
        ...(input.authorityLevel ? { authority_level: input.authorityLevel } : {}),
        ...(typeof input.priority === "number" ? { priority: input.priority } : {}),
        ...(typeof input.active === "boolean" ? { active: input.active } : {}),
        updated_by: input.adminUserId,
        updated_at: new Date(),
      })
      .where(eq(divin8CanonicalConcepts.id, conceptId))
      .returning();
    if (!row) {
      throw new Error("Knowledge concept not found.");
    }
    return mapKnowledgeConcept(row);
  }

  async createManualOverride(input: KnowledgeOverrideDraft & { adminUserId: string }) {
    const [row] = await this.db
      .insert(divin8KnowledgeOverrides)
      .values({
        category: input.category,
        rule_key: input.ruleKey,
        always_use: input.alwaysUse,
        never_use: input.neverUse,
        replacements: input.replacements,
        authority_level: input.authorityLevel,
        priority: input.priority,
        active: input.active,
        source_kind: "manual",
        concept_id: input.conceptId ?? null,
        created_by: input.adminUserId,
        updated_by: input.adminUserId,
      })
      .returning();
    return mapKnowledgeOverride(row);
  }

  async updateManualOverride(overrideId: string, input: Partial<KnowledgeOverrideDraft> & { adminUserId: string }) {
    const [row] = await this.db
      .update(divin8KnowledgeOverrides)
      .set({
        ...(input.category ? { category: input.category } : {}),
        ...(input.ruleKey ? { rule_key: input.ruleKey } : {}),
        ...(input.alwaysUse !== undefined ? { always_use: input.alwaysUse } : {}),
        ...(input.neverUse ? { never_use: input.neverUse } : {}),
        ...(input.replacements ? { replacements: input.replacements } : {}),
        ...(input.authorityLevel ? { authority_level: input.authorityLevel } : {}),
        ...(typeof input.priority === "number" ? { priority: input.priority } : {}),
        ...(typeof input.active === "boolean" ? { active: input.active } : {}),
        ...(input.conceptId !== undefined ? { concept_id: input.conceptId } : {}),
        updated_by: input.adminUserId,
        updated_at: new Date(),
      })
      .where(eq(divin8KnowledgeOverrides.id, overrideId))
      .returning();
    if (!row) {
      throw new Error("Knowledge override not found.");
    }
    return mapKnowledgeOverride(row);
  }

  async writeAuditLog(input: KnowledgeAuditInput) {
    await this.db.insert(divin8KnowledgeAuditLogs).values({
      admin_user_id: input.adminUserId,
      action_type: input.actionType,
      source_id: input.sourceId ?? null,
      version_id: input.versionId ?? null,
      concept_id: input.conceptId ?? null,
      override_id: input.overrideId ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
    });
  }
}
