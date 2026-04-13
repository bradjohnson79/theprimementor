import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase } from "../routeAssertions.js";
import { getAdminClients, getClientById } from "../services/clientService.js";

interface ClientsQuery {
  page?: string;
  limit?: string;
  offset?: string;
  search?: string;
  sort?: "newest" | "highest_spend" | "most_orders";
  activeOnly?: string;
}

export async function clientRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ClientsQuery }>(
    "/clients",
    { preHandler: requireAuth },
    async (request) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);

      const limit = Number(request.query.limit);
      const offset = Number(request.query.offset);
      const page = Number(request.query.page);
      const derivedOffset = Number.isFinite(offset)
        ? offset
        : Number.isFinite(page) && page > 0 && Number.isFinite(limit)
          ? (Math.trunc(page) - 1) * Math.trunc(limit)
          : undefined;

      const result = await getAdminClients(db, {
        search: request.query.search,
        sort: request.query.sort,
        activeOnly: request.query.activeOnly === undefined ? undefined : request.query.activeOnly === "true",
        limit: Number.isFinite(limit) ? limit : undefined,
        offset: Number.isFinite(derivedOffset) ? derivedOffset : undefined,
      });
      return ok(result);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/clients/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);

      const client = await getClientById(db, request.params.id);
      if (!client) {
        return sendApiError(reply, 404, "Client not found");
      }
      return ok(client);
    },
  );
}
