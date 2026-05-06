import type { FastifyInstance, FastifyReply } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase } from "../routeAssertions.js";
import {
  addSubscriptionAdminNote,
  cancelSubscriptionAtPeriodEnd,
  cancelSubscriptionImmediately,
  emergencyReactivateRegeneration,
  extendRegenerationAccess,
  extendRenewalDate,
  grantCourtesyMonth,
  pauseSubscription,
  reactivateSubscription,
  resumeSubscription,
  retryPayment,
  sendManualInvoice,
  setRegenerationGracePeriod,
  toggleRegenerationPrioritySupport,
} from "../services/adminSubscriptionLifecycleService.js";

interface SubscriptionActionParams {
  id: string;
}

interface ReasonBody {
  reason?: string;
}

interface PauseBody extends ReasonBody {
  resumesAt?: string | null;
}

interface DaysBody extends ReasonBody {
  days?: number;
}

interface PriorityBody extends ReasonBody {
  enabled?: boolean;
}

interface NoteBody {
  note?: string;
}

function numericDays(value: unknown) {
  return typeof value === "number" ? value : Number(value);
}

async function handleSubscriptionRoute(reply: FastifyReply, fn: () => Promise<unknown>) {
  try {
    return ok(await fn());
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode && statusCode >= 400 && statusCode < 600) {
        return sendApiError(reply, statusCode, error.message);
      }
    }
    throw error;
  }
}

export async function adminSubscriptionsRoutes(app: FastifyInstance) {
  app.post<{ Params: SubscriptionActionParams; Body: ReasonBody }>(
    "/admin/subscriptions/:id/cancel-period-end",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      return handleSubscriptionRoute(reply, () => cancelSubscriptionAtPeriodEnd(db, {
        subscriptionId: request.params.id,
        actorUserId: request.dbUser!.id,
        reason: request.body?.reason,
      }));
    },
  );

  app.post<{ Params: SubscriptionActionParams; Body: ReasonBody }>(
    "/admin/subscriptions/:id/cancel-immediately",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      return handleSubscriptionRoute(reply, () => cancelSubscriptionImmediately(db, {
        subscriptionId: request.params.id,
        actorUserId: request.dbUser!.id,
        reason: request.body?.reason,
      }));
    },
  );

  app.post<{ Params: SubscriptionActionParams; Body: ReasonBody }>(
    "/admin/subscriptions/:id/reactivate",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      return handleSubscriptionRoute(reply, () => reactivateSubscription(db, {
        subscriptionId: request.params.id,
        actorUserId: request.dbUser!.id,
        reason: request.body?.reason,
      }));
    },
  );

  app.post<{ Params: SubscriptionActionParams; Body: PauseBody }>(
    "/admin/subscriptions/:id/pause",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      return handleSubscriptionRoute(reply, () => pauseSubscription(db, {
        subscriptionId: request.params.id,
        actorUserId: request.dbUser!.id,
        reason: request.body?.reason,
        resumesAt: request.body?.resumesAt,
      }));
    },
  );

  app.post<{ Params: SubscriptionActionParams; Body: ReasonBody }>(
    "/admin/subscriptions/:id/resume",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      return handleSubscriptionRoute(reply, () => resumeSubscription(db, {
        subscriptionId: request.params.id,
        actorUserId: request.dbUser!.id,
        reason: request.body?.reason,
      }));
    },
  );

  app.post<{ Params: SubscriptionActionParams; Body: DaysBody }>(
    "/admin/subscriptions/:id/extend-renewal",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      return handleSubscriptionRoute(reply, () => extendRenewalDate(db, {
        subscriptionId: request.params.id,
        actorUserId: request.dbUser!.id,
        reason: request.body?.reason,
        days: numericDays(request.body?.days),
      }));
    },
  );

  app.post<{ Params: SubscriptionActionParams; Body: ReasonBody }>(
    "/admin/subscriptions/:id/grant-courtesy-month",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      return handleSubscriptionRoute(reply, () => grantCourtesyMonth(db, {
        subscriptionId: request.params.id,
        actorUserId: request.dbUser!.id,
        reason: request.body?.reason,
      }));
    },
  );

  app.post<{ Params: SubscriptionActionParams; Body: ReasonBody }>(
    "/admin/subscriptions/:id/retry-payment",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      return handleSubscriptionRoute(reply, () => retryPayment(db, {
        subscriptionId: request.params.id,
        actorUserId: request.dbUser!.id,
        reason: request.body?.reason,
      }));
    },
  );

  app.post<{ Params: SubscriptionActionParams; Body: ReasonBody }>(
    "/admin/subscriptions/:id/send-manual-invoice",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      return handleSubscriptionRoute(reply, () => sendManualInvoice(db, {
        subscriptionId: request.params.id,
        actorUserId: request.dbUser!.id,
        reason: request.body?.reason,
      }));
    },
  );

  app.post<{ Params: SubscriptionActionParams; Body: DaysBody }>(
    "/admin/subscriptions/:id/regeneration/extend-access",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      return handleSubscriptionRoute(reply, () => extendRegenerationAccess(db, {
        subscriptionId: request.params.id,
        actorUserId: request.dbUser!.id,
        reason: request.body?.reason,
        days: numericDays(request.body?.days),
      }));
    },
  );

  app.post<{ Params: SubscriptionActionParams; Body: PriorityBody }>(
    "/admin/subscriptions/:id/regeneration/priority-support",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      return handleSubscriptionRoute(reply, () => toggleRegenerationPrioritySupport(db, {
        subscriptionId: request.params.id,
        actorUserId: request.dbUser!.id,
        reason: request.body?.reason,
        enabled: request.body?.enabled === true,
      }));
    },
  );

  app.post<{ Params: SubscriptionActionParams; Body: DaysBody }>(
    "/admin/subscriptions/:id/regeneration/grace-period",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      return handleSubscriptionRoute(reply, () => setRegenerationGracePeriod(db, {
        subscriptionId: request.params.id,
        actorUserId: request.dbUser!.id,
        reason: request.body?.reason,
        days: numericDays(request.body?.days),
      }));
    },
  );

  app.post<{ Params: SubscriptionActionParams; Body: ReasonBody }>(
    "/admin/subscriptions/:id/regeneration/emergency-reactivate",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      return handleSubscriptionRoute(reply, () => emergencyReactivateRegeneration(db, {
        subscriptionId: request.params.id,
        actorUserId: request.dbUser!.id,
        reason: request.body?.reason,
      }));
    },
  );

  app.post<{ Params: SubscriptionActionParams; Body: NoteBody }>(
    "/admin/subscriptions/:id/notes",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      return handleSubscriptionRoute(reply, () => addSubscriptionAdminNote(db, {
        subscriptionId: request.params.id,
        actorUserId: request.dbUser!.id,
        note: request.body?.note ?? "",
      }));
    },
  );
}
