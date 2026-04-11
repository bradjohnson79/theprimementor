import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { confirmMembershipPurchase, createOrReuseMembershipPurchase } from "../services/membershipPurchaseService.js";

interface CreateMembershipPurchaseBody {
  tier?: string;
  billingInterval?: "monthly" | "annual";
}

export async function membershipsRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateMembershipPurchaseBody }>("/member/subscriptions", { preHandler: requireAuth }, async (request, reply) => {
    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    const membership = await createOrReuseMembershipPurchase(app.db, {
      userId: request.dbUser!.id,
      tier: request.body?.tier,
      billingInterval: request.body?.billingInterval,
    });

    return {
      success: true,
      membershipId: membership.id,
      requiresPayment: true,
      data: membership,
    };
  });

  app.post<{ Params: { membershipId: string } }>("/member/subscriptions/:membershipId/confirm", { preHandler: requireAuth }, async (request, reply) => {
    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    const membership = await confirmMembershipPurchase(app.db, {
      membershipId: request.params.membershipId,
      userId: request.dbUser!.id,
    });

    return {
      success: true,
      membershipId: membership.id,
      data: membership,
    };
  });
}
