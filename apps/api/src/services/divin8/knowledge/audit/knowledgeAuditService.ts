import type { Database } from "@wisdom/db";
import { KnowledgeRepository } from "../repositories/knowledgeRepository.js";
import type { KnowledgeAuditInput } from "../types/knowledgeTypes.js";

export async function writeKnowledgeAuditLog(db: Database, input: KnowledgeAuditInput) {
  const repository = new KnowledgeRepository(db);
  await repository.writeAuditLog(input);
}
