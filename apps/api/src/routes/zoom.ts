import type { FastifyInstance } from "fastify";
import { logger } from "@wisdom/utils";
import { requireAuth } from "../middleware/auth.js";
import { createZoomMeeting } from "../services/zoomService.js";

export async function zoomRoutes(app: FastifyInstance) {
  app.get("/test/zoom-status", { preHandler: requireAuth }, async (request, reply) => {
    if (process.env.NODE_ENV === "production") {
      const error = new Error("Test route disabled in production") as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }

    if (request.dbUser?.role !== "admin") {
      return reply.status(403).send({ error: "Admin access required" });
    }

    return {
      data: {
        env: {
          accountId: Boolean(process.env.ZOOM_ACCOUNT_ID?.trim()),
          clientId: Boolean(process.env.ZOOM_CLIENT_ID?.trim()),
          clientSecret: Boolean(process.env.ZOOM_CLIENT_SECRET?.trim()),
        },
      },
    };
  });

  app.post("/test/zoom-meeting", { preHandler: requireAuth }, async (request, reply) => {
    if (process.env.NODE_ENV === "production") {
      const error = new Error("Test route disabled in production") as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }

    if (request.dbUser?.role !== "admin") {
      return reply.status(403).send({ error: "Admin access required" });
    }

    try {
      const meeting = await createZoomMeeting({
        topic: "Test Session",
        startTime: new Date().toISOString(),
        duration: 60,
        timezone: "UTC",
      });
      logger.debug("zoom_test_meeting_created", {
        joinUrlPresent: Boolean(meeting.joinUrl),
        startUrlPresent: Boolean(meeting.startUrl),
      });

      return { data: meeting };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Zoom test failed";
      logger.error("zoom_test_meeting_failed", {
        message,
      });

      return reply.status(500).send({
        error: true,
        message,
      });
    }
  });
}
