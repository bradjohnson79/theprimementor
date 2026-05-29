import { createConcept, normalizeConceptKey, type ConceptExtractorInput } from "./shared.js";

export function extractGenericConcepts(input: ConceptExtractorInput) {
  const concepts = [];
  for (const chunk of input.chunks) {
    if (!chunk.title || chunk.title.length < 3) {
      continue;
    }
    const conceptKey = normalizeConceptKey(chunk.title);
    if (!conceptKey) {
      continue;
    }
    concepts.push(createConcept({
      category: input.category,
      authorityLevel: input.authorityLevel,
      conceptKey,
      displayName: chunk.title,
      canonicalMeanings: chunk.keywords.slice(0, 6),
      preferredTerms: chunk.keywords.slice(0, 6),
      priority: input.authorityLevel === "hard_override" ? 70 : 20,
    }));
  }
  return { concepts, overrides: [] };
}
