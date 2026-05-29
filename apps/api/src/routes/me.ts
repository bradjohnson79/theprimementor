import type { FastifyInstance } from "fastify";
import { ok } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDbUser } from "../routeAssertions.js";
import { resolveMemberAccess } from "../services/divin8/memberAccessService.js";
import { listRecordingsForUser } from "../services/orderRecordingService.js";
import { getRegenerationSubscriptionSummary } from "../services/regenerationSubscriptionService.js";
import { updateMemberProfile } from "../services/memberProfileService.js";

export async function meRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: requireAuth }, async (request) => {
    const user = request.dbUser!;
    const response = {
      id: user.id,
      email: user.email,
      phone: user.phone ?? null,
      role: user.role,
      created_at: user.created_at,
    };

    try {
      const [memberAccess, regeneration] = await Promise.all([
        resolveMemberAccess(app.db, user.id),
        getRegenerationSubscriptionSummary(app.db, user.id),
      ]);
      if (!memberAccess && !regeneration) {
        return ok(response);
      }

      return ok({
        ...response,
        member: memberAccess
          ? {
              tier: memberAccess.tier,
              subscriptionStatus: memberAccess.subscriptionStatus,
              billingInterval: memberAccess.billingInterval,
              capabilities: memberAccess.capabilities,
              usage: memberAccess.usage,
            }
          : undefined,
        regeneration: regeneration
          ? {
              ...regeneration,
            }
          : undefined,
      });
    } catch (error) {
      request.log.warn({ err: error, userId: user.id }, "me_membership_resolution_failed");
      return ok(response);
    }
  });

  app.get("/me/recordings", { preHandler: requireAuth }, async (request) => {
    return ok({
      recordings: await listRecordingsForUser(app.db, request.dbUser!.id),
    });
  });

  app.patch("/me/profile", { preHandler: requireAuth }, async (request) => {
    const user = requireDbUser(request);
    return ok(await updateMemberProfile(app.db, user.id, request.body));
  });
}
