import type { Database } from "@wisdom/db";
import type { users } from "@wisdom/db";

declare module "fastify" {
  interface ApiRouteInventoryEntry {
    method: string;
    url: string;
  }
  interface FastifyInstance {
    db: Database;
    routeInventory: ApiRouteInventoryEntry[];
  }
  interface FastifyRequest {
    clerkId?: string;
    dbUser?: typeof users.$inferSelect;
  }
}
