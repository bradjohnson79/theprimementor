import type { Database } from "@wisdom/db";
import type { users } from "@wisdom/db";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
  interface FastifyRequest {
    clerkId?: string;
    dbUser?: typeof users.$inferSelect;
  }
}
