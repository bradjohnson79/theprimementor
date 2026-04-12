import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase } from "../routeAssertions.js";
import { getAllClients, getClientById } from "../services/clientService.js";

export async function clientRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { page?: string; limit?: string } }>(
    "/clients",
    { preHandler: requireAuth },
    async (request) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);

      const page = Math.max(1, parseInt(request.query.page || "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || "20", 10) || 20));

      const result = await getAllClients(db, { page, limit });
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
