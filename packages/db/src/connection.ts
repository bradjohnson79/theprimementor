import { neonConfig, Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import ws from "ws";
import * as schema from "./schema.js";
import * as relations from "./relations.js";

neonConfig.webSocketConstructor = ws;

/**
 * Guest-checkout local testing (additive, production-safe): the Neon serverless/websocket
 * driver cannot talk to a plain local Postgres server. When DATABASE_URL points at
 * localhost/127.0.0.1 (i.e. a local dev/test database, never Neon), use the standard
 * drizzle-orm/node-postgres + pg driver instead. Any other host (including every production
 * Neon URL) is completely unaffected and keeps using the existing Neon driver.
 */
function isLocalDatabaseUrl(databaseUrl: string): boolean {
  try {
    const { hostname } = new URL(databaseUrl);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function createDb(databaseUrl: string) {
  if (isLocalDatabaseUrl(databaseUrl)) {
    const client = new PgPool({ connectionString: databaseUrl });
    return drizzlePg({ client, schema: { ...schema, ...relations } }) as unknown as ReturnType<typeof drizzleNeon>;
  }

  const client = new NeonPool({ connectionString: databaseUrl });
  return drizzleNeon({ client, schema: { ...schema, ...relations } });
}

export type Database = ReturnType<typeof createDb>;
