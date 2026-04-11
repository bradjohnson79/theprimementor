import type { FastifyInstance } from "fastify";
import { logger } from "@wisdom/utils";
import { requireAuth } from "../middleware/auth.js";
import { createHttpError } from "../services/booking/errors.js";
import { runDivin8Reading } from "../services/divin8EngineService.js";
import { resolveMemberAccess } from "../services/divin8/memberAccessService.js";
import { generateBlueprintFromRequest } from "../services/divin8/generateService.js";
import { validateDivin8ChatRequest, validateDivin8MemberMessageRequest } from "../services/divin8/chatService.js";
import {
  clearDivin8PromptOverride,
  getActiveDivin8Prompt,
  saveDivin8PromptOverride,
} from "../services/divin8/promptStore.js";
import {
  addMessageToConversation,
  archiveConversationThread,
  createConversationThread,
  exportConversation,
  getConversationDetail,
  getConversationTimeline,
  listConversationThreads,
  searchConversationThreads,
} from "../services/divin8/conversationService.js";

function ensureAdmin(app: FastifyInstance, role: string | undefined) {
  if (role !== "admin") {
    const error = new Error("Admin access required");
    (error as Error & { statusCode?: number }).statusCode = 403;
    throw error;
  }
  return app;
}

async function ensureMemberDivin8Access(app: FastifyInstance, userId: string) {
  const memberAccess = await resolveMemberAccess(app.db, userId);
  if (!memberAccess) {
    throw createHttpError(403, "An active subscription is required to access Divin8 chat");
  }
}

