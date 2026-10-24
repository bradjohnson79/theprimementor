import { and, eq } from "drizzle-orm";
import {
  bookingIntakeImages,
  bookings,
  courseEntitlements,
  guestClaimAudit,
  invoices,
  mentorTrainingOrders,
  memberEntitlements,
  orders,
  payments,
  regenerationSubscriptions,
  reports,
  shopEntitlements,
  subscriptions,
  users,
  webinarRecordingEntitlements,
  type Database,
} from "@wisdom/db";
import { logger } from "@wisdom/utils";
import { createHttpError } from "../booking/errors.js";
import { normalizeGuestEmail } from "./guestIdentity.js";
import { issueOrderAccessToken, verifyOrderAccessToken, revokeOrderAccessToken } from "./orderAccessTokenService.js";
import { sendLinkPurchaseVerificationEmail } from "./guestNotify.js";

/**
 * "Different email" cross-account merge: a signed-in (real) user asks to link a guest purchase
 * that was made under a DIFFERENT email address. We never reveal whether that email has
 * anything on file in the request/response — only the verification email (sent to the
 * candidate guest email, not the requester) can confirm/deny that.
 */
export async function requestLinkPurchaseByEmail(
  db: Database,
  input: { targetUserId: string; claimEmail: string },
): Promise<void> {
  const email = normalizeGuestEmail(input.claimEmail);

  const [guestRow] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.email, email), eq(users.is_guest, true)))
    .limit(1);

  if (!guestRow) {
    // Same response either way at the route layer — just don't send anything.
    return;
  }

  const { token } = await issueOrderAccessToken(db, {
    userId: guestRow.id,
    email,
    purpose: "email_verify_merge",
    metadata: { targetUserId: input.targetUserId },
  });

  const verifyUrl = `${(process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/account/link-purchase/confirm?token=${encodeURIComponent(token)}`;
  await sendLinkPurchaseVerificationEmail({ to: email, verifyUrl });
}

/** Bounded, user_id-keyed tables re-parented on cross-account merge. Documented in REPORT.md. */
const REPARENT_TABLES = [
  { table: bookings, column: bookings.user_id, name: "bookings" },
  { table: reports, column: reports.user_id, name: "reports" },
  { table: orders, column: orders.user_id, name: "orders" },
  { table: payments, column: payments.user_id, name: "payments" },
  { table: subscriptions, column: subscriptions.user_id, name: "subscriptions" },
  { table: regenerationSubscriptions, column: regenerationSubscriptions.user_id, name: "regeneration_subscriptions" },
  { table: shopEntitlements, column: shopEntitlements.user_id, name: "shop_entitlements" },
  { table: memberEntitlements, column: memberEntitlements.user_id, name: "member_entitlements" },
  { table: webinarRecordingEntitlements, column: webinarRecordingEntitlements.user_id, name: "webinar_recording_entitlements" },
  { table: courseEntitlements, column: courseEntitlements.user_id, name: "course_entitlements" },
  { table: mentorTrainingOrders, column: mentorTrainingOrders.user_id, name: "mentor_training_orders" },
  { table: invoices, column: invoices.user_id, name: "invoices" },
  // Intake photos uploaded on the guest pay-first intake form travel with their booking.
  { table: bookingIntakeImages, column: bookingIntakeImages.user_id, name: "booking_intake_images" },
] as const;

export interface ConfirmLinkPurchaseResult {
  alreadyMerged: boolean;
  reparentedTables: string[];
  guestUserId: string;
  targetUserId: string;
}

/**
 * Confirms a one-time email_verify_merge token and re-parents the bounded list of
 * user_id-keyed tables from the guest placeholder to the target (real) account, idempotently:
 * if a guest_claim_audit row already exists for this guest_user_id with
 * action='cross_account_merge', this is a no-op (safe to click an old link twice). Does not
 * touch stripe_customers (unique per user_id — the target keeps/gets its own) or clerk_id (the
 * guest row is left in place, just empty of purchases, for traceability).
 */
export async function confirmLinkPurchaseByEmail(db: Database, rawToken: string): Promise<ConfirmLinkPurchaseResult> {
  const verified = await verifyOrderAccessToken(db, rawToken, "email_verify_merge");
  const targetUserId = typeof verified.metadata?.targetUserId === "string" ? verified.metadata.targetUserId : null;
  if (!targetUserId) {
    throw createHttpError(400, "This link is missing required information.");
  }

  const guestUserId = verified.userId;

  const existingAudit = await db
    .select({ id: guestClaimAudit.id })
    .from(guestClaimAudit)
    .where(and(eq(guestClaimAudit.guest_user_id, guestUserId), eq(guestClaimAudit.action, "cross_account_merge")))
    .limit(1);

  await revokeOrderAccessToken(db, verified.tokenRowId);

  if (existingAudit.length > 0) {
    return { alreadyMerged: true, reparentedTables: [], guestUserId, targetUserId };
  }

  const reparentedTables: string[] = [];
  const skippedTables: string[] = [];
  for (const entry of REPARENT_TABLES) {
    try {
      const result = await db
        .update(entry.table)
        .set({ user_id: targetUserId } as never)
        .where(eq(entry.column, guestUserId))
        .returning({ id: entry.column });
      if (result.length > 0) {
        reparentedTables.push(entry.name);
      }
    } catch (error) {
      // A unique constraint on (user_id, ...) can collide if the target account already owns
      // the same entitlement/course/package under its own row. Rather than aborting the whole
      // merge, skip that table and leave those specific rows on the (now-orphaned) guest row —
      // logged for manual follow-up. This only affects the rare "bought the same thing twice
      // under two emails" case.
      skippedTables.push(entry.name);
      logger.warn("guest_cross_account_merge_table_skipped", {
        table: entry.name,
        guestUserId,
        targetUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await db.insert(guestClaimAudit).values({
    guest_user_id: guestUserId,
    target_user_id: targetUserId,
    action: "cross_account_merge",
    matched_email: verified.email,
    metadata: { reparentedTables, skippedTables },
  });

  logger.info("guest_cross_account_merge_completed", { guestUserId, targetUserId, reparentedTables, skippedTables });

  return { alreadyMerged: false, reparentedTables, guestUserId, targetUserId };
}
