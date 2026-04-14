import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase } from "../routeAssertions.js";
import {
  getAdminAnalyticsEvents,
  getAdminAnalyticsOverview,
  getAdminAnalyticsPageviews,
  getAdminAnalyticsReferrers,
  getAdminAnalyticsSummary,
  resolveAnalyticsRange,
} from "../services/analyticsService.js";

function readRange(value: string | undefined) {
  return resolveAnalyticsRange(value);
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { range?: string } }>(
    "/admin/analytics/summary",
    { preHandler: requireAuth },
    async (request, reply) => {
      const actor = requireAdmin(request);
      const range = readRange(request.query?.range);

      try {
        return ok({
          data: await getAdminAnalyticsSummary(
            { actorRole: actor.role, actorUserId: actor.id },
            range,
            {
              warn: (payload, message) => app.log.warn(payload, message),
            },
          ),
        });
      } catch (error) {
        return sendApiError(reply, 500, error instanceof Error ? error.message : "Failed to load analytics summary");
      }
    },
  );

  app.get<{ Querystring: { range?: string } }>(
    "/admin/analytics/pageviews",
    { preHandler: requireAuth },
    async (request, reply) => {
      const actor = requireAdmin(request);
      const range = readRange(request.query?.range);

      try {
        return ok({
          data: await getAdminAnalyticsPageviews(
            { actorRole: actor.role, actorUserId: actor.id },
            range,
            {
              warn: (payload, message) => app.log.warn(payload, message),
            },
          ),
        });
      } catch (error) {
        return sendApiError(reply, 500, error instanceof Error ? error.message : "Failed to load pageview analytics");
      }
    },
  );

  app.get<{ Querystring: { range?: string } }>(
    "/admin/analytics/events",
    { preHandler: requireAuth },
    async (request, reply) => {
      const actor = requireAdmin(request);
      const range = readRange(request.query?.range);

      try {
        return ok({
          data: await getAdminAnalyticsEvents(
            { actorRole: actor.role, actorUserId: actor.id },
            range,
            {
              warn: (payload, message) => app.log.warn(payload, message),
            },
          ),
        });
      } catch (error) {
        return sendApiError(reply, 500, error instanceof Error ? error.message : "Failed to load event analytics");
      }
    },
  );

  app.get<{ Querystring: { range?: string } }>(
    "/admin/analytics/referrers",
    { preHandler: requireAuth },
    async (request, reply) => {
      const actor = requireAdmin(request);
      const range = readRange(request.query?.range);

      try {
        return ok({
          data: await getAdminAnalyticsReferrers(
            { actorRole: actor.role, actorUserId: actor.id },
            range,
            {
              warn: (payload, message) => app.log.warn(payload, message),
            },
          ),
        });
      } catch (error) {
        return sendApiError(reply, 500, error instanceof Error ? error.message : "Failed to load referrer analytics");
      }
    },
  );

  app.get<{ Querystring: { range?: string } }>(
    "/admin/analytics/overview",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const actor = requireAdmin(request);
      const range = readRange(request.query?.range);

      try {
        return ok({
          data: await getAdminAnalyticsOverview(
            db,
            { actorRole: actor.role, actorUserId: actor.id },
            range,
          ),
        });
      } catch (error) {
        return sendApiError(reply, 500, error instanceof Error ? error.message : "Failed to load analytics overview");
      }
    },
  );
}
