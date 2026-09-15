import type { FastifyInstance } from "fastify";
import {
  getOnDemandWebinarById,
  getOnDemandWebinarPublicCatalog,
  listPublishedOnDemandWebinars,
} from "@wisdom/utils";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase, requireDbUser } from "../routeAssertions.js";
import { createSignedOnDemandPlayback, reconcileOnDemandMuxReadiness } from "../services/mux/muxPlaybackService.js";
import {
  getOnDemandWebinarEntitlement,
  canRequestOnDemandPlayback,
  hasActiveOnDemandWebinarEntitlement,
  listActiveOnDemandWebinarEntitlements,
} from "../services/webinars/onDemandWebinarEntitlementService.js";
import {
  getOnDemandWebinarProgress,
  upsertOnDemandWebinarProgress,
} from "../services/webinars/onDemandWebinarProgressService.js";
import {
  getWebinarAccessForUser,
  getWebinarEventOrThrow,
  getWebinarStateForUser,
  listPublicWebinarCatalog,
  toPublicWebinarCatalog,
} from "../services/webinarEventService.js";

interface EventParams {
  eventId: string;
}

interface OnDemandParams {
  webinarId: string;
}

function statusFromError(error: unknown, fallback = 500) {
  return typeof (error as { statusCode?: unknown })?.statusCode === "number"
    ? (error as { statusCode: number }).statusCode
    : fallback;
}

export async function webinarRoutes(app: FastifyInstance) {
  app.get("/webinars/on-demand", async () => {
    const entries = await Promise.all(listPublishedOnDemandWebinars().map(async (webinar) => {
      const readiness = await reconcileOnDemandMuxReadiness(webinar.webinarId);
      return getOnDemandWebinarPublicCatalog(webinar, readiness);
    }));
    return ok(entries);
  });

  app.get<{ Params: OnDemandParams }>("/webinars/on-demand/:webinarId", async (request, reply) => {
    const webinar = getOnDemandWebinarById(request.params.webinarId);
    if (!webinar) {
      return sendApiError(reply, 404, "On-demand webinar was not found");
    }
    const readiness = await reconcileOnDemandMuxReadiness(webinar.webinarId);
    return ok(getOnDemandWebinarPublicCatalog(webinar, readiness));
  });

  app.get("/webinars/on-demand-library/me", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    const entitlements = await listActiveOnDemandWebinarEntitlements(db, user.id);
    const ownedIds = new Set(entitlements.map((entry) => entry.webinarId));
    const catalog = await Promise.all(listPublishedOnDemandWebinars().map(async (webinar) => {
      const readiness = await reconcileOnDemandMuxReadiness(webinar.webinarId);
      const progress = ownedIds.has(webinar.webinarId)
        ? await getOnDemandWebinarProgress(db, { userId: user.id, webinarId: webinar.webinarId })
        : null;
      return {
        ...getOnDemandWebinarPublicCatalog(webinar, readiness),
        owned: ownedIds.has(webinar.webinarId),
        positionSeconds: progress?.positionSeconds ?? 0,
      };
    }));
    return ok({
      owned: catalog.filter((entry) => entry.owned),
      explore: catalog,
    });
  });

  app.get<{ Params: OnDemandParams }>("/webinars/on-demand/:webinarId/me", { preHandler: requireAuth }, async (request, reply) => {
    const webinar = getOnDemandWebinarById(request.params.webinarId);
    if (!webinar) {
      return sendApiError(reply, 404, "On-demand webinar was not found");
    }
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    const readiness = await reconcileOnDemandMuxReadiness(webinar.webinarId);
    const entitlement = await getOnDemandWebinarEntitlement(db, {
      userId: user.id,
      webinarId: webinar.webinarId,
    });
    const owned = Boolean(entitlement?.purchasedAt && !entitlement.revokedAt);
    const progress = owned
      ? await getOnDemandWebinarProgress(db, { userId: user.id, webinarId: webinar.webinarId })
      : null;
    return ok({
      ...getOnDemandWebinarPublicCatalog(webinar, readiness),
      owned,
      entitlementId: entitlement?.id ?? null,
      purchasedAt: entitlement?.purchasedAt?.toISOString() ?? null,
      positionSeconds: progress?.positionSeconds ?? 0,
    });
  });

  app.get<{ Params: OnDemandParams }>("/webinars/on-demand/:webinarId/playback", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const webinar = getOnDemandWebinarById(request.params.webinarId);
      if (!webinar) {
        return sendApiError(reply, 404, "On-demand webinar was not found");
      }
      const db = requireDatabase(app.db);
      const user = requireDbUser(request);
      const owned = await hasActiveOnDemandWebinarEntitlement(db, {
        userId: user.id,
        webinarId: webinar.webinarId,
      });
      if (!canRequestOnDemandPlayback({ owned, role: user.role })) {
        return sendApiError(reply, 403, "You do not have access to this webinar.");
      }
      const playback = await createSignedOnDemandPlayback({ webinarId: webinar.webinarId });
      reply.header("Cache-Control", "private, no-store");
      return ok({
        playbackId: playback.playbackId,
        token: playback.token,
        tokens: playback.tokens,
        expiresAt: playback.expiresAt,
      });
    } catch (error) {
      return sendApiError(reply, statusFromError(error, 500), error instanceof Error ? error.message : "Playback is unavailable");
    }
  });

  app.put<{ Params: OnDemandParams; Body: { positionSeconds?: number } }>(
    "/webinars/on-demand/:webinarId/progress",
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const webinar = getOnDemandWebinarById(request.params.webinarId);
        if (!webinar) {
          return sendApiError(reply, 404, "On-demand webinar was not found");
        }
        const db = requireDatabase(app.db);
        const user = requireDbUser(request);
        const owned = await hasActiveOnDemandWebinarEntitlement(db, {
          userId: user.id,
          webinarId: webinar.webinarId,
        });
        if (!canRequestOnDemandPlayback({ owned, role: user.role })) {
          return sendApiError(reply, 403, "You do not have access to this webinar.");
        }
        return ok(await upsertOnDemandWebinarProgress(db, {
          userId: user.id,
          webinarId: webinar.webinarId,
          positionSeconds: Number(request.body?.positionSeconds ?? 0),
        }));
      } catch (error) {
        return sendApiError(reply, statusFromError(error, 400), error instanceof Error ? error.message : "Progress could not be saved");
      }
    },
  );

  app.get("/webinars", async () => ok(listPublicWebinarCatalog()));

  app.get<{ Params: EventParams }>("/webinars/:eventId", async (request, reply) => {
    try {
      const event = getWebinarEventOrThrow(request.params.eventId);
      return ok(toPublicWebinarCatalog(event));
    } catch (error) {
      const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 404;
      return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Webinar event not found");
    }
  });

  app.get<{ Params: EventParams }>("/webinars/:eventId/me", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    return ok(await getWebinarStateForUser(db, request.dbUser!.id, request.params.eventId));
  });

  app.get<{ Params: EventParams }>("/webinars/:eventId/access", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    return ok(await getWebinarAccessForUser(db, request.dbUser!.id, request.params.eventId));
  });
}
