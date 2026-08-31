import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase } from "../routeAssertions.js";
import { chatWithAdsAgent, getAdsAgentHealth } from "../services/ads/adsAgentService.js";
import {
  clearAdsConversation,
  createAdsConversation,
  getAdsConversation,
  listAdsConversations,
} from "../services/ads/adsConversationService.js";
import { getDivin8AdvertisingKnowledge } from "../services/ads/adsKnowledgeService.js";
import { updateAdsAgentSettings } from "../services/ads/adsSettingsService.js";
import { assertNoGoogleAdsSecrets, serializeGoogleAdsStatus } from "../services/ads/googleAdsConnectionService.js";
import {
  adminAdsSettingsRedirectUrl,
  resolveAdsGoogleOAuthClient,
} from "../services/ads/googleAdsOAuthClient.js";
import {
  completeGoogleAdsOAuth,
  disconnectGoogleAds,
  startGoogleAdsOAuth,
} from "../services/ads/googleAdsOAuthService.js";
import { providerForDatabase } from "../services/ads/googleAdsProvider.js";
import { validateStoredGoogleAdsConnection } from "../services/ads/googleAdsReportingService.js";
import { createDbAdsGoogleStore } from "../services/ads/googleAdsStore.js";
import { clearOpenRouterHealthCache } from "../services/ads/openRouterAdapter.js";
import { sanitizeAdsAgentContext } from "../services/ads/types.js";
import {
  buildPmaCampaignProposal,
  getPmaWorkspace,
  listPmaCampaignProposals,
  listPmaWorkspaceProjects,
  runPmaAnalysis,
} from "../services/ads/pma/pmaService.js";

