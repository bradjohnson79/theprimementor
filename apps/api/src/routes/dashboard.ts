import type { FastifyInstance } from "fastify";
import { ok } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase } from "../routeAssertions.js";
import { getAdminDashboardData } from "../services/dashboardService.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/admin/dashboard", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    const db = requireDatabase(app.db);
    return ok({
      data: await getAdminDashboardData(db),
    });
  });
}
