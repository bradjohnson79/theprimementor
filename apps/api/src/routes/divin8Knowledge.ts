import type { FastifyInstance, FastifyRequest } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase } from "../routeAssertions.js";
import {
  createKnowledgeConcept,
  createKnowledgeOverride,
  deleteKnowledgeSource,
  disableKnowledgeSource,
  getKnowledgeSourceDetail,
  listKnowledgeSources,
  previewKnowledgeUpload,
  replaceKnowledgeSourceVersion,
  reprocessKnowledgeSource,
  rollbackKnowledgeSource,
  runKnowledgeRetrievalTest,
  updateKnowledgeConcept,
  updateKnowledgeOverride,
  uploadKnowledgeSource,
  validateConceptInput,
  validateKnowledgeUploadInput,
  validateOverrideInput,
} from "../services/divin8/knowledge/knowledgeAdminService.js";

const MAX_KNOWLEDGE_SOURCE_BYTES = 25 * 1024 * 1024;

function multipartFieldValue(fields: Record<string, unknown> | undefined, key: string) {
  const field = fields?.[key] as { value?: unknown } | undefined;
  return field?.value;
}

async function readKnowledgeMultipart(request: FastifyRequest, adminUserId: string) {
  const data = await request.file({ limits: { fileSize: MAX_KNOWLEDGE_SOURCE_BYTES } });
  if (!data) {
    throw new Error("No knowledge source file uploaded.");
  }
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of data.file) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_KNOWLEDGE_SOURCE_BYTES) {
      throw new Error("Knowledge source must be under 25MB.");
    }
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);
  return validateKnowledgeUploadInput({
    name: multipartFieldValue(data.fields, "name") ?? data.filename,
    category: multipartFieldValue(data.fields, "category"),
    authorityLevel: multipartFieldValue(data.fields, "authorityLevel") ?? multipartFieldValue(data.fields, "authority_level"),
    file: {
      originalFilename: data.filename,
      mimeType: data.mimetype,
      size: buffer.length,
      buffer,
    },
    adminUserId,
  });
}

