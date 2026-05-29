import type { Database } from "@wisdom/db";
import { invalidateKnowledgeCache } from "../cache/knowledgeCache.js";
import { KnowledgeRepository } from "../repositories/knowledgeRepository.js";
import type { CanonicalConceptDraft } from "../types/knowledgeTypes.js";

export async function createKnowledgeConcept(
  db: Database,
  input: CanonicalConceptDraft & { adminUserId: string },
) {
  const repository = new KnowledgeRepository(db);
  const concept = await repository.createManualConcept(input);
  await repository.writeAuditLog({
    adminUserId: input.adminUserId,
    actionType: "edit_concept",
    conceptId: concept.id,
    after: concept,
  });
  invalidateKnowledgeCache();
  return concept;
}

export async function updateKnowledgeConcept(
  db: Database,
  conceptId: string,
  input: Partial<CanonicalConceptDraft> & { adminUserId: string },
) {
  const repository = new KnowledgeRepository(db);
  const concept = await repository.updateManualConcept(conceptId, input);
  await repository.writeAuditLog({
    adminUserId: input.adminUserId,
    actionType: "edit_concept",
    conceptId: concept.id,
    after: concept,
  });
  invalidateKnowledgeCache();
  return concept;
}
