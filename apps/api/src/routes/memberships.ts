import type { FastifyInstance } from "fastify";
import { ok } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../routeAssertions.js";
import { confirmMembershipPurchase, createOrReuseMembershipPurchase } from "../services/membershipPurchaseService.js";

interface CreateMembershipPurchaseBody {
  tier?: string;
  billingInterval?: "monthly" | "annual";
}

export async function membershipsRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateMembershipPurchaseBody }>("/member/subscriptions", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    const membership = await createOrReuseMembershipPurchase(db, {
      userId: request.dbUser!.id,
      tier: request.body?.tier,
      billingInterval: request.body?.billingInterval,
    });

    return ok({
      success: true,
      membershipId: membership.id,
      requiresPayment: true,
      data: membership,
    });
  });

  app.post<{ Params: { membershipId: string } }>("/member/subscriptions/:membershipId/confirm", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    const membership = await confirmMembershipPurchase(db, {
      membershipId: request.params.membershipId,
      userId: request.dbUser!.id,
    });

    return ok({
      success: true,
      membershipId: membership.id,
      data: membership,
    });
  });
}
