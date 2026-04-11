import type { FastifyInstance } from "fastify";
import type { MentorTrainingPackageType } from "@wisdom/utils";
import { requireAuth } from "../middleware/auth.js";
import { createCheckoutSession } from "../services/paymentService.js";
import {
  getMentorTrainingPageData,
  prepareMentorTrainingOrderForCheckout,
  updateMentorTrainingOrderStatus,
} from "../services/mentorTrainingService.js";

interface MentorTrainingCheckoutBody {
  packageType?: MentorTrainingPackageType;
}

interface MentorTrainingStatusBody {
  status?: "in_progress" | "completed";
}

export async function mentorTrainingRoutes(app: FastifyInstance) {
  app.get("/mentor-training", { preHandler: requireAuth }, async (request, reply) => {
    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    return {
      data: await getMentorTrainingPageData(app.db, request.dbUser!.id),
    };
  });

  app.post<{ Body: MentorTrainingCheckoutBody }>("/mentor-training/checkout", { preHandler: requireAuth }, async (request, reply) => {
    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }
    if (!request.dbUser || !request.clerkId) {
      return reply.status(401).send({ error: "Authenticated user context is required" });
    }
    if (!request.body?.packageType) {
      return reply.status(400).send({ error: "packageType is required" });
    }

    const prepared = await prepareMentorTrainingOrderForCheckout(app.db, {
      userId: request.dbUser.id,
      packageType: request.body.packageType,
    });

    if (prepared.kind === "already_paid") {
      return reply.send({
        alreadyPaid: true,
        trainingOrderId: prepared.order.id,
        status: prepared.order.status,
        requiresPayment: false,
        url: null,
      });
    }

    const session = await createCheckoutSession(app.db, {
      type: "mentor_training",
      trainingOrderId: prepared.order.id,
      userId: request.dbUser.id,
      userEmail: request.dbUser.email,
      clerkId: request.clerkId,
    });

    return reply.send({
      alreadyPaid: false,
      requiresPayment: true,
      trainingOrderId: prepared.order.id,
      sessionId: session.id,
      url: session.url,
    });
  });

  app.patch<{ Params: { orderId: string }; Body: MentorTrainingStatusBody }>(
    "/admin/mentor-training/:orderId/status",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!app.db) {
        return reply.status(503).send({ error: "Database not available" });
      }
      if (request.dbUser?.role !== "admin") {
        return reply.status(403).send({ error: "Admin access required" });
      }
      if (request.body?.status !== "in_progress" && request.body?.status !== "completed") {
        return reply.status(400).send({ error: "status must be in_progress or completed" });
      }

      return {
        data: await updateMentorTrainingOrderStatus(app.db, {
          orderId: request.params.orderId,
          status: request.body.status,
        }),
      };
    },
  );
}
