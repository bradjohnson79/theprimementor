import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { dispatchOrderExecution } from "../services/divin8ExecutionDispatcher.js";
import { getAdminOrderById, getAdminOrders, setArchivedStateForAdminOrders } from "../services/ordersService.js";

interface OrdersQuery {
  limit?: string;
  offset?: string;
  showArchived?: string;
}

interface GenerateQuery {
  force?: string;
}

interface ArchiveOrdersBody {
  orderIds?: string[];
  archived?: boolean;
}

export async function ordersRoutes(app: FastifyInstance) {
  app.get<{ Querystring: OrdersQuery }>("/admin/orders", { preHandler: requireAuth }, async (request, reply) => {
    if (request.dbUser?.role !== "admin") {
      return reply.status(403).send({ error: "Admin access required" });
    }

    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    const limit = Number(request.query.limit);
    const offset = Number(request.query.offset);
    const showArchived = request.query.showArchived === "true";
    return getAdminOrders(app.db, {
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
      showArchived,
    });
  });

  app.post<{ Body: ArchiveOrdersBody }>("/admin/orders/archive", { preHandler: requireAuth }, async (request, reply) => {
    if (request.dbUser?.role !== "admin") {
      return reply.status(403).send({ error: "Admin access required" });
    }

    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    const orderIds = Array.isArray(request.body?.orderIds)
      ? request.body.orderIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    const archived = request.body?.archived !== false;

    if (orderIds.length === 0) {
      return reply.status(400).send({ error: "orderIds is required" });
    }

    return {
      data: await setArchivedStateForAdminOrders(app.db, { orderIds, archived }),
    };
  });

  app.get<{ Params: { orderId: string } }>("/admin/orders/:orderId", { preHandler: requireAuth }, async (request, reply) => {
    if (request.dbUser?.role !== "admin") {
      return reply.status(403).send({ error: "Admin access required" });
    }

    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    try {
      return {
        data: await getAdminOrderById(app.db, request.params.orderId),
      };
    } catch (error) {
      if (error instanceof Error && "statusCode" in error && (error as { statusCode?: number }).statusCode === 404) {
        return reply.status(404).send({ error: "Order not found", code: "ORDER_NOT_FOUND" });
      }
      throw error;
    }
  });

  app.post<{ Params: { orderId: string }; Querystring: GenerateQuery }>(
    "/admin/orders/:orderId/generate",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (request.dbUser?.role !== "admin") {
        return reply.status(403).send({ error: "Admin access required" });
      }

      if (!app.db) {
        return reply.status(503).send({ error: "Database not available" });
      }

      const force = request.query.force === "true";
      const result = await dispatchOrderExecution(app.db, request.params.orderId, {
        force,
        trigger: "admin",
        logger: app.log,
      });

      return reply.status(result.statusCode).send({
        data: result.order,
        output: result.output,
        outcome: result.outcome,
        message: result.message,
        report_id: result.report_id,
        details: result.details ?? null,
      });
    },
  );
}
