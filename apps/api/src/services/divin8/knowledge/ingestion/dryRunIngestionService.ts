import { createHash } from "node:crypto";
import type { Divin8KnowledgePreviewResponse } from "@wisdom/utils";
import { extractCanonicalKnowledge } from "../canon/canonicalConceptService.js";
import type { KnowledgeIngestionInput, KnowledgeIngestionPreview } from "../types/knowledgeTypes.js";
import { chunkKnowledgeText } from "./knowledgeChunker.js";
import { extractKnowledgeSourceText } from "./sourceTextExtractor.js";

export function sha256Hex(bufferOrText: Buffer | string) {
  return createHash("sha256").update(bufferOrText).digest("hex");
}

function toPreviewResponse(preview: KnowledgeIngestionPreview): Divin8KnowledgePreviewResponse {
  return {
    extractedTextPreview: preview.extractedText.slice(0, 4000),
    chunks: preview.chunks.slice(0, 20).map((chunk) => ({
      title: chunk.title,
      content: chunk.content,
      concepts: chunk.concepts,
      keywords: chunk.keywords,
    })),
    concepts: preview.concepts.map((concept) => ({
      category: concept.category,
      conceptKey: concept.conceptKey,
      displayName: concept.displayName,
      canonicalMeanings: concept.canonicalMeanings,
      forbiddenInterpretations: concept.forbiddenInterpretations,
      preferredTerms: concept.preferredTerms,
      replacementRules: concept.replacementRules,
      authorityLevel: concept.authorityLevel,
      priority: concept.priority,
      active: concept.active,
      sourceKind: concept.sourceKind,
    })),
    overrides: preview.overrides.map((override) => ({
      category: override.category,
      ruleKey: override.ruleKey,
      alwaysUse: override.alwaysUse,
      neverUse: override.neverUse,
      replacements: override.replacements,
      authorityLevel: override.authorityLevel,
      priority: override.priority,
      active: override.active,
      sourceKind: override.sourceKind,
    })),
  };
}

export async function buildKnowledgeIngestionPreview(input: KnowledgeIngestionInput) {
  const extractedText = await extractKnowledgeSourceText({
    buffer: input.file.buffer,
    mimeType: input.file.mimeType,
    filename: input.file.originalFilename,
  });
  if (!extractedText) {
    throw new Error("No text could be extracted from this source.");
  }
  const chunks = chunkKnowledgeText(extractedText);
  const canonical = extractCanonicalKnowledge({
    category: input.category,
    authorityLevel: input.authorityLevel,
    chunks,
  });
  return {
    extractedText,
    chunks,
    concepts: canonical.concepts,
    overrides: canonical.overrides,
  } satisfies KnowledgeIngestionPreview;
}

export async function previewKnowledgeSource(input: KnowledgeIngestionInput) {
  return toPreviewResponse(await buildKnowledgeIngestionPreview(input));
}
