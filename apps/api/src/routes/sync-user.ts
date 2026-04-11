import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { getClerkIdentity } from "../services/clerkIdentityService.js";
import { upsertUserFromIdentity } from "../services/userService.js";

export async function syncUserRoutes(app: FastifyInstance) {
  app.post("/sync-user", { preHandler: requireAuth }, async (request, reply) => {
    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    if (!request.clerkId) {
      return reply.status(401).send({ error: "Missing authenticated Clerk identity" });
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      request.log.error("CLERK_SECRET_KEY not configured");
      return reply.status(500).send({ error: "Server configuration error" });
    }

    const identity = await getClerkIdentity(secretKey, request.clerkId);
    const user = await upsertUserFromIdentity(app.db, identity);

    return reply.send({
      status: "synced",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  });
}
