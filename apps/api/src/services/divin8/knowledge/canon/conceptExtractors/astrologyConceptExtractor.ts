import { createConcept, normalizeConceptKey, type ConceptExtractorInput } from "./shared.js";

export function extractAstrologyConcepts(input: ConceptExtractorInput) {
  const concepts = [];
  for (const chunk of input.chunks) {
    const match = chunk.content.match(/\b(?:moon|sun|ascendant|rising|twelfth house|12th house|venus|mars|saturn|jupiter)\b/i);
    if (!match) {
      continue;
    }
    const displayName = chunk.title ?? match[0];
    concepts.push(createConcept({
      category: input.category,
      authorityLevel: input.authorityLevel,
      conceptKey: normalizeConceptKey(displayName),
      displayName,
      canonicalMeanings: chunk.keywords.slice(0, 6),
      preferredTerms: chunk.keywords.slice(0, 6),
      priority: 30,
    }));
  }
  return { concepts, overrides: [] };
}
