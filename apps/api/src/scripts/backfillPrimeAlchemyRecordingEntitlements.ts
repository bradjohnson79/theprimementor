/**
 * Grants complimentary on-demand recording access to paid Prime Alchemy live buyers
 * who purchased before grantsComplimentaryRecording was enabled.
 *
 * Entitlements are stored under the live event id (`prime-alchemy-teachings`).
 * The on-demand catalog entry includes that id via `includedWithEventId`.
 *
 * Usage:
 *   cd apps/api && npx tsx src/scripts/backfillPrimeAlchemyRecordingEntitlements.ts --dry-run
 *   cd apps/api && npx tsx src/scripts/backfillPrimeAlchemyRecordingEntitlements.ts
 */
import "dotenv/config";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { bookings, createDb, webinarRecordingEntitlements } from "@wisdom/db";
import { PRIME_ALCHEMY_WEBINAR_EVENT_ID } from "@wisdom/utils";
import { grantComplimentaryWebinarRecording } from "../services/webinarEventService.js";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const db = createDb(databaseUrl);
  const paidBookings = await db
    .select({
      id: bookings.id,
      userId: bookings.user_id,
      status: bookings.status,
      email: bookings.email,
    })
    .from(bookings)
    .where(and(
      eq(bookings.event_key, PRIME_ALCHEMY_WEBINAR_EVENT_ID),
      inArray(bookings.status, ["paid", "scheduled", "completed"]),
    ));

  const existing = await db
    .select({
      userId: webinarRecordingEntitlements.user_id,
    })
    .from(webinarRecordingEntitlements)
    .where(and(
      eq(webinarRecordingEntitlements.webinar_id, PRIME_ALCHEMY_WEBINAR_EVENT_ID),
      isNull(webinarRecordingEntitlements.revoked_at),
    ));
  const alreadyGranted = new Set(existing.map((row) => row.userId));

  const uniqueUserIds = [...new Set(paidBookings.map((row) => row.userId))];
  const toGrant = uniqueUserIds.filter((userId) => !alreadyGranted.has(userId));

  console.log(JSON.stringify({
    eventId: PRIME_ALCHEMY_WEBINAR_EVENT_ID,
    paidBookings: paidBookings.length,
    uniqueBuyers: uniqueUserIds.length,
    alreadyGranted: alreadyGranted.size,
    toGrant: toGrant.length,
    dryRun,
  }));

  if (dryRun || toGrant.length === 0) {
    return;
  }

  let granted = 0;
  for (const userId of toGrant) {
    await grantComplimentaryWebinarRecording(db, {
      userId,
      webinarId: PRIME_ALCHEMY_WEBINAR_EVENT_ID,
    });
    granted += 1;
  }

  console.log(JSON.stringify({ granted }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
