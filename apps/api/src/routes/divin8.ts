import type { FastifyInstance } from "fastify";
import { logger } from "@wisdom/utils";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase, requireDbUser } from "../routeAssertions.js";
import { createHttpError } from "../services/booking/errors.js";
import { runDivin8Reading } from "../services/divin8EngineService.js";
import { resolveMemberAccess } from "../services/divin8/memberAccessService.js";
import { generateBlueprintFromRequest } from "../services/divin8/generateService.js";
import { validateDivin8ChatRequest, validateDivin8MemberMessageRequest } from "../services/divin8/chatService.js";
import {
  createDivin8Profile,
  deleteDivin8Profile,
  listDivin8Profiles,
} from "../services/divin8/profilesService.js";
import {
  clearDivin8PromptOverride,
  getActiveDivin8Prompt,
  saveDivin8PromptOverride,
} from "../services/divin8/promptStore.js";
import {
  addMessageToConversation,
  createConversationThread,
  deleteConversationThread,
  exportConversation,
  getConversationDetail,
  getConversationTimeline,
  listConversationThreads,
  searchConversationThreads,
} from "../services/divin8/conversationService.js";

async function ensureMemberDivin8Access(app: FastifyInstance, userId: string) {
  const memberAccess = await resolveMemberAccess(app.db, userId);
  if (!memberAccess) {
    throw createHttpError(403, "An active subscription is required to access Divin8 chat");
  }
  return memberAccess;
}

