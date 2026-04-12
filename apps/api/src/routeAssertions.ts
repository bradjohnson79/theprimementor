import type { Database } from "@wisdom/db";
import type { FastifyRequest } from "fastify";
import { createHttpError } from "./services/booking/errors.js";

export function requireDatabase<T extends Database | null | undefined>(db: T): Database {
  if (!db) {
    throw createHttpError(503, "Database not available");
  }

  return db;
}

export function requireDbUser(request: FastifyRequest) {
  if (!request.dbUser) {
    throw createHttpError(401, "Authenticated user context is required");
  }

  return request.dbUser;
}

export function requireClerkId(request: FastifyRequest) {
  if (!request.clerkId) {
    throw createHttpError(401, "Authenticated Clerk identity is required");
  }

  return request.clerkId;
}

export function requireAdmin(request: FastifyRequest) {
  const user = requireDbUser(request);
  if (user.role !== "admin") {
    throw createHttpError(403, "Admin access required");
  }

  return user;
}

export function assertObjectAccess(
  condition: unknown,
  message: string,
  statusCode = 403,
) {
  if (!condition) {
    throw createHttpError(statusCode, message);
  }
}
