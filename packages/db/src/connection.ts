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

/**
 * Transaction -> root database registry.
 *
 * Fire-and-forget side effects (e.g. `void sendNotification(tx, ...)` from the Stripe webhook)
 * can outlive the transaction they were handed. Once that transaction commits, its pooled
 * client is released, and any later query through the stale `tx` handle fails (a nested
 * `tx.transaction()` dies with Postgres 25P01 "SAVEPOINT can only be used in transaction
 * blocks") or, worse, runs on a connection that another request has since checked out.
 * `resolveRootDb(dbOrTx)` lets such side effects swap a top-level transaction handle for the
 * root pool-backed database it came from. Non-transaction handles are returned unchanged.
 */
const rootDbByTransaction = new WeakMap<object, unknown>();

export function tagTopLevelTransactions<T extends { transaction: (...args: any[]) => any }>(db: T): T {
  const originalTransaction = db.transaction.bind(db);
  (db as { transaction: unknown }).transaction = (callback: (tx: object) => unknown, config?: unknown) =>
    originalTransaction((tx: object) => {
      rootDbByTransaction.set(tx, db);
      return callback(tx);
    }, config);
  return db;
}

export function resolveRootDb<T>(db: T): T {
  if (db && typeof db === "object") {
    const root = rootDbByTransaction.get(db as object);
    if (root) {
      return root as T;
    }
  }
  return db;
}

export function createDb(databaseUrl: string) {
  if (isLocalDatabaseUrl(databaseUrl)) {
    const client = new PgPool({ connectionString: databaseUrl });
    return tagTopLevelTransactions(
      drizzlePg({ client, schema: { ...schema, ...relations } }) as unknown as ReturnType<typeof drizzleNeon>,
    );
  }

  const client = new NeonPool({ connectionString: databaseUrl });
  return tagTopLevelTransactions(drizzleNeon({ client, schema: { ...schema, ...relations } }));
}

export type Database = ReturnType<typeof createDb>;
