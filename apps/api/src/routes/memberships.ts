import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../routeAssertions.js";
import { confirmMembershipPurchase, createOrReuseMembershipPurchase } from "../services/membershipPurchaseService.js";
import {
  cancelMemberRecurringSubscription,
  listMemberRecurringSubscriptions,
  type MemberSubscriptionKind,
} from "../services/memberSubscriptionsService.js";

interface CreateMembershipPurchaseBody {
  tier?: string;
  billingInterval?: "monthly" | "annual";
}

interface CancelMemberSubscriptionParams {
  subscriptionType: string;
  subscriptionId: string;
}

export async function membershipsRoutes(app: FastifyInstance) {
  app.get("/member/subscriptions", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    return ok({
      data: await listMemberRecurringSubscriptions(db, request.dbUser!.id),
    });
  });

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

  app.post<{ Params: CancelMemberSubscriptionParams }>(
    "/member/subscriptions/:subscriptionType/:subscriptionId/cancel",
    { preHandler: requireAuth },
    async (request, reply) => {
      const subscriptionType = request.params.subscriptionType.trim();
      if (subscriptionType !== "membership" && subscriptionType !== "regeneration") {
        return sendApiError(reply, 400, "subscriptionType must be membership or regeneration");
      }

      const db = requireDatabase(app.db);
      return ok({
        data: await cancelMemberRecurringSubscription(db, {
          userId: request.dbUser!.id,
          subscriptionType: subscriptionType as MemberSubscriptionKind,
          subscriptionId: request.params.subscriptionId,
        }),
      });
    },
  );
}