export async function divin8Routes(app: FastifyInstance) {
  app.post("/divin8/run", { preHandler: requireAuth }, async (request, reply) => {
    requireDatabase(app.db);
    const user = requireDbUser(request);
    if (user.role !== "admin") {
      await ensureMemberDivin8Access(app, user.id);
    }

    try {
      const body = request.body && typeof request.body === "object"
        ? request.body as Partial<Parameters<typeof runDivin8Reading>[0]>
        : {};
      return ok(await runDivin8Reading({
        mode: "client",
        user_id: user.id,
        order_id: null,
        birth_date: body.birth_date ?? "",
        birth_time: body.birth_time ?? null,
        birth_location: body.birth_location ?? "",
        reading_type: body.reading_type ?? null,
        systems: body.systems ?? null,
        questions: body.questions ?? null,
        notes: body.notes ?? null,
        metadata: body.metadata ?? null,
      }));
    } catch (error) {
      const statusCode = error instanceof Error && "statusCode" in error
        ? (error as { statusCode?: number }).statusCode
        : undefined;
      if (statusCode === 400) {
        const details = error instanceof Error && "details" in error
          ? (error as { details?: unknown }).details
          : undefined;
        return sendApiError(reply, 400, error instanceof Error ? error.message : "Invalid Divin8 input.", {
          code: "DIVIN8_VALIDATION_ERROR",
          ...(details !== undefined ? { details } : {}),
        });
      }
      throw error;
    }
  });

  app.get("/divin8/prompt", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    return ok(await getActiveDivin8Prompt());
  });

  app.post("/divin8/prompt", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);

    if (!request.body || typeof request.body !== "object") {
      return ok(await getActiveDivin8Prompt());
    }

    const body = request.body as Record<string, unknown>;
    if (body.reset === true) {
      return ok(await clearDivin8PromptOverride());
    }

    if (typeof body.prompt !== "string") {
      const error = new Error("prompt must be a string.");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    return ok(await saveDivin8PromptOverride(body.prompt));
  });

  app.post("/divin8/generate", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    logger.info("divin8_generate_requested", {
      route: "/api/divin8/generate",
      userId: request.dbUser?.id ?? null,
    });
    return ok(await generateBlueprintFromRequest(app, request.body));
  });

  app.get("/divin8/profiles", { preHandler: requireAuth }, async (request) => {
    const user = requireAdmin(request);
    return ok(await listDivin8Profiles(app.db, user.id));
  });

  app.post("/divin8/profiles", { preHandler: requireAuth }, async (request) => {
    const user = requireAdmin(request);
    if (!request.body || typeof request.body !== "object") {
      const error = new Error("Profile body is required.");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    return ok(await createDivin8Profile(app.db, user.id, request.body as never));
  });

  app.delete<{ Params: { id: string } }>("/divin8/profiles/:id", { preHandler: requireAuth }, async (request) => {
    const user = requireAdmin(request);
    return ok(await deleteDivin8Profile(app.db, user.id, request.params.id));
  });

  app.post("/divin8/conversations", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    return ok(await createConversationThread(app.db));
  });

  app.get("/divin8/conversations", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    return ok(await listConversationThreads(app.db, undefined, "admin"));
  });

  app.get<{ Querystring: { q?: string } }>("/divin8/conversations/search", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    return ok(await searchConversationThreads(app.db, request.query.q ?? ""));
  });

  app.get<{ Params: { id: string } }>("/divin8/conversations/:id", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    return ok(await getConversationDetail(app.db, request.params.id));
  });

  app.get<{ Params: { id: string } }>("/divin8/conversations/:id/timeline", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    return ok(await getConversationTimeline(app.db, request.params.id));
  });

  app.post<{ Params: { id: string } }>(
    "/divin8/conversations/:id/message",
    { preHandler: requireAuth },
    async (request) => {
      requireAdmin(request);
      const payload = validateDivin8ChatRequest(request.body);
      return ok(await addMessageToConversation(app, request.params.id, payload, undefined, {
        actorRole: "admin",
      }));
    },
  );

  app.delete<{ Params: { id: string } }>("/divin8/conversations/:id", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    return ok(await deleteConversationThread(app.db, request.params.id));
  });

  app.post("/divin8/export", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
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
    return ok(await createConversationThread(app.db, request.dbUser!.id));
  });

  app.get("/member/divin8/profiles", { preHandler: requireAuth }, async (request) => {
    await ensureMemberDivin8Access(app, request.dbUser!.id);
    return ok(await listDivin8Profiles(app.db, request.dbUser!.id));
  });

  app.post("/member/divin8/profiles", { preHandler: requireAuth }, async (request) => {
    await ensureMemberDivin8Access(app, request.dbUser!.id);
    if (!request.body || typeof request.body !== "object") {
      const error = new Error("Profile body is required.");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    return ok(await createDivin8Profile(app.db, request.dbUser!.id, request.body as never));
  });

  app.delete<{ Params: { id: string } }>("/member/divin8/profiles/:id", { preHandler: requireAuth }, async (request) => {
    await ensureMemberDivin8Access(app, request.dbUser!.id);
    return ok(await deleteDivin8Profile(app.db, request.dbUser!.id, request.params.id));
  });

  app.get("/member/divin8/conversations", { preHandler: requireAuth }, async (request) => {
    await ensureMemberDivin8Access(app, request.dbUser!.id);
    return ok(await listConversationThreads(app.db, request.dbUser!.id, request.dbUser!.role));
  });

  app.get<{ Querystring: { q?: string } }>("/member/divin8/conversations/search", { preHandler: requireAuth }, async (request) => {
    await ensureMemberDivin8Access(app, request.dbUser!.id);
    return ok(await searchConversationThreads(app.db, request.query.q ?? "", request.dbUser!.id));
  });

  app.get<{ Params: { id: string } }>("/member/divin8/conversations/:id", { preHandler: requireAuth }, async (request) => {
    await ensureMemberDivin8Access(app, request.dbUser!.id);
    return ok(await getConversationDetail(app.db, request.params.id, request.dbUser!.id));
  });

  app.get<{ Params: { id: string } }>("/member/divin8/conversations/:id/timeline", { preHandler: requireAuth }, async (request) => {
    await ensureMemberDivin8Access(app, request.dbUser!.id);
    return ok(await getConversationTimeline(app.db, request.params.id, request.dbUser!.id));
  });

  app.post<{ Params: { id: string } }>(
    "/member/divin8/conversations/:id/message",
    { preHandler: requireAuth },
    async (request) => {
      const memberAccess = await ensureMemberDivin8Access(app, request.dbUser!.id);
      const payload = validateDivin8MemberMessageRequest(request.body);
      if (memberAccess.tier !== "initiate" && payload.timeline) {
        throw createHttpError(403, "Timeline readings are available for Initiate members only.");
      }
      return ok(await addMessageToConversation(
        app,
        request.params.id,
        {
          message: payload.message,
          image_ref: payload.image_ref,
          profile_tags: payload.profile_tags,
          timeline: payload.timeline,
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
      ));
    },
  );

  app.delete<{ Params: { id: string } }>("/member/divin8/conversations/:id", { preHandler: requireAuth }, async (request) => {
    await ensureMemberDivin8Access(app, request.dbUser!.id);
    return ok(await deleteConversationThread(app.db, request.params.id, request.dbUser!.id));
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