export async function divin8Routes(app: FastifyInstance) {
  app.post("/divin8/run", { preHandler: requireAuth }, async (request, reply) => {
    if (request.dbUser?.role !== "admin") {
      await ensureMemberDivin8Access(app, request.dbUser!.id);
    }

    try {
      const body = request.body && typeof request.body === "object"
        ? request.body as Partial<Parameters<typeof runDivin8Reading>[0]>
        : {};
      return runDivin8Reading({
        mode: "client",
        user_id: request.dbUser?.id ?? null,
        order_id: null,
        birth_date: body.birth_date ?? "",
        birth_time: body.birth_time ?? null,
        birth_location: body.birth_location ?? "",
        reading_type: body.reading_type ?? null,
        systems: body.systems ?? null,
        questions: body.questions ?? null,
        notes: body.notes ?? null,
        metadata: body.metadata ?? null,
      });
    } catch (error) {
      const statusCode = error instanceof Error && "statusCode" in error
        ? (error as { statusCode?: number }).statusCode
        : undefined;
      if (statusCode === 400) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : "Invalid Divin8 input.",
          code: "DIVIN8_VALIDATION_ERROR",
          details: error instanceof Error && "details" in error ? (error as { details?: unknown }).details : undefined,
        });
      }
      throw error;
    }
  });

  app.get("/divin8/prompt", { preHandler: requireAuth }, async (request) => {
    ensureAdmin(app, request.dbUser?.role);
    return getActiveDivin8Prompt();
  });

  app.post("/divin8/prompt", { preHandler: requireAuth }, async (request) => {
    ensureAdmin(app, request.dbUser?.role);

    if (!request.body || typeof request.body !== "object") {
      return getActiveDivin8Prompt();
    }

    const body = request.body as Record<string, unknown>;
    if (body.reset === true) {
      return clearDivin8PromptOverride();
    }

    if (typeof body.prompt !== "string") {
      const error = new Error("prompt must be a string.");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    return saveDivin8PromptOverride(body.prompt);
  });

  app.post("/divin8/generate", { preHandler: requireAuth }, async (request) => {
    ensureAdmin(app, request.dbUser?.role);
    logger.info("divin8_generate_requested", {
      route: "/api/divin8/generate",
      userId: request.dbUser?.id ?? null,
    });
    return generateBlueprintFromRequest(app, request.body);
  });

  app.post("/divin8/conversations", { preHandler: requireAuth }, async (request) => {
    ensureAdmin(app, request.dbUser?.role);
    return createConversationThread(app.db);
  });

  app.get("/divin8/conversations", { preHandler: requireAuth }, async (request) => {
    ensureAdmin(app, request.dbUser?.role);
    return listConversationThreads(app.db, undefined, "admin");
  });

  app.get<{ Querystring: { q?: string } }>("/divin8/conversations/search", { preHandler: requireAuth }, async (request) => {
    ensureAdmin(app, request.dbUser?.role);
    return searchConversationThreads(app.db, request.query.q ?? "");
  });

  app.get<{ Params: { id: string } }>("/divin8/conversations/:id", { preHandler: requireAuth }, async (request) => {
    ensureAdmin(app, request.dbUser?.role);
    return getConversationDetail(app.db, request.params.id);
  });

  app.get<{ Params: { id: string } }>("/divin8/conversations/:id/timeline", { preHandler: requireAuth }, async (request) => {
    ensureAdmin(app, request.dbUser?.role);
    return getConversationTimeline(app.db, request.params.id);
  });

  app.post<{ Params: { id: string } }>(
    "/divin8/conversations/:id/message",
    { preHandler: requireAuth },
    async (request) => {
      ensureAdmin(app, request.dbUser?.role);
      const payload = validateDivin8ChatRequest(request.body);
      return addMessageToConversation(app, request.params.id, payload, undefined, {
        actorRole: "admin",
      });
    },
  );

  app.delete<{ Params: { id: string } }>("/divin8/conversations/:id", { preHandler: requireAuth }, async (request) => {
    ensureAdmin(app, request.dbUser?.role);
    return archiveConversationThread(app.db, request.params.id);
  });

  app.post("/divin8/export", { preHandler: requireAuth }, async (request, reply) => {
    ensureAdmin(app, request.dbUser?.role);
    if (!request.body || typeof request.body !== "object") {
      const error = new Error("threadId and format are required.");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    const body = request.body as Record<string, unknown>;
    const threadId = typeof body.threadId === "string" ? body.threadId.trim() : "";
    const format = body.format;

    if (!threadId || (format !== "pdf" && format !== "docx")) {
      const error = new Error("threadId and format are required.");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    try {
      const exported = await exportConversation(app.db, { threadId, format });
      reply.header("Content-Type", exported.contentType);
      reply.header("Content-Disposition", `attachment; filename="${exported.filename}"`);
      return reply.send(exported.buffer);
    } catch (error) {
      if (error instanceof Error && error.message === "PDF_EXPORT_FAILED") {
        const wrapped = new Error("PDF export temporarily unavailable.");
        (wrapped as Error & { statusCode?: number }).statusCode = 503;
        throw wrapped;
      }
      throw error;
    }
  });

  // Member-facing Divin8 route surface (same shared pipeline).
  app.post("/member/divin8/conversations", { preHandler: requireAuth }, async (request) => {
    await ensureMemberDivin8Access(app, request.dbUser!.id);
    return createConversationThread(app.db, request.dbUser!.id);
  });

  app.get("/member/divin8/conversations", { preHandler: requireAuth }, async (request) => {
    await ensureMemberDivin8Access(app, request.dbUser!.id);
    return listConversationThreads(app.db, request.dbUser!.id, request.dbUser!.role);
  });

  app.get<{ Querystring: { q?: string } }>("/member/divin8/conversations/search", { preHandler: requireAuth }, async (request) => {
    await ensureMemberDivin8Access(app, request.dbUser!.id);
    return searchConversationThreads(app.db, request.query.q ?? "", request.dbUser!.id);
  });

  app.get<{ Params: { id: string } }>("/member/divin8/conversations/:id", { preHandler: requireAuth }, async (request) => {
    await ensureMemberDivin8Access(app, request.dbUser!.id);
    return getConversationDetail(app.db, request.params.id, request.dbUser!.id);
  });

  app.get<{ Params: { id: string } }>("/member/divin8/conversations/:id/timeline", { preHandler: requireAuth }, async (request) => {
    await ensureMemberDivin8Access(app, request.dbUser!.id);
    return getConversationTimeline(app.db, request.params.id, request.dbUser!.id);
  });

  app.post<{ Params: { id: string } }>(
    "/member/divin8/conversations/:id/message",
    { preHandler: requireAuth },
    async (request) => {
      await ensureMemberDivin8Access(app, request.dbUser!.id);
      const payload = validateDivin8MemberMessageRequest(request.body);
      return addMessageToConversation(
        app,
        request.params.id,
        {
          message: payload.message,
          image_ref: payload.image_ref,
          language: payload.language,
          debugAudit: payload.debugAudit,
          // Server resolves final tier from entitlement snapshot.
          tier: "seeker",
        },
        request.dbUser!.id,
        {
          actorRole: request.dbUser!.role,
          requestId: payload.request_id,
        },
      );
    },
  );

  app.delete<{ Params: { id: string } }>("/member/divin8/conversations/:id", { preHandler: requireAuth }, async (request) => {
    await ensureMemberDivin8Access(app, request.dbUser!.id);
    return archiveConversationThread(app.db, request.params.id, request.dbUser!.id);
  });

  app.post("/member/divin8/export", { preHandler: requireAuth }, async (request, reply) => {
    await ensureMemberDivin8Access(app, request.dbUser!.id);
    if (!request.body || typeof request.body !== "object") {
      const error = new Error("threadId and format are required.");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    const body = request.body as Record<string, unknown>;
    const threadId = typeof body.threadId === "string" ? body.threadId.trim() : "";
    const format = body.format;

    if (!threadId || (format !== "pdf" && format !== "docx")) {
      const error = new Error("threadId and format are required.");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    const exported = await exportConversation(app.db, { threadId, format }, request.dbUser!.id);
    reply.header("Content-Type", exported.contentType);
    reply.header("Content-Disposition", `attachment; filename="${exported.filename}"`);
    return reply.send(exported.buffer);
  });
}
