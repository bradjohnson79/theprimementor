import type { Database } from "@wisdom/db";
import type { Divin8KnowledgeCategory } from "@wisdom/utils";
import {
  buildKnowledgeCacheKey,
  getKnowledgeCache,
  setKnowledgeCache,
} from "../cache/knowledgeCache.js";
import { KnowledgeRepository } from "../repositories/knowledgeRepository.js";
import {
  DEFAULT_KNOWLEDGE_RETRIEVAL_LIMITS,
  type KnowledgeRetrievalInput,
  type RetrievedKnowledgeChunk,
  type RetrievedKnowledgeContext,
} from "../types/knowledgeTypes.js";
import { buildCanonicalKnowledgeContext } from "./knowledgeContextBuilder.js";

const AUTHORITY_SCORE = {
  hard_override: 100,
  canonical_interpretation: 60,
  supplemental_reference: 25,
} as const;

const STOPWORDS = new Set(["the", "and", "for", "with", "this", "that", "into", "from", "what", "how", "does"]);

function tokenize(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_\s-]/gu, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !STOPWORDS.has(token)),
  );
}

function inferConceptKeys(query: string) {
  const keys = new Set<string>();
  for (const match of query.toLowerCase().matchAll(/\blife\s+path\s+(\d{1,2})\b/g)) {
    keys.add(`life_path_${match[1]}`);
  }
  for (const match of query.toLowerCase().matchAll(/\b(?:animal\s+)?branch\s+(\d{1,2})\b/g)) {
    keys.add(`animal_branch_${match[1]}`);
  }
  if (/\bcat\b/i.test(query)) {
    keys.add("cat_branch");
    keys.add("animal_branch_4");
  }
  if (/\brabbit\b/i.test(query)) {
    keys.add("animal_branch_4");
  }
  return [...keys];
}

function inferCategories(query: string, explicit?: Divin8KnowledgeCategory[]) {
  if (explicit?.length) {
    return explicit;
  }
  const lower = query.toLowerCase();
  const categories: Divin8KnowledgeCategory[] = [];
  if (/life path|destiny|soul urge|numerology|\b\d+\b/.test(lower)) {
    categories.push("numerology", "numerology_prime_canon", "numerology_chaldean", "numerology_pythagorean");
  }
  if (/bazi|branch|cat|rabbit|chinese/.test(lower)) {
    categories.push("chinese_bazi", "chinese_bazi_vietnamese_branch");
  }
  if (/vedic/.test(lower)) categories.push("vedic_astrology");
  if (/western|moon|sun|house|ascendant/.test(lower)) categories.push("western_astrology");
  if (/tarot/.test(lower)) categories.push("tarot");
  if (/i ching|iching/.test(lower)) categories.push("iching");
  return categories.length > 0 ? [...new Set(categories)] : undefined;
}

function rankChunk(chunk: Omit<RetrievedKnowledgeChunk, "score">, queryTokens: Set<string>, conceptKeys: string[]) {
  const haystack = tokenize(`${chunk.title ?? ""} ${chunk.content} ${chunk.keywords.join(" ")} ${chunk.concepts.join(" ")}`);
  const overlap = [...queryTokens].filter((token) => haystack.has(token)).length;
  const conceptBoost = conceptKeys.some((concept) => chunk.concepts.includes(concept)) ? 40 : 0;
  return (AUTHORITY_SCORE[chunk.authorityLevel] ?? 0) + (overlap * 8) + conceptBoost;
}

export async function retrieveCanonicalKnowledge(
  db: Database,
  input: KnowledgeRetrievalInput,
): Promise<RetrievedKnowledgeContext> {
  const mode = input.mode ?? "chat";
  const conceptKeys = [...new Set([...(input.concepts ?? []), ...inferConceptKeys(input.query)])];
  const categories = inferCategories(input.query, input.categories);
  const limits = { ...DEFAULT_KNOWLEDGE_RETRIEVAL_LIMITS, ...(input.limits ?? {}) };
  const cacheKey = buildKnowledgeCacheKey(["knowledge-retrieval", input.query, categories, conceptKeys, mode, limits]);
  const cached = getKnowledgeCache<RetrievedKnowledgeContext>(cacheKey);
  if (cached) {
    return cached;
  }

  const repository = new KnowledgeRepository(db);
  const [concepts, overrides, chunks] = await Promise.all([
    repository.listCurrentConcepts({ categories, conceptKeys: conceptKeys.length > 0 ? conceptKeys : undefined }),
    repository.listCurrentOverrides({ categories, ruleKeys: conceptKeys.length > 0 ? conceptKeys : undefined }),
    repository.listCurrentChunks({ categories }),
  ]);

  const queryTokens = tokenize(input.query);
  const rankedChunks = chunks
    .map((chunk) => ({
      ...chunk,
      score: rankChunk(chunk, queryTokens, conceptKeys),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limits.maxSupplementalChunks);

  const selectedOverrides = overrides.slice(0, limits.maxHardOverrides);
  const selectedConcepts = concepts.slice(0, limits.maxCanonicalConcepts);
  const finalContext = buildCanonicalKnowledgeContext({
    concepts: selectedConcepts,
    overrides: selectedOverrides,
    chunks: rankedChunks,
    limits,
  });

  const result = {
    mode,
    concepts: selectedConcepts,
    overrides: selectedOverrides,
    chunks: rankedChunks,
    finalContext,
  };
  setKnowledgeCache(cacheKey, result);
  return result;
}
