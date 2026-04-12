import type { FastifyInstance } from "fastify";
import type { MentorTrainingPackageType } from "@wisdom/utils";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireClerkId, requireDatabase, requireDbUser } from "../routeAssertions.js";
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
  app.get("/mentor-training", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    return ok({
      data: await getMentorTrainingPageData(db, request.dbUser!.id),
    });
  });

  app.post<{ Body: MentorTrainingCheckoutBody }>("/mentor-training/checkout", { preHandler: requireAuth }, async (request, reply) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    const clerkId = requireClerkId(request);
    if (!request.body?.packageType) {
      return sendApiError(reply, 400, "packageType is required");
    }

    const prepared = await prepareMentorTrainingOrderForCheckout(db, {
      userId: user.id,
      packageType: request.body.packageType,
    });

    if (prepared.kind === "already_paid") {
      return ok({
        alreadyPaid: true,
        trainingOrderId: prepared.order.id,
        status: prepared.order.status,
        requiresPayment: false,
        url: null,
      });
    }

    const session = await createCheckoutSession(db, {
      type: "mentor_training",
      trainingOrderId: prepared.order.id,
      userId: user.id,
      userEmail: user.email,
      clerkId,
    });

    return ok({
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
      const db = requireDatabase(app.db);
      requireAdmin(request);
      if (request.body?.status !== "in_progress" && request.body?.status !== "completed") {
        return sendApiError(reply, 400, "status must be in_progress or completed");
      }

      return ok({
        data: await updateMentorTrainingOrderStatus(db, {
          orderId: request.params.orderId,
          status: request.body.status,
        }),
      });
    },
  );
}