export async function adminAdsRoutes(app: FastifyInstance) {
  app.get("/admin/ads/status", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    const store = request.server.db ? createDbAdsGoogleStore(request.server.db) : null;
    const status = await serializeGoogleAdsStatus(store);
    assertNoGoogleAdsSecrets(status);
    return ok(status);
  });

  app.get("/admin/ads/google/oauth/start", { preHandler: requireAuth }, async (request, reply) => {
    const user = requireAdmin(request);
    const db = requireDatabase(request.server.db);
    try {
      return ok(await startGoogleAdsOAuth(createDbAdsGoogleStore(db), user.id));
    } catch (error) {
      return sendApiError(reply, 503, error instanceof Error ? error.message : "Google Ads OAuth is not configured");
    }
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/admin/ads/google/oauth/callback",
    async (request, reply) => {
      try {
        const db = request.server.db;
        if (!db) return reply.redirect(adminAdsSettingsRedirectUrl("?ads=error"));
        const store = createDbAdsGoogleStore(db);
        const url = await completeGoogleAdsOAuth(store, request.query ?? {});
        if (url.includes("ads=connected")) {
          try {
            await validateStoredGoogleAdsConnection(store);
          } catch (error) {
            const code = error instanceof Error && "code" in error ? String((error as { code?: string }).code) : "";
            const status = code === "GOOGLE_ADS_OAUTH_INVALID"
              ? "auth_error"
              : code === "GOOGLE_ADS_DEVELOPER_TOKEN_ERROR"
                ? "developer_token_error"
                : code === "GOOGLE_ADS_CUSTOMER_ACCESS_ERROR"
                  ? "access_error"
                  : "api_error";
            request.log.warn({
              adsCode: code || "GOOGLE_ADS_API_ERROR",
              adsMessage: error instanceof Error ? error.message : "Google Ads validation failed",
            }, "ads_google_validate_failed");
            const connection = await store.getConnection();
            if (connection) {
              await store.upsertConnection({ ...connection, status });
            }
            return reply.redirect(adminAdsSettingsRedirectUrl("?ads=error"));
          }
        }
        return reply.redirect(url);
      } catch {
        return reply.redirect(adminAdsSettingsRedirectUrl("?ads=error"));
      }
    },
  );

  app.post("/admin/ads/google/disconnect", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
    const db = requireDatabase(request.server.db);
    try {
      return ok(await disconnectGoogleAds(createDbAdsGoogleStore(db), resolveAdsGoogleOAuthClient()));
    } catch (error) {
      const status = typeof (error as { statusCode?: number }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;
      return sendApiError(reply, status, error instanceof Error ? error.message : "Unable to disconnect Google Ads");
    }
  });

  app.get("/admin/ads/reporting/summary", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
    const db = requireDatabase(request.server.db);
    try {
      const result = await providerForDatabase(db).reporting.getAccountSummary();
      assertNoGoogleAdsSecrets(result);
      return ok(result);
    } catch (error) {
      const status = typeof (error as { statusCode?: number }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 502;
      const code = typeof (error as { code?: string }).code === "string" ? (error as { code: string }).code : undefined;
      return sendApiError(reply, status, error instanceof Error ? error.message : "Unable to load Ads summary", code ? { code } : undefined);
    }
  });

  app.get("/admin/ads/reporting/campaigns", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
    const db = requireDatabase(request.server.db);
    try {
      const result = await providerForDatabase(db).reporting.getCampaignPerformance();
      assertNoGoogleAdsSecrets(result);
      return ok(result);
    } catch (error) {
      const status = typeof (error as { statusCode?: number }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 502;
      const code = typeof (error as { code?: string }).code === "string" ? (error as { code: string }).code : undefined;
      return sendApiError(reply, status, error instanceof Error ? error.message : "Unable to load campaigns", code ? { code } : undefined);
    }
  });

  app.get("/admin/ads/agent/health", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
    try {
      return ok(await getAdsAgentHealth(request.server.db ?? null));
    } catch (error) {
      return sendApiError(reply, 500, error instanceof Error ? error.message : "Ads Agent health failed");
    }
  });

  app.post("/admin/ads/agent/health/test", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
    try {
      clearOpenRouterHealthCache();
      return ok(await getAdsAgentHealth(request.server.db ?? null, { bypassCache: true }));
    } catch (error) {
      return sendApiError(reply, 500, error instanceof Error ? error.message : "Ads Agent connection test failed");
    }
  });

  app.patch("/admin/ads/agent/settings", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
    const db = requireDatabase(request.server.db);
    try {
      clearOpenRouterHealthCache();
      return ok(await updateAdsAgentSettings(db));
    } catch (error) {
      return sendApiError(reply, 400, error instanceof Error ? error.message : "Unable to update Ads Agent settings");
    }
  });

  app.post("/admin/ads/agent/chat", { preHandler: requireAuth }, async (request, reply) => {
    const user = requireAdmin(request);
    const db = requireDatabase(request.server.db);
    const body = (request.body ?? {}) as {
      message?: unknown;
      conversationId?: unknown;
      context?: unknown;
      images?: unknown;
    };
    try {
      return ok(await chatWithAdsAgent({
        db,
        userId: user.id,
        message: typeof body.message === "string" ? body.message : "",
        conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
        context: sanitizeAdsAgentContext(body.context),
        images: Array.isArray(body.images) ? body.images as Array<{ mimeType?: string; data?: string }> : undefined,
      }));
    } catch (error) {
      const status = typeof (error as { statusCode?: number }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;
      const code = typeof (error as { code?: string }).code === "string"
        ? (error as { code: string }).code
        : undefined;
      return sendApiError(
        reply,
        status,
        error instanceof Error ? error.message : "Ads Agent chat failed",
        code ? { code } : undefined,
      );
    }
  });

  app.get("/admin/ads/agent/conversations", { preHandler: requireAuth }, async (request, reply) => {
    const user = requireAdmin(request);
    const db = requireDatabase(request.server.db);
    try {
      return ok({ conversations: await listAdsConversations(db, user.id) });
    } catch (error) {
      return sendApiError(reply, 500, error instanceof Error ? error.message : "Unable to list Ads conversations");
    }
  });

  app.post("/admin/ads/agent/conversations", { preHandler: requireAuth }, async (request, reply) => {
    const user = requireAdmin(request);
    const db = requireDatabase(request.server.db);
    const body = (request.body ?? {}) as { context?: unknown };
    try {
      const conversation = await createAdsConversation(db, user.id, sanitizeAdsAgentContext(body.context));
      return ok({ id: conversation.id, messages: [] });
    } catch (error) {
      return sendApiError(reply, 500, error instanceof Error ? error.message : "Unable to create Ads conversation");
    }
  });

  app.get<{ Params: { id: string } }>("/admin/ads/agent/conversations/:id", { preHandler: requireAuth }, async (request, reply) => {
    const user = requireAdmin(request);
    const db = requireDatabase(request.server.db);
    try {
      return ok(await getAdsConversation(db, user.id, request.params.id));
    } catch (error) {
      const status = typeof (error as { statusCode?: number }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;
      return sendApiError(reply, status, error instanceof Error ? error.message : "Unable to load Ads conversation");
    }
  });

  app.post<{ Params: { id: string } }>("/admin/ads/agent/conversations/:id/clear", { preHandler: requireAuth }, async (request, reply) => {
    const user = requireAdmin(request);
    const db = requireDatabase(request.server.db);
    try {
      await clearAdsConversation(db, user.id, request.params.id);
      return ok({ cleared: true });
    } catch (error) {
      const status = typeof (error as { statusCode?: number }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;
      return sendApiError(reply, status, error instanceof Error ? error.message : "Unable to clear Ads conversation");
    }
  });

  app.get("/admin/ads/pma/projects", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
    const db = requireDatabase(request.server.db);
    try {
      return ok({ projects: await listPmaWorkspaceProjects(db) });
    } catch (error) {
      return sendApiError(reply, 500, error instanceof Error ? error.message : "Unable to load PMA projects");
    }
  });

  app.get<{ Querystring: { project?: string } }>("/admin/ads/pma/workspace", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
    const db = requireDatabase(request.server.db);
    try {
      return ok(await getPmaWorkspace(db, request.query.project || "divin8-reports"));
    } catch (error) {
      return sendApiError(reply, 500, error instanceof Error ? error.message : "Unable to load PMA workspace");
    }
  });

  app.post("/admin/ads/pma/analyze", { preHandler: requireAuth }, async (request, reply) => {
    const user = requireAdmin(request);
    const db = requireDatabase(request.server.db);
    const body = (request.body ?? {}) as { project?: unknown; seedsText?: unknown; csvText?: unknown; includeCatalog?: unknown };
    try {
      return ok(await runPmaAnalysis({
        db,
        userId: user.id,
        projectKey: typeof body.project === "string" ? body.project : "divin8-reports",
        seedsText: typeof body.seedsText === "string" ? body.seedsText : "",
        csvText: typeof body.csvText === "string" ? body.csvText : undefined,
        includeCatalog: body.includeCatalog !== false,
        logger: { warn: (payload, message) => request.log.warn(payload, message) },
      }));
    } catch (error) {
      const status = typeof (error as { statusCode?: number }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;
      return sendApiError(reply, status, error instanceof Error ? error.message : "PMA analysis failed");
    }
  });

  app.post("/admin/ads/pma/campaigns", { preHandler: requireAuth }, async (request, reply) => {
    const user = requireAdmin(request);
    const db = requireDatabase(request.server.db);
    const body = (request.body ?? {}) as { project?: unknown; clusterId?: unknown };
    try {
      return ok(await buildPmaCampaignProposal({
        db,
        userId: user.id,
        projectKey: typeof body.project === "string" ? body.project : undefined,
        clusterId: typeof body.clusterId === "string" ? body.clusterId : "",
      }));
    } catch (error) {
      const status = typeof (error as { statusCode?: number }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;
      return sendApiError(reply, status, error instanceof Error ? error.message : "Unable to create campaign proposal");
    }
  });

  app.get("/admin/ads/pma/campaigns", { preHandler: requireAuth }, async (request, reply) => {
    const user = requireAdmin(request);
    const db = requireDatabase(request.server.db);
    try {
      return ok({ proposals: await listPmaCampaignProposals(db, user.id) });
    } catch (error) {
      return sendApiError(reply, 500, error instanceof Error ? error.message : "Unable to load campaign proposals");
    }
  });

  app.get("/admin/ads/divin8-knowledge", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
    try {
      return ok(await getDivin8AdvertisingKnowledge(request.server.db ?? null));
    } catch (error) {
      return sendApiError(reply, 500, error instanceof Error ? error.message : "Unable to load Divin8 advertising knowledge");
    }
  });
}
