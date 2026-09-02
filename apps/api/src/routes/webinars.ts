import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../routeAssertions.js";
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

export async function webinarRoutes(app: FastifyInstance) {
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
