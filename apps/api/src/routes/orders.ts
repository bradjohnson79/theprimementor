import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase } from "../routeAssertions.js";
import { upsertOrderRecordingLink } from "../services/orderRecordingService.js";
import { refundAdminOrder } from "../services/orderRefundService.js";
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

interface UpdateOrderRecordingBody {
  link?: string;
}

interface RefundOrderBody {
  reason?: string;
  customReason?: string;
}

export async function ordersRoutes(app: FastifyInstance) {
  app.get<{ Querystring: OrdersQuery }>("/admin/orders", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
    const db = requireDatabase(app.db);

    const limit = Number(request.query.limit);
    const offset = Number(request.query.offset);
    const showArchived = request.query.showArchived === "true";
    return ok(await getAdminOrders(db, {
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
      showArchived,
    }));
  });

  app.post<{ Body: ArchiveOrdersBody }>("/admin/orders/archive", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
    const db = requireDatabase(app.db);

    const orderIds = Array.isArray(request.body?.orderIds)
      ? request.body.orderIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    const archived = request.body?.archived !== false;

    if (orderIds.length === 0) {
      return sendApiError(reply, 400, "orderIds is required");
    }

    return ok({
      data: await setArchivedStateForAdminOrders(db, { orderIds, archived }),
    });
  });

  app.get<{ Params: { orderId: string } }>("/admin/orders/:orderId", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
    const db = requireDatabase(app.db);

    try {
      return ok({
        data: await getAdminOrderById(db, request.params.orderId),
      });
    } catch (error) {
      if (error instanceof Error && "statusCode" in error && (error as { statusCode?: number }).statusCode === 404) {
        return sendApiError(reply, 404, "Order not found", { code: "ORDER_NOT_FOUND" });
      }
      throw error;
    }
  });

  app.post<{ Params: { orderId: string }; Querystring: GenerateQuery }>(
    "/admin/orders/:orderId/generate",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);

      const force = request.query.force === "true";
      const result = await dispatchOrderExecution(db, request.params.orderId, {
        force,
        trigger: "admin",
        logger: app.log,
      });

      return reply.status(result.statusCode).send(ok({
        data: result.order,
        output: result.output,
        outcome: result.outcome,
        message: result.message,
        report_id: result.report_id,
        details: result.details ?? null,
      }));
    },
  );

  app.post<{ Params: { orderId: string }; Body: UpdateOrderRecordingBody }>(
    "/admin/orders/:orderId/recording",
    { preHandler: requireAuth },
    async (request) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);

      await upsertOrderRecordingLink(db, {
        orderId: request.params.orderId,
        link: request.body?.link ?? "",
      });

      return ok({
        data: await getAdminOrderById(db, request.params.orderId),
      });
    },
  );

  app.post<{ Params: { orderId: string }; Body: RefundOrderBody }>(
    "/admin/orders/:orderId/refund",
    { preHandler: requireAuth },
    async (request) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);

      return ok({
        data: await refundAdminOrder(db, {
          orderId: request.params.orderId,
          actorUserId: request.dbUser!.id,
          actorRole: request.dbUser!.role,
          reason: request.body?.reason ?? "",
          customReason: request.body?.customReason,
        }),
      });
    },
  );
}
