import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireClerkId, requireDatabase } from "../routeAssertions.js";
import {
  confirmRegenerationCheckoutSession,
  createRegenerationCheckoutSession,
  getRegenerationSubscriptionSummary,
  listRegenerationCheckIns,
  reconcileRegenerationSubscriptionForUser,
  setRegenerationAdminOverride,
  submitRegenerationCheckIn,
} from "../services/regenerationSubscriptionService.js";

interface ConfirmCheckoutBody {
  checkoutSessionId?: string;
}

interface OverrideBody {
  enabled?: boolean;
  durationDays?: number;
}

interface CheckInBody {
  experiences?: string | null;
  changesNoticed?: string | null;
  challenges?: string | null;
}

export async function regenerationRoutes(app: FastifyInstance) {
  app.get("/member/regeneration-subscription", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    return ok({
      data: await getRegenerationSubscriptionSummary(db, request.dbUser!.id),
    });
  });

  app.post("/member/regeneration-subscription/checkout", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    const result = await createRegenerationCheckoutSession(db, {
      userId: request.dbUser!.id,
      clerkId: requireClerkId(request),
    });
    return ok(result);
  });

  app.post<{ Body: ConfirmCheckoutBody }>(
    "/member/regeneration-subscription/confirm",
    { preHandler: requireAuth },
    async (request, reply) => {
      const checkoutSessionId = request.body?.checkoutSessionId?.trim();
      if (!checkoutSessionId) {
        return sendApiError(reply, 400, "checkoutSessionId is required");
      }
      const db = requireDatabase(app.db);
      return ok({
        data: await confirmRegenerationCheckoutSession(db, {
          userId: request.dbUser!.id,
          checkoutSessionId,
        }, {
          info: (payload, message) => app.log.info(payload, message),
          warn: (payload, message) => app.log.warn(payload, message),
          error: (payload, message) => app.log.error(payload, message),
        }),
      });
    },
  );

  app.get("/member/regeneration-subscription/check-ins", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    return ok({
      data: await listRegenerationCheckIns(db, request.dbUser!.id),
    });
  });

  app.post<{ Body: CheckInBody }>(
    "/member/regeneration-subscription/check-ins",
    { preHandler: requireAuth },
    async (request) => {
      const db = requireDatabase(app.db);
      return ok({
        data: await submitRegenerationCheckIn(db, {
          userId: request.dbUser!.id,
          experiences: request.body?.experiences ?? null,
          changesNoticed: request.body?.changesNoticed ?? null,
          challenges: request.body?.challenges ?? null,
        }),
      });
    },
  );

  app.post<{ Params: { userId: string } }>(
    "/admin/regeneration-subscriptions/:userId/reconcile",
    { preHandler: requireAuth },
    async (request) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      return ok({
        data: await reconcileRegenerationSubscriptionForUser(db, request.params.userId, {
          info: (payload, message) => app.log.info(payload, message),
          warn: (payload, message) => app.log.warn(payload, message),
          error: (payload, message) => app.log.error(payload, message),
        }),
      });
    },
  );

  app.patch<{ Params: { userId: string }; Body: OverrideBody }>(
    "/admin/regeneration-subscriptions/:userId/override",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      if (typeof request.body?.enabled !== "boolean") {
        return sendApiError(reply, 400, "enabled is required");
      }
      const db = requireDatabase(app.db);
      return ok({
        data: await setRegenerationAdminOverride(db, {
          userId: request.params.userId,
          enabled: request.body.enabled,
          durationDays: request.body.durationDays,
        }),
      });
    },
  );
}
