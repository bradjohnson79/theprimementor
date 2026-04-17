import type { FastifyInstance, FastifyRequest } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../routeAssertions.js";
import {
  getMentoringCircleStateForUser,
  registerForMentoringCircle,
  runMentoringCircleReminderJob,
} from "../services/mentoringCircleService.js";
import { createHttpError } from "../services/booking/errors.js";

interface RegisterBody {
  eventId?: string;
}

function assertInternalWeeklySeoAccess(request: FastifyRequest) {
  const configuredSecrets = [
    process.env.MENTORING_CIRCLE_CRON_SECRET?.trim(),
    process.env.CRON_SECRET?.trim(),
    process.env.INTERNAL_API_SECRET?.trim(),
  ].filter((value): value is string => Boolean(value));

  if (configuredSecrets.length === 0) {
    throw createHttpError(503, "Mentoring Circle reminder route secret is not configured");
  }

  const secretHeader = request.headers["x-cron-secret"];
  const bearerHeader = request.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
  const providedSecret = typeof secretHeader === "string" && secretHeader.trim()
    ? secretHeader.trim()
    : bearerHeader || "";

  if (!providedSecret || !configuredSecrets.includes(providedSecret)) {
    throw createHttpError(401, "Internal Mentoring Circle route authentication failed");
  }
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

  app.post(
    "/internal/mentoring-circle/reminders",
    {
      config: {
        rateLimit: {
          max: 6,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      try {
        assertInternalWeeklySeoAccess(request);
        const db = requireDatabase(app.db);
        return ok({
          data: await runMentoringCircleReminderJob(db),
        });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 500;
        return sendApiError(
          reply,
          statusCode,
          error instanceof Error ? error.message : "Failed to run Mentoring Circle reminders",
        );
      }
    },
  );
}
