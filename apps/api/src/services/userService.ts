import { eq } from "drizzle-orm";
import { users, type Database } from "@wisdom/db";
import { tryClaimGuestUserInPlace } from "./guest/guestIdentity.js";
import { assertGuestSchemaReady } from "./guest/guestSchemaGuard.js";
import { logger } from "@wisdom/utils";

interface CreateUserInput {
  clerkId: string;
  email: string;
}

export async function findOrCreateUser(db: Database, input: CreateUserInput) {
  const [existingBeforeUpsert] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerk_id, input.clerkId))
    .limit(1);

  // Guest checkout (additive): the first time we ever see this real Clerk identity, check
  // whether a guest placeholder already exists for the same email and claim it in place
  // (same user.id — every booking/report/order already attached stays attached with zero
  // re-parenting). Fails open (falls through to the normal upsert) if the guest-checkout
  // migration hasn't been applied in this environment yet, so signed-in sign-up/sign-in is
  // never blocked by guest checkout being unavailable.
  if (!existingBeforeUpsert) {
    try {
      await assertGuestSchemaReady(db);
      const claimed = await tryClaimGuestUserInPlace(db, { clerkId: input.clerkId, email: input.email });
      if (claimed) {
        return { user: claimed, created: false };
      }
    } catch (error) {
      logger.warn("guest_claim_check_skipped", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  const [user] = await db
    .insert(users)
    .values({
      clerk_id: input.clerkId,
      email: input.email,
    })
    .onConflictDoUpdate({
      target: users.clerk_id,
      set: {
        email: input.email,
      },
    })
    .returning();

  if (user) {
    return {
      user,
      created: !existingBeforeUpsert,
    };
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.clerk_id, input.clerkId))
    .limit(1);

  if (!existing) {
    throw new Error(`Unable to upsert Clerk user ${input.clerkId}`);
  }

  return {
    user: existing,
    created: !existingBeforeUpsert,
  };
}

export async function upsertUserFromIdentityWithResult(db: Database, input: CreateUserInput) {
  return findOrCreateUser(db, input);
}

export async function upsertUserFromIdentity(db: Database, input: CreateUserInput) {
  const result = await findOrCreateUser(db, input);
  return result.user;
}
