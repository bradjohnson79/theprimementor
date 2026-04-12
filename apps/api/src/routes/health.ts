import type { FastifyInstance } from "fastify";
import { ok } from "../apiContract.js";
import { getSwissEphemerisHealth } from "../services/blueprint/swissEphemerisService.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return ok({ status: "ok" });
  });

  app.get("/health/ephemeris", async () => {
    const health = getSwissEphemerisHealth();
    return ok({
      status: health.initialized ? "ok" : "error",
      ephemeris: health,
    });
  });
}
