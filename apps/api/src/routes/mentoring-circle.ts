import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import {
  getMentoringCircleStateForUser,
  registerForMentoringCircle,
} from "../services/mentoringCircleService.js";

interface RegisterBody {
  accessMode?: string;
}

export async function mentoringCircleRoutes(app: FastifyInstance) {
  app.get("/mentoring-circle/me", { preHandler: requireAuth }, async (request, reply) => {
    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    return {
      data: await getMentoringCircleStateForUser(app.db, request.dbUser!.id),
    };
  });

  app.post<{ Body: RegisterBody }>("/mentoring-circle/register", { preHandler: requireAuth }, async (request, reply) => {
    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    return {
      data: await registerForMentoringCircle(app.db, {
        userId: request.dbUser!.id,
        accessMode: request.body?.accessMode,
      }),
    };
  });
}
