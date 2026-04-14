import type { FastifyInstance } from "fastify";
import { ok } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { resolveMemberAccess } from "../services/divin8/memberAccessService.js";
import { listRecordingsForUser } from "../services/orderRecordingService.js";

export async function meRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: requireAuth }, async (request) => {
    const user = request.dbUser!;
    const response = {
      id: user.id,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
    };

    try {
      const memberAccess = await resolveMemberAccess(app.db, user.id);
      if (!memberAccess) {
        return ok(response);
      }

      return ok({
        ...response,
        member: {
          tier: memberAccess.tier,
          subscriptionStatus: memberAccess.subscriptionStatus,
          billingInterval: memberAccess.billingInterval,
          capabilities: memberAccess.capabilities,
          usage: memberAccess.usage,
        },
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
}