export async function divin8KnowledgeRoutes(app: FastifyInstance) {
  app.get("/divin8/knowledge/sources", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    requireDatabase(app.db);
    return ok(await listKnowledgeSources(app.db));
  });

  app.post("/divin8/knowledge/sources/preview", { preHandler: requireAuth }, async (request, reply) => {
    const admin = requireAdmin(request);
    requireDatabase(app.db);
    try {
      return ok(await previewKnowledgeUpload(await readKnowledgeMultipart(request, admin.id)));
    } catch (error) {
      return sendApiError(reply, 400, error instanceof Error ? error.message : "Knowledge source preview failed.");
    }
  });

  app.post("/divin8/knowledge/sources", { preHandler: requireAuth }, async (request, reply) => {
    const admin = requireAdmin(request);
    requireDatabase(app.db);
    try {
      return ok(await uploadKnowledgeSource(app.db, await readKnowledgeMultipart(request, admin.id)));
    } catch (error) {
      return sendApiError(reply, 400, error instanceof Error ? error.message : "Knowledge source upload failed.");
    }
  });

  app.get<{ Params: { id: string } }>("/divin8/knowledge/sources/:id", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    requireDatabase(app.db);
    return ok(await getKnowledgeSourceDetail(app.db, request.params.id));
  });

  app.post<{ Params: { id: string } }>("/divin8/knowledge/sources/:id/replace", { preHandler: requireAuth }, async (request, reply) => {
    const admin = requireAdmin(request);
    requireDatabase(app.db);
    try {
      return ok(await replaceKnowledgeSourceVersion(app.db, request.params.id, await readKnowledgeMultipart(request, admin.id)));
    } catch (error) {
      return sendApiError(reply, 400, error instanceof Error ? error.message : "Knowledge source replacement failed.");
    }
  });

  app.post<{ Params: { id: string } }>("/divin8/knowledge/sources/:id/reprocess", { preHandler: requireAuth }, async (request, reply) => {
    const admin = requireAdmin(request);
    requireDatabase(app.db);
    const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
    try {
      const uploadInput = validateKnowledgeUploadInput({
        name: "reprocess",
        category: body.category,
        authorityLevel: body.authorityLevel ?? body.authority_level,
        adminUserId: admin.id,
        file: {
          originalFilename: "stored-extracted-text.txt",
          mimeType: "text/plain",
          size: 0,
          buffer: Buffer.alloc(0),
        },
      });
      const versionId = typeof body.versionId === "string" ? body.versionId : "";
      if (!versionId) {
        throw new Error("versionId is required.");
      }
      return ok(await reprocessKnowledgeSource(app.db, {
        sourceId: request.params.id,
        versionId,
        category: uploadInput.category,
        authorityLevel: uploadInput.authorityLevel,
        adminUserId: admin.id,
      }));
    } catch (error) {
      return sendApiError(reply, 400, error instanceof Error ? error.message : "Knowledge source reprocess failed.");
    }
  });

  app.post<{ Params: { id: string } }>("/divin8/knowledge/sources/:id/rollback", { preHandler: requireAuth }, async (request, reply) => {
    const admin = requireAdmin(request);
    requireDatabase(app.db);
    const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
    const versionId = typeof body.versionId === "string" ? body.versionId : "";
    if (!versionId) {
      return sendApiError(reply, 400, "versionId is required.");
    }
    return ok(await rollbackKnowledgeSource(app.db, request.params.id, versionId, admin.id));
  });

  app.post<{ Params: { id: string } }>("/divin8/knowledge/sources/:id/disable", { preHandler: requireAuth }, async (request) => {
    const admin = requireAdmin(request);
    requireDatabase(app.db);
    return ok(await disableKnowledgeSource(app.db, request.params.id, admin.id));
  });

  app.delete<{ Params: { id: string } }>("/divin8/knowledge/sources/:id", { preHandler: requireAuth }, async (request, reply) => {
    const admin = requireAdmin(request);
    requireDatabase(app.db);
    const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
    if (body.confirm !== true) {
      return sendApiError(reply, 400, "Deletion requires confirm: true.");
    }
    return ok(await deleteKnowledgeSource(app.db, request.params.id, admin.id));
  });

  app.post("/divin8/knowledge/concepts", { preHandler: requireAuth }, async (request, reply) => {
    const admin = requireAdmin(request);
    requireDatabase(app.db);
    try {
      return ok(await createKnowledgeConcept(app.db, validateConceptInput(request.body, admin.id)));
    } catch (error) {
      return sendApiError(reply, 400, error instanceof Error ? error.message : "Knowledge concept save failed.");
    }
  });

  app.patch<{ Params: { id: string } }>("/divin8/knowledge/concepts/:id", { preHandler: requireAuth }, async (request, reply) => {
    const admin = requireAdmin(request);
    requireDatabase(app.db);
    try {
      return ok(await updateKnowledgeConcept(app.db, request.params.id, validateConceptInput(request.body, admin.id)));
    } catch (error) {
      return sendApiError(reply, 400, error instanceof Error ? error.message : "Knowledge concept update failed.");
    }
  });

  app.post("/divin8/knowledge/overrides", { preHandler: requireAuth }, async (request, reply) => {
    const admin = requireAdmin(request);
    requireDatabase(app.db);
    try {
      return ok(await createKnowledgeOverride(app.db, validateOverrideInput(request.body, admin.id)));
    } catch (error) {
      return sendApiError(reply, 400, error instanceof Error ? error.message : "Knowledge override save failed.");
    }
  });

  app.patch<{ Params: { id: string } }>("/divin8/knowledge/overrides/:id", { preHandler: requireAuth }, async (request, reply) => {
    const admin = requireAdmin(request);
    requireDatabase(app.db);
    try {
      return ok(await updateKnowledgeOverride(app.db, request.params.id, validateOverrideInput(request.body, admin.id)));
    } catch (error) {
      return sendApiError(reply, 400, error instanceof Error ? error.message : "Knowledge override update failed.");
    }
  });

  app.post("/divin8/knowledge/test-retrieval", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
    requireDatabase(app.db);
    try {
      return ok(await runKnowledgeRetrievalTest(app.db, request.body));
    } catch (error) {
      return sendApiError(reply, 400, error instanceof Error ? error.message : "Knowledge retrieval test failed.");
    }
  });
}
