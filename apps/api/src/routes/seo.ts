import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase } from "../routeAssertions.js";
import { listSeoSettings, type SeoPayloadInput, updateSeoSetting, upsertSeoSetting } from "../services/seoService.js";

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
}
