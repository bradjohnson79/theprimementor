import { sql } from "drizzle-orm";
import type { Database } from "@wisdom/db";
import { createHttpError } from "../booking/errors.js";

let cachedReady: boolean | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

/**
 * Guest checkout depends on an additive migration (users.is_guest / users.guest_claimed_at +
 * the guest_order_access_tokens / guest_claim_audit tables). If that migration has not been
 * applied yet in a given environment (e.g. production before the deploy step that runs it),
 * guest endpoints must fail safe with a clear 503 rather than throwing an opaque DB error —
 * and existing signed-in flows, which never touch these columns/tables, are completely
 * unaffected either way.
 */
export async function assertGuestSchemaReady(db: Database): Promise<void> {
  const now = Date.now();
  if (cachedReady === true && now - cachedAt < CACHE_TTL_MS) {
    return;
  }

  const result = await db.execute(sql<{ present: boolean }>`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_guest'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'guest_order_access_tokens'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'guest_claim_audit'
      ) AS present
  `);

  const present = Boolean((result.rows as Array<{ present: boolean }>)[0]?.present);
  cachedReady = present;
  cachedAt = now;

  if (!present) {
    throw createHttpError(
      503,
      "Guest checkout is not available yet on this server (database migration pending). Please sign in or sign up to continue, or try again shortly.",
    );
  }
}
