import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { guestClaimAudit, users, type Database } from "@wisdom/db";
import { createHttpError } from "../booking/errors.js";

export const GUEST_CLERK_ID_PREFIX = "guest_";

export interface GuestUserRow {
  id: string;
  clerk_id: string;
  email: string;
  phone: string | null;
  role: string;
  is_guest: boolean;
  guest_claimed_at: Date | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeGuestEmail(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!value || !EMAIL_RE.test(value)) {
    throw createHttpError(400, "A valid email address is required.");
  }
  return value;
}

export function isGuestClerkId(clerkId: string | null | undefined): boolean {
  return Boolean(clerkId?.startsWith(GUEST_CLERK_ID_PREFIX));
}

async function findUserByNormalizedEmail(
  db: Database,
  email: string,
  filterGuest?: boolean,
): Promise<GuestUserRow | null> {
  const conditions = [sql`lower(${users.email}) = ${email}`];
  if (filterGuest !== undefined) {
    conditions.push(eq(users.is_guest, filterGuest));
  }
  const [row] = await db
    .select()
    .from(users)
    .where(and(...conditions))
    .orderBy(users.created_at)
    .limit(1);
  return (row as GuestUserRow) ?? null;
}

/**
 * Read-only lookup for a normalized email: returns a real account first, else an existing
 * guest placeholder, else null. NEVER creates a row. Use this for endpoints (like "resend my
 * links") that must not create a dangling guest user just because someone typed/typo'd an
 * email address that has never purchased anything.
 */
export async function findExistingGuestOrRealUser(
  db: Database,
  input: { email: string },
): Promise<{ user: GuestUserRow; attachedToExistingAccount: boolean } | null> {
  const email = normalizeGuestEmail(input.email);
  const realAccount = await findUserByNormalizedEmail(db, email, false);
  if (realAccount) {
    return { user: realAccount, attachedToExistingAccount: true };
  }
  const existingGuest = await findUserByNormalizedEmail(db, email, true);
  if (existingGuest) {
    return { user: existingGuest, attachedToExistingAccount: false };
  }
  return null;
}

export interface ResolveOrCreateGuestUserResult {
  user: GuestUserRow;
  /** True only when a brand-new guest placeholder row was created by this call. */
  isNewGuest: boolean;
  /** True when the email silently matched an existing REAL (non-guest) account. */
  attachedToExistingAccount: boolean;
}

/**
 * Resolves the user row a guest checkout should attach to, in priority order:
 *   1. An existing REAL account with this email (purchase silently attaches to it — we never
 *      reveal to the guest that an account already exists; they're simply told by email to
 *      sign in to see it).
 *   2. An existing guest placeholder with this email (reused, no duplicate guest rows).
 *   3. A brand-new guest placeholder row, with a unique synthetic clerk_id of the form
 *      "guest_<uuid>" (satisfies the existing NOT NULL UNIQUE constraint on clerk_id without
 *      ever touching that column's shape).
 */
export async function resolveOrCreateGuestUser(
  db: Database,
  input: { email: string; name?: string | null },
): Promise<ResolveOrCreateGuestUserResult> {
  const email = normalizeGuestEmail(input.email);

  const realAccount = await findUserByNormalizedEmail(db, email, false);
  if (realAccount) {
    return { user: realAccount, isNewGuest: false, attachedToExistingAccount: true };
  }

  const existingGuest = await findUserByNormalizedEmail(db, email, true);
  if (existingGuest) {
    return { user: existingGuest, isNewGuest: false, attachedToExistingAccount: false };
  }

  const clerkId = `${GUEST_CLERK_ID_PREFIX}${randomUUID()}`;
  const [created] = await db
    .insert(users)
    .values({
      clerk_id: clerkId,
      email,
      role: "client",
      is_guest: true,
    })
    .onConflictDoNothing({ target: users.clerk_id })
    .returning();

  if (created) {
    return { user: created as GuestUserRow, isNewGuest: true, attachedToExistingAccount: false };
  }

  // Extremely unlikely race (same email created concurrently) — re-read instead of failing.
  const raced = await findUserByNormalizedEmail(db, email);
  if (!raced) {
    throw createHttpError(500, "Could not resolve a guest account for this email. Please try again.");
  }
  return { user: raced, isNewGuest: false, attachedToExistingAccount: !raced.is_guest };
}

/**
 * In-place claim: called from the real Clerk user-sync path the first time a brand-new Clerk
 * identity is seen. If a guest placeholder already exists for the same normalized email, its
 * clerk_id is rewritten to the real Clerk id IN PLACE (same user.id, same row) and the guest
 * flag cleared — every booking/report/order/entitlement already attached to that user.id stays
 * attached with zero re-parenting. Returns null when there is no guest placeholder to claim
 * (the normal brand-new-user path should run instead).
 */
export async function tryClaimGuestUserInPlace(
  db: Database,
  input: { clerkId: string; email: string },
): Promise<GuestUserRow | null> {
  if (isGuestClerkId(input.clerkId)) {
    // Real Clerk identities are never prefixed "guest_" — defensive guard only.
    return null;
  }
  const email = (input.email || "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return null;
  }

  const guestRow = await findUserByNormalizedEmail(db, email, true);
  if (!guestRow) {
    return null;
  }

  const [claimed] = await db
    .update(users)
    .set({
      clerk_id: input.clerkId,
      email,
      is_guest: false,
      guest_claimed_at: new Date(),
      updated_at: new Date(),
    })
    .where(and(eq(users.id, guestRow.id), eq(users.is_guest, true)))
    .returning();

  if (!claimed) {
    // Lost the race to another concurrent claim/signup — fall back to normal upsert path.
    return null;
  }

  await db.insert(guestClaimAudit).values({
    guest_user_id: claimed.id,
    target_user_id: claimed.id,
    action: "in_place_claim",
    matched_email: email,
    real_clerk_id: input.clerkId,
    metadata: { previousGuestClerkId: guestRow.clerk_id },
  });

  return claimed as GuestUserRow;
}
