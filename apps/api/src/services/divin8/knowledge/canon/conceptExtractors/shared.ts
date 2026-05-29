import type {
  CanonicalConceptDraft,
  KnowledgeChunkDraft,
  KnowledgeOverrideDraft,
} from "../../types/knowledgeTypes.js";
import type {
  Divin8KnowledgeAuthorityLevel,
  Divin8KnowledgeCategory,
} from "@wisdom/utils";

export interface ConceptExtractorInput {
  category: Divin8KnowledgeCategory;
  authorityLevel: Divin8KnowledgeAuthorityLevel;
  chunks: KnowledgeChunkDraft[];
}

export interface ConceptExtractorResult {
  concepts: CanonicalConceptDraft[];
  overrides: KnowledgeOverrideDraft[];
}

export function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function normalizeConceptKey(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function createConcept(input: {
  category: Divin8KnowledgeCategory;
  authorityLevel: Divin8KnowledgeAuthorityLevel;
  conceptKey: string;
  displayName: string;
  canonicalMeanings?: string[];
  forbiddenInterpretations?: string[];
  preferredTerms?: string[];
  replacementRules?: Record<string, string>;
  priority?: number;
}): CanonicalConceptDraft {
  return {
    category: input.category,
    authorityLevel: input.authorityLevel,
    conceptKey: input.conceptKey,
    displayName: input.displayName,
    canonicalMeanings: uniqueStrings(input.canonicalMeanings ?? []),
    forbiddenInterpretations: uniqueStrings(input.forbiddenInterpretations ?? []),
    preferredTerms: uniqueStrings(input.preferredTerms ?? []),
    replacementRules: input.replacementRules ?? {},
    priority: input.priority ?? 0,
    active: true,
    sourceKind: "extracted",
  };
}

export function createOverride(input: {
  category: Divin8KnowledgeCategory;
  authorityLevel?: Divin8KnowledgeAuthorityLevel;
  ruleKey: string;
  alwaysUse?: string | null;
  neverUse?: string[];
  replacements?: Record<string, string>;
  priority?: number;
}): KnowledgeOverrideDraft {
  return {
    category: input.category,
    ruleKey: input.ruleKey,
    alwaysUse: input.alwaysUse ?? null,
    neverUse: uniqueStrings(input.neverUse ?? []),
    replacements: input.replacements ?? {},
    authorityLevel: input.authorityLevel ?? "hard_override",
    priority: input.priority ?? 100,
    active: true,
    sourceKind: "extracted",
  };
}
