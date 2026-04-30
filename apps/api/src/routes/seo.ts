import type { FastifyInstance, FastifyRequest } from "fastify";
import type { SeoRecommendationValue } from "@wisdom/db";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase } from "../routeAssertions.js";
import { listSeoRecommendations } from "../services/seoRecommendationService.js";
import {
  createSeoAudit,
  getSeoAuditById,
  listLatestCompletedAudit,
  listSeoAuditItems,
  listSeoAudits,
  runSeoAuditJob,
} from "../services/seoAuditService.js";
import {
  editSeoRecommendation,
  approveSeoRecommendation,
  rejectSeoRecommendation,
  rollbackSeoChange,
} from "../services/seoReviewService.js";
import {
  exportSeoReportPdf,
  getSeoReportById,
  listSeoReports,
} from "../services/seoReportService.js";
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
          data: {
            ...(await listSeoSettings(db, { actorRole: actor.role, actorUserId: actor.id })),
            ...(await listLatestCompletedAudit(db, { actorRole: actor.role, actorUserId: actor.id })),
          },
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
          data: await upsertSeoSetting(db, { actorRole: actor.role, actorUserId: actor.id }, request.body ?? {}),
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
          data: await updateSeoSetting(db, { actorRole: actor.role, actorUserId: actor.id }, request.params.pageKey, request.body ?? {}),
        });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Failed to update SEO settings");
      }
    },
  );

  app.get(
    "/admin/seo/audits",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const actor = requireAdmin(request);

      try {
        return ok({
          data: await listSeoAudits(db, { actorRole: actor.role, actorUserId: actor.id }),
        });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Failed to load SEO audits");
      }
    },
  );

  app.post<{ Body: { scope?: string; mode?: "quick" | "full" } }>(
    "/admin/seo/audits",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const actor = requireAdmin(request);

      try {
        const audit = await createSeoAudit(
          db,
          { actorRole: actor.role, actorUserId: actor.id },
          request.body ?? {},
        );
        void runSeoAuditJob(
          db,
          audit.id,
          {
            warn: (payload, message) => app.log.warn(payload, message),
            info: (payload, message) => app.log.info(payload, message),
            error: (payload, message) => app.log.error(payload, message),
          },
        ).catch((error) => {
          app.log.error(
            {
              auditId: audit.id,
              error: error instanceof Error ? error.message : String(error),
            },
            "seo_audit_async_failed",
          );
        });
        return ok({
          data: { audit },
        });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Failed to start SEO audit");
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/admin/seo/audits/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const actor = requireAdmin(request);

      try {
        return ok({
          data: await getSeoAuditById(db, { actorRole: actor.role, actorUserId: actor.id }, request.params.id),
        });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Failed to load SEO audit");
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/admin/seo/audits/:id/items",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const actor = requireAdmin(request);

      try {
        return ok({
          data: await listSeoAuditItems(db, { actorRole: actor.role, actorUserId: actor.id }, request.params.id),
        });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Failed to load SEO audit items");
      }
    },
  );

  app.get<{ Querystring: { auditId?: string; pageKey?: string; status?: string } }>(
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

  app.post<{ Params: { id: string }; Body: { expectedVersion: number } }>(
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

  app.post<{ Params: { id: string }; Body: { expectedVersion: number; editedValue: unknown } }>(
    "/admin/seo/recommendations/:id/edit",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const actor = requireAdmin(request);

      try {
        return ok({
          data: await editSeoRecommendation(
            db,
            { actorRole: actor.role, actorUserId: actor.id },
            request.params.id,
            {
              expectedVersion: request.body?.expectedVersion ?? Number.NaN,
              editedValue: (request.body?.editedValue ?? null) as SeoRecommendationValue,
            },
          ),
        });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Failed to edit SEO recommendation");
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { expectedVersion: number } }>(
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
            request.body ?? { expectedVersion: NaN },
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

  app.post<{ Params: { changeId: string } }>(
    "/admin/seo/rollback/:changeId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const actor = requireAdmin(request);

      try {
        return ok({
          data: await rollbackSeoChange(
            db,
            { actorRole: actor.role, actorUserId: actor.id },
            request.params.changeId,
          ),
        });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Failed to roll back SEO change");
      }
    },
  );

  app.get(
    "/admin/seo/reports",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const actor = requireAdmin(request);

      try {
        return ok({
          data: await listSeoReports(db, { actorRole: actor.role, actorUserId: actor.id }),
        });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Failed to load SEO reports");
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/admin/seo/reports/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const actor = requireAdmin(request);

      try {
        return ok({
          data: await getSeoReportById(db, { actorRole: actor.role, actorUserId: actor.id }, request.params.id),
        });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Failed to load SEO report");
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/seo/reports/:id/pdf",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const actor = requireAdmin(request);

      try {
        requireAdmin(request);
        const exported = await exportSeoReportPdf(db, { actorRole: actor.role, actorUserId: actor.id }, request.params.id);
        reply.header("Content-Type", "application/pdf");
        reply.header("Content-Disposition", `attachment; filename="${exported.filename}"`);
        return reply.send(exported.pdf);
      } catch (error) {
        const message = error instanceof Error && error.message === "PDF_EXPORT_FAILED"
          ? "SEO PDF export is temporarily unavailable"
          : error instanceof Error
            ? error.message
            : "Failed to export SEO PDF";
        const statusCode = error instanceof Error && error.message === "PDF_EXPORT_FAILED"
          ? 503
          : typeof (error as { statusCode?: unknown })?.statusCode === "number"
            ? (error as { statusCode: number }).statusCode
            : 500;
        return sendApiError(reply, statusCode, message);
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
        const audit = await createSeoAudit(
          db,
          { actorRole: "admin", actorUserId: null },
          { scope: "all_pages", mode: "full" },
        );
        await runSeoAuditJob(
          db,
          audit.id,
          {
            warn: (payload, message) => app.log.warn(payload, message),
            info: (payload, message) => app.log.info(payload, message),
            error: (payload, message) => app.log.error(payload, message),
          },
        );
        const result = await getSeoAuditById(db, { actorRole: "admin", actorUserId: null }, audit.id);
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
        return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Failed to run SEO audit");
      }
    },
  );
}
