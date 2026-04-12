import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase } from "../routeAssertions.js";
import {
  confirmPayment,
  createPaymentForBooking,
  listPaymentsForAdmin,
  listPaymentsForUser,
  parsePaymentMetadata,
  refundPayment,
} from "../services/payments/paymentsService.js";

interface CreatePaymentBody {
  bookingId?: string;
  metadata?: unknown;
}

interface ConfirmPaymentBody {
  manual?: boolean;
}

interface PaymentParams {
  id: string;
}

export async function paymentsRoutes(app: FastifyInstance) {
  app.get("/payments", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    return ok({
      data: await listPaymentsForUser(db, request.dbUser!.id),
    });
  });

  app.get("/admin/payments", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    const db = requireDatabase(app.db);
    return ok({
      data: await listPaymentsForAdmin(db),
    });
  });

  app.post<{ Body: CreatePaymentBody }>("/payments", { preHandler: requireAuth }, async (request, reply) => {
    const db = requireDatabase(app.db);

    const { bookingId, metadata } = request.body ?? {};
    if (!bookingId) {
      return sendApiError(reply, 400, "bookingId is required");
    }

    return ok({
      data: await createPaymentForBooking(db, {
        bookingId,
        actorUserId: request.dbUser!.id,
        actorRole: request.dbUser!.role,
        metadata: parsePaymentMetadata(metadata),
      }),
    });
  });

  app.post<{ Params: PaymentParams; Body: ConfirmPaymentBody }>(
    "/payments/:id/confirm",
    { preHandler: requireAuth },
    async (request) => {
      const db = requireDatabase(app.db);
      return ok({
        data: await confirmPayment(db, {
          paymentId: request.params.id,
          actorUserId: request.dbUser!.id,
          actorRole: request.dbUser!.role,
          manual: request.body?.manual === true,
        }),
      });
    },
  );

  app.post<{ Params: PaymentParams }>("/payments/:id/refund", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    return ok({
      data: await refundPayment(db, {
        paymentId: request.params.id,
        actorUserId: request.dbUser!.id,
        actorRole: request.dbUser!.role,
      }),
    });
  });
}
