import type { FastifyInstance, FastifyRequest } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase } from "../routeAssertions.js";
import {
  approveSeoRecommendation,
  generateInitialSeo,
  listSeoRecommendations,
  rejectSeoRecommendation,
  runWeeklySeoRecommendationJob,
} from "../services/seoAiService.js";
import { createHttpError } from "../services/booking/errors.js";
import { listSeoSettings, type SeoPayloadInput, updateSeoSetting, upsertSeoSetting } from "../services/seoService.js";

function getRequestIp(request: FastifyRequest) {
  const forwardedFor = request.headers["x-forwarded-for"];
  const forwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  return forwarded?.split(",")[0]?.trim() || request.ip;
}

function assertInternalWeeklySeoAccess(request: FastifyRequest) {
  const configuredSecret = process.env.SEO_WEEKLY_CRON_SECRET?.trim() || process.env.INTERNAL_API_SECRET?.trim();
  if (!configuredSecret) {
    throw createHttpError(503, "SEO weekly route secret is not configured");
  }

  const secretHeader = request.headers["x-cron-secret"];
  const bearerHeader = request.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
  const providedSecret = typeof secretHeader === "string" && secretHeader.trim()
    ? secretHeader.trim()
    : bearerHeader || "";

  if (!providedSecret || providedSecret !== configuredSecret) {
    throw createHttpError(401, "Internal SEO route authentication failed");
  }

  const allowlist = (process.env.SEO_WEEKLY_IP_ALLOWLIST || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (allowlist.length > 0 && !allowlist.includes(getRequestIp(request))) {
    throw createHttpError(403, "Internal SEO route IP is not allowed");
  }
}

export async function seoRoutes(app: FastifyInstance) {
  app.get(
    "/admin/seo",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const actor = requireAdmin(request);

      try {
        return ok({
          data: await listSeoSettings(db, { actorRole: actor.role }),
        });
      } catch (error) {
        return sendApiError(reply, 500, error instanceof Error ? error.message : "Failed to load SEO settings");
      }
    },
  );

  app.post<{ Body: SeoPayloadInput }>(
    "/admin/seo",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const actor = requireAdmin(request);

      try {
        return ok({
          data: await upsertSeoSetting(db, { actorRole: actor.role }, request.body ?? {}),
        });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Failed to save SEO settings");
      }
    },
  );

  app.put<{ Params: { pageKey: string }; Body: Omit<SeoPayloadInput, "pageKey"> }>(
    "/admin/seo/:pageKey",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const actor = requireAdmin(request);

      try {
        return ok({
          data: await updateSeoSetting(db, { actorRole: actor.role }, request.params.pageKey, request.body ?? {}),
        });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Failed to update SEO settings");
      }
    },
  );

  app.post<{ Params: { pageKey: string } }>(
    "/admin/seo/generate/:pageKey",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const actor = requireAdmin(request);

      try {
        return ok({
          data: await generateInitialSeo(
            db,
            { actorRole: actor.role, actorUserId: actor.id },
            request.params.pageKey,
            {
              warn: (payload, message) => app.log.warn(payload, message),
            },
          ),
        });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Failed to generate SEO recommendation");
      }
    },
  );

  app.get<{ Querystring: { pageKey?: string; status?: string } }>(
    "/admin/seo/recommendations",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const actor = requireAdmin(request);

      try {
        return ok({
          data: await listSeoRecommendations(
            db,
            { actorRole: actor.role, actorUserId: actor.id },
            request.query,
          ),
        });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Failed to load SEO recommendations");
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { adminImpactOverride?: string | null } }>(
    "/admin/seo/recommendations/:id/approve",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const actor = requireAdmin(request);

      try {
        return ok({
          data: await approveSeoRecommendation(
            db,
            { actorRole: actor.role, actorUserId: actor.id },
            request.params.id,
            request.body ?? {},
          ),
        });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Failed to approve SEO recommendation");
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/admin/seo/recommendations/:id/reject",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const actor = requireAdmin(request);

      try {
        return ok({
          data: await rejectSeoRecommendation(
            db,
            { actorRole: actor.role, actorUserId: actor.id },
            request.params.id,
          ),
        });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Failed to reject SEO recommendation");
      }
    },
  );

  app.post(
    "/internal/seo/weekly-recommendations",
    {
      config: {
        rateLimit: {
          max: 4,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const requestIp = getRequestIp(request);
      app.log.info(
        {
          requestIp,
          userAgent: request.headers["user-agent"] ?? null,
        },
        "seo_weekly_route_invoked",
      );

      try {
        assertInternalWeeklySeoAccess(request);
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        app.log.warn(
          {
            requestIp,
            statusCode,
            error: error instanceof Error ? error.message : String(error),
          },
          "seo_weekly_route_denied",
        );
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Unauthorized");
      }

      try {
        const db = requireDatabase(app.db);
        const result = await runWeeklySeoRecommendationJob(
          db,
          {
            warn: (payload, message) => app.log.warn(payload, message),
            info: (payload, message) => app.log.info(payload, message),
            error: (payload, message) => app.log.error(payload, message),
          },
        );
        app.log.info(
          {
            requestIp,
            ...result,
          },
          "seo_weekly_route_completed",
        );
        return ok({ data: result });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        app.log.error(
          {
            requestIp,
            statusCode,
            error: error instanceof Error ? error.message : String(error),
          },
          "seo_weekly_route_failed",
        );
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Failed to generate weekly SEO recommendations");
      }
    },
  );
}
