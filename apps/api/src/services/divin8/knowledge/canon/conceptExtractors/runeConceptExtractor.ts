import { createConcept, normalizeConceptKey, type ConceptExtractorInput } from "./shared.js";

const RUNE_NAMES = /\b(fehu|uruz|thurisaz|ansuz|raidho|kenaz|gebo|wunjo|hagalaz|nauthiz|isa|jera|eihwaz|perthro|algiz|sowilo|tiwaz|berkano|ehwaz|mannaz|laguz|ingwaz|dagaz|othala)\b/i;

export function extractRuneConcepts(input: ConceptExtractorInput) {
  const concepts = [];
  for (const chunk of input.chunks) {
    const match = chunk.content.match(RUNE_NAMES);
    if (!match) {
      continue;
    }
    const displayName = match[1];
    concepts.push(createConcept({
      category: input.category,
      authorityLevel: input.authorityLevel,
      conceptKey: normalizeConceptKey(displayName),
      displayName,
      canonicalMeanings: chunk.keywords.slice(0, 6),
      preferredTerms: [displayName],
      priority: 30,
    }));
  }
  return { concepts, overrides: [] };
}
