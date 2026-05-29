import { createConcept, createOverride, type ConceptExtractorInput } from "./shared.js";

const BRANCH_FOUR_REGEX = /\b(?:animal\s+)?branch\s+4\b|\bfourth\s+(?:animal\s+)?branch\b|\bcat\b/gi;

export function extractBaziConcepts(input: ConceptExtractorInput) {
  const concepts = [];
  const overrides = [];
  const joined = input.chunks.map((chunk) => chunk.content).join("\n\n");
  const mentionsBranchFour = BRANCH_FOUR_REGEX.test(joined);
  const mentionsRabbitAsForbidden = /\b(?:not|never|avoid|instead\s+of)\s+(?:the\s+)?rabbit\b/i.test(joined)
    || /\brabbit\b/i.test(joined) && /\bcat\b/i.test(joined);

  if (mentionsBranchFour) {
    concepts.push(createConcept({
      category: input.category,
      authorityLevel: input.authorityLevel,
      conceptKey: "animal_branch_4",
      displayName: "Animal Branch 4",
      canonicalMeanings: ["Cat"],
      forbiddenInterpretations: mentionsRabbitAsForbidden ? ["Rabbit"] : [],
      preferredTerms: ["Cat"],
      replacementRules: mentionsRabbitAsForbidden ? { Rabbit: "Cat" } : {},
      priority: input.authorityLevel === "hard_override" ? 120 : 70,
    }));
    overrides.push(createOverride({
      category: input.category,
      ruleKey: "animal_branch_4",
      alwaysUse: "Cat",
      neverUse: mentionsRabbitAsForbidden ? ["Rabbit"] : [],
      replacements: mentionsRabbitAsForbidden ? { Rabbit: "Cat" } : {},
      priority: input.authorityLevel === "hard_override" ? 140 : 95,
    }));
  }

  return { concepts, overrides };
}
