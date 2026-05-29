import type { FastifyInstance } from "fastify";
import { ok } from "../apiContract.js";
import { detectTimezoneFromHeaders } from "../services/timezoneDetectionService.js";

export async function timezoneRoutes(app: FastifyInstance) {
  app.get("/timezone/detect", async (request) => ok({
    data: detectTimezoneFromHeaders(request.headers),
  }));
}
