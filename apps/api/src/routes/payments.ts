import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
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
  app.get("/payments", { preHandler: requireAuth }, async (request, reply) => {
    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    return {
      data: await listPaymentsForUser(app.db, request.dbUser!.id),
    };
  });

  app.get("/admin/payments", { preHandler: requireAuth }, async (request, reply) => {
    if (request.dbUser!.role !== "admin") {
      return reply.status(403).send({ error: "Admin access required" });
    }

    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    return {
      data: await listPaymentsForAdmin(app.db),
    };
  });

  app.post<{ Body: CreatePaymentBody }>("/payments", { preHandler: requireAuth }, async (request, reply) => {
    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    const { bookingId, metadata } = request.body ?? {};
    if (!bookingId) {
      return reply.status(400).send({ error: "bookingId is required" });
    }

    return {
      data: await createPaymentForBooking(app.db, {
        bookingId,
        actorUserId: request.dbUser!.id,
        actorRole: request.dbUser!.role,
        metadata: parsePaymentMetadata(metadata),
      }),
    };
  });

  app.post<{ Params: PaymentParams; Body: ConfirmPaymentBody }>(
    "/payments/:id/confirm",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!app.db) {
        return reply.status(503).send({ error: "Database not available" });
      }

      return {
        data: await confirmPayment(app.db, {
          paymentId: request.params.id,
          actorUserId: request.dbUser!.id,
          actorRole: request.dbUser!.role,
          manual: request.body?.manual === true,
        }),
      };
    },
  );

  app.post<{ Params: PaymentParams }>("/payments/:id/refund", { preHandler: requireAuth }, async (request, reply) => {
    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    return {
      data: await refundPayment(app.db, {
        paymentId: request.params.id,
        actorUserId: request.dbUser!.id,
        actorRole: request.dbUser!.role,
      }),
    };
  });
}
