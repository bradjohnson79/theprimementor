import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { getAllClients, getClientById } from "../services/clientService.js";

export async function clientRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { page?: string; limit?: string } }>(
    "/clients",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (request.dbUser!.role !== "admin") {
        return reply.status(403).send({ error: "Admin access required" });
      }

      const page = Math.max(1, parseInt(request.query.page || "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || "20", 10) || 20));

      const result = await getAllClients(app.db, { page, limit });
      return result;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/clients/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (request.dbUser!.role !== "admin") {
        return reply.status(403).send({ error: "Admin access required" });
      }

      const client = await getClientById(app.db, request.params.id);
      if (!client) {
        return reply.status(404).send({ error: "Client not found" });
      }
      return client;
    },
  );
}
