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
import {
  getRegenerationPeriodBenefitForUser,
  isManifestationConsultationSlot,
  readManifestationIdeogram,
  saveManifestationIdeogram,
  scheduleManifestationConsultation,
  updateManifestationPeriodFulfillment,
} from "../services/regenerationPeriodBenefitService.js";

interface ConfirmCheckoutBody {
  checkoutSessionId?: string;
}

interface CreateCheckoutBody {
  bookingId?: string;
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

  app.post<{ Body: CreateCheckoutBody }>(
    "/member/regeneration-subscription/checkout",
    { preHandler: requireAuth },
    async (request) => {
      const db = requireDatabase(app.db);
      const result = await createRegenerationCheckoutSession(db, {
        userId: request.dbUser!.id,
        clerkId: requireClerkId(request),
        bookingId: request.body?.bookingId?.trim() || null,
      });
      return ok(result);
    },
  );

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

  app.get("/member/regeneration-subscription/period-benefit", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    return ok({
      data: await getRegenerationPeriodBenefitForUser(db, request.dbUser!.id),
    });
  });

  app.post<{ Body: { slot?: string; availability?: Record<string, string[]>; timezone?: string } }>(
    "/member/regeneration-subscription/consultations",
    { preHandler: requireAuth },
    async (request, reply) => {
      const slot = request.body?.slot?.trim() ?? "";
      if (!isManifestationConsultationSlot(slot)) {
        return sendApiError(reply, 400, "Choose the beginning or midpoint consultation.");
      }
      const db = requireDatabase(app.db);
      return ok({
        data: await scheduleManifestationConsultation(db, {
          userId: request.dbUser!.id,
          slot,
          availability: request.body?.availability ?? {},
          timezone: request.body?.timezone?.trim() || "UTC",
        }),
      });
    },
  );

  app.get("/member/regeneration-subscription/ideogram", { preHandler: requireAuth }, async (request, reply) => {
    const db = requireDatabase(app.db);
    const file = await readManifestationIdeogram(db, request.dbUser!.id);
    return reply
      .header("Content-Type", file.contentType)
      .header("Content-Disposition", `attachment; filename="${file.fileName.replace(/"/g, "")}"`)
      .send(file.data);
  });

  app.get<{ Params: { userId: string } }>(
    "/admin/regeneration-subscriptions/:userId/period-benefit",
    { preHandler: requireAuth },
    async (request) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      return ok({ data: await getRegenerationPeriodBenefitForUser(db, request.params.userId) });
    },
  );

  app.patch<{ Params: { userId: string }; Body: { alignmentStatus?: string; reinforcementStatus?: string; ideogramStatus?: string } }>(
    "/admin/regeneration-subscriptions/:userId/period-benefit",
    { preHandler: requireAuth },
    async (request) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      return ok({
        data: await updateManifestationPeriodFulfillment(db, {
          userId: request.params.userId,
          alignmentStatus: request.body?.alignmentStatus,
          reinforcementStatus: request.body?.reinforcementStatus,
          ideogramStatus: request.body?.ideogramStatus,
        }),
      });
    },
  );

  app.post<{ Params: { userId: string } }>(
    "/admin/regeneration-subscriptions/:userId/ideogram",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const data = await request.file({ limits: { fileSize: 8 * 1024 * 1024 } });
      if (!data) return sendApiError(reply, 400, "Upload the ideogram circuit file.");
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk);
      const db = requireDatabase(app.db);
      return ok({
        data: await saveManifestationIdeogram(db, {
          userId: request.params.userId,
          fileName: data.filename || "ideogram-circuit",
          contentType: data.mimetype,
          data: Buffer.concat(chunks),
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
