import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase } from "../routeAssertions.js";
import { upsertOrderRecordingLink } from "../services/orderRecordingService.js";
import { refundAdminOrder } from "../services/orderRefundService.js";
import { dispatchOrderExecution } from "../services/divin8ExecutionDispatcher.js";
import { getAdminOrderById, getAdminOrders, setArchivedStateForAdminOrders, type AdminOrderStatus, type AdminOrderType } from "../services/ordersService.js";
import { markAdminOrderManualPaid } from "../services/adminOrderPaymentService.js";
import { updateAdminOrderIntake, type AdminOrderIntakeUpdateInput } from "../services/adminOrderIntakeService.js";
import { sendAdminReportRecoveryInvoice } from "../services/reportRecoveryInvoiceService.js";
import { createAdminOrderInvoice } from "../services/adminOrderInvoiceService.js";

interface OrdersQuery {
  limit?: string;
  offset?: string;
  showArchived?: string;
  search?: string;
  type?: string;
  category?: string;
  trainingPackage?: string;
  trainingStatus?: string;
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

const ORDER_TYPES: AdminOrderType[] = ["session", "report", "subscription", "webinar", "mentor_training", "regeneration_offer", "custom"];
const TRAINING_PACKAGES = ["entry", "seeker", "initiate"] as const;
const ORDER_STATUSES: AdminOrderStatus[] = [
  "unpaid",
  "pending_payment",
  "paid",
  "in_progress",
  "processing",
  "completed",
  "cancelled",
  "refunded",
  "failed",
];

function parseOrderType(value: string | undefined): AdminOrderType | "all" | undefined {
  if (!value || value === "all") return value === "all" ? "all" : undefined;
  return ORDER_TYPES.includes(value as AdminOrderType) ? value as AdminOrderType : undefined;
}

function parseTrainingPackage(value: string | undefined): "all" | "entry" | "seeker" | "initiate" | undefined {
  if (!value || value === "all") return value === "all" ? "all" : undefined;
  return TRAINING_PACKAGES.includes(value as (typeof TRAINING_PACKAGES)[number])
    ? value as (typeof TRAINING_PACKAGES)[number]
    : undefined;
}

function parseOrderStatus(value: string | undefined): "all" | AdminOrderStatus | undefined {
  if (!value || value === "all") return value === "all" ? "all" : undefined;
  return ORDER_STATUSES.includes(value as AdminOrderStatus) ? value as AdminOrderStatus : undefined;
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
      search: request.query.search,
      type: parseOrderType(request.query.type),
      category: request.query.category,
      trainingPackage: parseTrainingPackage(request.query.trainingPackage),
      trainingStatus: parseOrderStatus(request.query.trainingStatus),
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

  app.patch<{ Params: { orderId: string }; Body: AdminOrderIntakeUpdateInput }>(
    "/admin/orders/:orderId/intake",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);

      try {
        await updateAdminOrderIntake(db, request.params.orderId, request.body ?? {});
        return ok({
          data: await getAdminOrderById(db, request.params.orderId),
        });
      } catch (error) {
        if (error instanceof Error && "statusCode" in error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 400 || statusCode === 404) {
            return sendApiError(reply, statusCode, error.message);
          }
        }
        throw error;
      }
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

  app.post<{ Params: { orderId: string } }>(
    "/admin/orders/:orderId/create-invoice",
    { preHandler: requireAuth },
    async (request, reply) => {
      const adminUser = requireAdmin(request);
      const db = requireDatabase(app.db);

      try {
        const result = await createAdminOrderInvoice(db, {
          orderId: request.params.orderId,
          adminUserId: adminUser.id,
          adminActorLabel: adminUser.email,
        });
        return ok(result);
      } catch (error) {
        if (error instanceof Error && "statusCode" in error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 400 || statusCode === 404 || statusCode === 409 || statusCode === 502) {
            return sendApiError(reply, statusCode, error.message);
          }
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { orderId: string } }>(
    "/admin/orders/:orderId/send-recovery-invoice",
    { preHandler: requireAuth },
    async (request) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);

      const result = await sendAdminReportRecoveryInvoice(db, request.params.orderId);
      return ok({
        ...result,
        order: await getAdminOrderById(db, request.params.orderId),
      });
    },
  );

  app.post<{ Params: { orderId: string } }>(
    "/admin/orders/:orderId/mark-paid",
    { preHandler: requireAuth },
    async (request) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);

      const order = await markAdminOrderManualPaid(db, {
        orderId: request.params.orderId,
        actorUserId: request.dbUser!.id,
        actorRole: request.dbUser!.role,
      });
      return ok({ order });
    },
  );
}
