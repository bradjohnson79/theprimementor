import type { Database } from "@wisdom/db";
import { invalidateKnowledgeCache } from "../cache/knowledgeCache.js";
import { KnowledgeRepository } from "../repositories/knowledgeRepository.js";
import type { KnowledgeOverrideDraft } from "../types/knowledgeTypes.js";

export async function createKnowledgeOverride(
  db: Database,
  input: KnowledgeOverrideDraft & { adminUserId: string },
) {
  const repository = new KnowledgeRepository(db);
  const override = await repository.createManualOverride(input);
  await repository.writeAuditLog({
    adminUserId: input.adminUserId,
    actionType: "edit_override",
    overrideId: override.id,
    after: override,
  });
  invalidateKnowledgeCache();
  return override;
}

export async function updateKnowledgeOverride(
  db: Database,
  overrideId: string,
  input: Partial<KnowledgeOverrideDraft> & { adminUserId: string },
) {
  const repository = new KnowledgeRepository(db);
  const override = await repository.updateManualOverride(overrideId, input);
  await repository.writeAuditLog({
    adminUserId: input.adminUserId,
    actionType: "edit_override",
    overrideId: override.id,
    after: override,
  });
  invalidateKnowledgeCache();
  return override;
}
