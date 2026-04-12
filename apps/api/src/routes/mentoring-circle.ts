import type { FastifyInstance } from "fastify";
import { ok } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../routeAssertions.js";
import {
  getMentoringCircleStateForUser,
  registerForMentoringCircle,
} from "../services/mentoringCircleService.js";

interface RegisterBody {
  eventId?: string;
}

export async function mentoringCircleRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { eventId?: string } }>("/mentoring-circle/me", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    return ok({
      data: await getMentoringCircleStateForUser(db, request.dbUser!.id, request.query?.eventId),
    });
  });

  app.post<{ Body: RegisterBody }>("/mentoring-circle/register", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    return ok({
      data: await registerForMentoringCircle(db, {
        userId: request.dbUser!.id,
        eventId: request.body?.eventId,
      }),
    });
  });
}
