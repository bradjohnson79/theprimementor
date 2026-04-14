import { eq } from "drizzle-orm";
import { users, type Database } from "@wisdom/db";

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
