import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { getAdminDashboardData } from "../services/dashboardService.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/admin/dashboard", { preHandler: requireAuth }, async (request, reply) => {
    if (request.dbUser?.role !== "admin") {
      return reply.status(403).send({ error: "Admin access required" });
    }

    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    return {
      data: await getAdminDashboardData(app.db),
    };
  });
}
