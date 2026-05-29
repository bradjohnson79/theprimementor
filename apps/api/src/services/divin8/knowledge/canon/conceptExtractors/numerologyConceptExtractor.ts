import { createConcept, createOverride, type ConceptExtractorInput } from "./shared.js";

const LIFE_PATH_REGEX = /\blife\s+path\s+(\d{1,2})\b([\s\S]{0,700})/gi;

function extractTerms(text: string) {
  const preferred = new Set<string>();
  const forbidden = new Set<string>();
  const lower = text.toLowerCase();

  for (const term of ["completion", "culmination", "wisdom", "refinement", "endings", "transcendence"]) {
    if (lower.includes(term)) preferred.add(term);
  }
  for (const term of ["humanitarian", "martyr"]) {
    if (lower.includes(`not ${term}`) || lower.includes(`avoid ${term}`) || lower.includes(`never ${term}`)) {
      forbidden.add(term);
    }
  }

  return { preferred: [...preferred], forbidden: [...forbidden] };
}

export function extractNumerologyConcepts(input: ConceptExtractorInput) {
  const concepts = [];
  const overrides = [];
  for (const chunk of input.chunks) {
    for (const match of chunk.content.matchAll(LIFE_PATH_REGEX)) {
      const number = match[1];
      const context = match[0] ?? "";
      const terms = extractTerms(context);
      const conceptKey = `life_path_${number}`;
      concepts.push(createConcept({
        category: input.category,
        authorityLevel: input.authorityLevel,
        conceptKey,
        displayName: `Life Path ${number}`,
        canonicalMeanings: terms.preferred,
        forbiddenInterpretations: terms.forbidden,
        preferredTerms: terms.preferred,
        priority: input.authorityLevel === "hard_override" ? 100 : 50,
      }));
      if (terms.forbidden.length > 0 || input.authorityLevel === "hard_override") {
        overrides.push(createOverride({
          category: input.category,
          ruleKey: conceptKey,
          neverUse: terms.forbidden,
          priority: input.authorityLevel === "hard_override" ? 120 : 80,
        }));
      }
    }
  }
  return { concepts, overrides };
}
