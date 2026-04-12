import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken } from "@clerk/backend";
import { eq } from "drizzle-orm";
import { users } from "@wisdom/db";
import { getClerkIdentity } from "../services/clerkIdentityService.js";
import { upsertUserFromIdentity } from "../services/userService.js";
import { sendApiError } from "../apiContract.js";
import { requireDatabase } from "../routeAssertions.js";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return sendApiError(reply, 401, "Missing or invalid Authorization header");
  }

  const token = authHeader.slice(7);
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    request.log.error("CLERK_SECRET_KEY not configured");
    return sendApiError(reply, 500, "Server configuration error");
  }

  const db = requireDatabase(request.server.db);

  try {
    const decoded = await verifyToken(token, { secretKey });
    const clerkId = decoded.sub;

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.clerk_id, clerkId))
      .limit(1);

    const ensuredUser = dbUser
      ?? await (async () => {
        try {
          const identity = await getClerkIdentity(secretKey, clerkId);
          return await upsertUserFromIdentity(db, identity);
        } catch (syncError) {
          request.log.error(syncError, "Unable to sync Clerk user into database");
          return null;
        }
      })();

    if (!ensuredUser) {
      return sendApiError(reply, 503, "Unable to sync authenticated user");
    }

    request.clerkId = clerkId;
    request.dbUser = ensuredUser;
  } catch (err) {
    request.log.error(err, "Token verification failed");
    return sendApiError(reply, 401, "Invalid token");
  }
}
