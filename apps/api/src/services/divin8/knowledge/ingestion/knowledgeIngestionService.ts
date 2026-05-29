import type { Database } from "@wisdom/db";
import type { Divin8KnowledgeSourceDetailResponse } from "@wisdom/utils";
import { invalidateKnowledgeCache } from "../cache/knowledgeCache.js";
import { KnowledgeRepository } from "../repositories/knowledgeRepository.js";
import { saveKnowledgeSourceFile } from "../storage/localKnowledgeSourceStorage.js";
import type { KnowledgeIngestionInput } from "../types/knowledgeTypes.js";
import { buildKnowledgeIngestionPreview, sha256Hex } from "./dryRunIngestionService.js";

async function persistPreview(
  repository: KnowledgeRepository,
  input: {
    sourceId: string;
    versionId: string;
    category: KnowledgeIngestionInput["category"];
    authorityLevel: KnowledgeIngestionInput["authorityLevel"];
    extractedText: string;
    adminUserId: string;
    chunks: Awaited<ReturnType<typeof buildKnowledgeIngestionPreview>>["chunks"];
    concepts: Awaited<ReturnType<typeof buildKnowledgeIngestionPreview>>["concepts"];
    overrides: Awaited<ReturnType<typeof buildKnowledgeIngestionPreview>>["overrides"];
  },
) {
  const extractedTextHash = sha256Hex(input.extractedText);
  await repository.saveExtractedText({
    sourceId: input.sourceId,
    versionId: input.versionId,
    extractedText: input.extractedText,
    textHash: extractedTextHash,
  });
  await repository.replaceVersionDerivedRecords({
    sourceId: input.sourceId,
    versionId: input.versionId,
    category: input.category,
    authorityLevel: input.authorityLevel,
    chunks: input.chunks,
    concepts: input.concepts,
    overrides: input.overrides,
  });
  await repository.markVersionReady({
    sourceId: input.sourceId,
    versionId: input.versionId,
    extractedTextHash,
    adminUserId: input.adminUserId,
  });
}

export async function ingestKnowledgeSource(
  db: Database,
  input: KnowledgeIngestionInput,
): Promise<Divin8KnowledgeSourceDetailResponse> {
  const repository = new KnowledgeRepository(db);
  const contentHash = sha256Hex(input.file.buffer);
  const { sourcePath } = await saveKnowledgeSourceFile(input.file.buffer, input.file.mimeType);
  const created = await repository.createInitialSource({
    name: input.name,
    category: input.category,
    authorityLevel: input.authorityLevel,
    originalFilename: input.file.originalFilename,
    mimeType: input.file.mimeType,
    fileSize: input.file.size,
    sourcePath,
    contentHash,
    adminUserId: input.adminUserId,
  });

  try {
    const preview = await buildKnowledgeIngestionPreview(input);
    await persistPreview(repository, {
      sourceId: created.source.id,
      versionId: created.version.id,
      category: input.category,
      authorityLevel: input.authorityLevel,
      extractedText: preview.extractedText,
      chunks: preview.chunks,
      concepts: preview.concepts,
      overrides: preview.overrides,
      adminUserId: input.adminUserId,
    });
    await repository.writeAuditLog({
      adminUserId: input.adminUserId,
      actionType: "upload",
      sourceId: created.source.id,
      versionId: created.version.id,
      after: { name: input.name, category: input.category, authorityLevel: input.authorityLevel },
    });
    invalidateKnowledgeCache();
    return repository.getSourceDetail(created.source.id);
  } catch (error) {
    await repository.markVersionFailed({
      sourceId: created.source.id,
      versionId: created.version.id,
      reason: error instanceof Error ? error.message : "Knowledge ingestion failed.",
      adminUserId: input.adminUserId,
    });
    throw error;
  }
}

export async function replaceKnowledgeSource(
  db: Database,
  sourceId: string,
  input: KnowledgeIngestionInput,
) {
  const repository = new KnowledgeRepository(db);
  const contentHash = sha256Hex(input.file.buffer);
  const { sourcePath } = await saveKnowledgeSourceFile(input.file.buffer, input.file.mimeType);
  const version = await repository.createReplacementVersion({
    sourceId,
    originalFilename: input.file.originalFilename,
    mimeType: input.file.mimeType,
    fileSize: input.file.size,
    sourcePath,
    contentHash,
    adminUserId: input.adminUserId,
  });

  try {
    const preview = await buildKnowledgeIngestionPreview(input);
    await persistPreview(repository, {
      sourceId,
      versionId: version.id,
      category: input.category,
      authorityLevel: input.authorityLevel,
      extractedText: preview.extractedText,
      chunks: preview.chunks,
      concepts: preview.concepts,
      overrides: preview.overrides,
      adminUserId: input.adminUserId,
    });
    await repository.writeAuditLog({
      adminUserId: input.adminUserId,
      actionType: "replace",
      sourceId,
      versionId: version.id,
      after: { category: input.category, authorityLevel: input.authorityLevel },
    });
    invalidateKnowledgeCache();
    return repository.getSourceDetail(sourceId);
  } catch (error) {
    await repository.markVersionFailed({
      sourceId,
      versionId: version.id,
      reason: error instanceof Error ? error.message : "Knowledge replacement failed.",
      adminUserId: input.adminUserId,
    });
    throw error;
  }
}

export async function reprocessKnowledgeSourceVersion(
  db: Database,
  input: {
    sourceId: string;
    versionId: string;
    category: KnowledgeIngestionInput["category"];
    authorityLevel: KnowledgeIngestionInput["authorityLevel"];
    adminUserId: string;
  },
) {
  const repository = new KnowledgeRepository(db);
  const extractedText = await repository.getExtractedText(input.versionId);
  if (!extractedText) {
    throw new Error("Stored extracted text is unavailable for this version.");
  }
  const chunks = (await import("./knowledgeChunker.js")).chunkKnowledgeText(extractedText);
  const canonical = (await import("../canon/canonicalConceptService.js")).extractCanonicalKnowledge({
    category: input.category,
    authorityLevel: input.authorityLevel,
    chunks,
  });
  await persistPreview(repository, {
    sourceId: input.sourceId,
    versionId: input.versionId,
    category: input.category,
    authorityLevel: input.authorityLevel,
    extractedText,
    chunks,
    concepts: canonical.concepts,
    overrides: canonical.overrides,
    adminUserId: input.adminUserId,
  });
  await repository.writeAuditLog({
    adminUserId: input.adminUserId,
    actionType: "reprocess",
    sourceId: input.sourceId,
    versionId: input.versionId,
  });
  invalidateKnowledgeCache();
  return repository.getSourceDetail(input.sourceId);
}
