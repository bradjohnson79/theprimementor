import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireClerkId, requireDatabase } from "../routeAssertions.js";
import { getClerkIdentity } from "../services/clerkIdentityService.js";
import { upsertUserFromIdentityWithResult } from "../services/userService.js";

export async function syncUserRoutes(app: FastifyInstance) {
  app.post("/sync-user", { preHandler: requireAuth }, async (request, reply) => {
    const db = requireDatabase(app.db);
    const clerkId = requireClerkId(request);

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      request.log.error("CLERK_SECRET_KEY not configured");
      return sendApiError(reply, 500, "Server configuration error");
    }

    const identity = await getClerkIdentity(secretKey, clerkId);
    const { user, created } = await upsertUserFromIdentityWithResult(db, identity);

    return ok({
      status: "synced",
      created,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  });
}
