import type {
  CanonicalConceptDraft,
  KnowledgeChunkDraft,
  KnowledgeOverrideDraft,
} from "../types/knowledgeTypes.js";
import type {
  Divin8KnowledgeAuthorityLevel,
  Divin8KnowledgeCategory,
} from "@wisdom/utils";
import { extractAstrologyConcepts } from "./conceptExtractors/astrologyConceptExtractor.js";
import { extractBaziConcepts } from "./conceptExtractors/baziConceptExtractor.js";
import { extractGenericConcepts } from "./conceptExtractors/genericConceptExtractor.js";
import { extractNumerologyConcepts } from "./conceptExtractors/numerologyConceptExtractor.js";
import { extractRuneConcepts } from "./conceptExtractors/runeConceptExtractor.js";

function mergeUnique(left: string[], right: string[]) {
  return [...new Set([...left, ...right].map((value) => value.trim()).filter(Boolean))];
}

function dedupeConcepts(concepts: CanonicalConceptDraft[]) {
  const byKey = new Map<string, CanonicalConceptDraft>();
  for (const concept of concepts) {
    const key = `${concept.category}:${concept.conceptKey}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, concept);
      continue;
    }
    byKey.set(key, {
      ...existing,
      canonicalMeanings: mergeUnique(existing.canonicalMeanings, concept.canonicalMeanings),
      forbiddenInterpretations: mergeUnique(existing.forbiddenInterpretations, concept.forbiddenInterpretations),
      preferredTerms: mergeUnique(existing.preferredTerms, concept.preferredTerms),
      replacementRules: { ...existing.replacementRules, ...concept.replacementRules },
      priority: Math.max(existing.priority, concept.priority),
    });
  }
  return [...byKey.values()];
}

function dedupeOverrides(overrides: KnowledgeOverrideDraft[]) {
  const byKey = new Map<string, KnowledgeOverrideDraft>();
  for (const override of overrides) {
    const key = `${override.category}:${override.ruleKey}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, override);
      continue;
    }
    byKey.set(key, {
      ...existing,
      neverUse: mergeUnique(existing.neverUse, override.neverUse),
      replacements: { ...existing.replacements, ...override.replacements },
      alwaysUse: existing.alwaysUse ?? override.alwaysUse,
      priority: Math.max(existing.priority, override.priority),
    });
  }
  return [...byKey.values()];
}

export function extractCanonicalKnowledge(input: {
  category: Divin8KnowledgeCategory;
  authorityLevel: Divin8KnowledgeAuthorityLevel;
  chunks: KnowledgeChunkDraft[];
}) {
  const extractorInput = {
    category: input.category,
    authorityLevel: input.authorityLevel,
    chunks: input.chunks,
  };
  const results = [
    input.category.startsWith("numerology") ? extractNumerologyConcepts(extractorInput) : null,
    input.category.startsWith("chinese_bazi") ? extractBaziConcepts(extractorInput) : null,
    input.category.includes("astrology") ? extractAstrologyConcepts(extractorInput) : null,
    input.category === "runes" ? extractRuneConcepts(extractorInput) : null,
    extractGenericConcepts(extractorInput),
  ].filter((result): result is { concepts: CanonicalConceptDraft[]; overrides: KnowledgeOverrideDraft[] } => Boolean(result));

  return {
    concepts: dedupeConcepts(results.flatMap((result) => result.concepts)),
    overrides: dedupeOverrides(results.flatMap((result) => result.overrides)),
  };
}
