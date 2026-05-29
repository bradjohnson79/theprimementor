import type { Database } from "@wisdom/db";
import type { Divin8KnowledgeRetrievalDebugResponse } from "@wisdom/utils";
import { retrieveCanonicalKnowledge } from "./knowledgeRetrievalService.js";
import type { KnowledgeRetrievalInput } from "../types/knowledgeTypes.js";

export async function testKnowledgeRetrieval(
  db: Database,
  input: KnowledgeRetrievalInput,
): Promise<Divin8KnowledgeRetrievalDebugResponse> {
  const result = await retrieveCanonicalKnowledge(db, input);
  return {
    query: input.query,
    mode: result.mode,
    matchedConcepts: result.concepts,
    appliedOverrides: result.overrides,
    matchedChunks: result.chunks.map((chunk) => ({
      title: chunk.title,
      content: chunk.content,
      concepts: chunk.concepts,
      keywords: chunk.keywords,
      sourceId: chunk.sourceId,
      sourceName: chunk.sourceName,
      chunkId: chunk.id,
      score: chunk.score,
    })),
    finalContext: result.finalContext,
  };
}
