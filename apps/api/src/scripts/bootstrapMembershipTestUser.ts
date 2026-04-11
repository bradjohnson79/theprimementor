import "dotenv/config";
import { createClerkClient } from "@clerk/backend";
import { createDb } from "@wisdom/db";
import { resolvePrimaryEmail } from "../services/clerkIdentityService.js";
import { upsertUserFromIdentity } from "../services/userService.js";

const DEFAULT_EMAIL = "info@aetherx.co";
const DEFAULT_PASSWORD = "sample123";

async function main() {
  const email = (process.argv[2] || DEFAULT_EMAIL).trim().toLowerCase();
  const password = (process.argv[3] || DEFAULT_PASSWORD).trim();
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is required.");
  }
  if (secretKey.startsWith("sk_live_")) {
    throw new Error("Refusing to inspect or bootstrap a membership test user with a live Clerk secret.");
  }

  const clerk = createClerkClient({ secretKey });
  const result = await (clerk.users as unknown as {
    getUserList: (params: { emailAddress: string[]; limit: number }) => Promise<{ data?: Array<{
      id: string;
      primaryEmailAddressId?: string | null;
      emailAddresses?: Array<{ id: string; emailAddress: string }>;
    }> } | Array<{
      id: string;
      primaryEmailAddressId?: string | null;
      emailAddresses?: Array<{ id: string; emailAddress: string }>;
    }>>;
  }).getUserList({
    emailAddress: [email],
    limit: 1,
  });

  const clerkUser = Array.isArray(result)
    ? result[0]
    : Array.isArray(result?.data)
      ? result.data[0]
      : undefined;

  if (!clerkUser) {
    console.error(`No Clerk user found for ${email}.`);
    console.error("Create the user in the Clerk development dashboard, then rerun this script.");
    console.error(`Recommended password for local QA: ${password}`);
    process.exit(1);
  }

  const primaryEmail = resolvePrimaryEmail({
    primaryEmailAddressId: clerkUser.primaryEmailAddressId ?? null,
    emailAddresses: clerkUser.emailAddresses ?? [],
  });

  if (!primaryEmail) {
    throw new Error(`Clerk user ${clerkUser.id} has no primary email.`);
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.warn("DATABASE_URL is not configured. Clerk user exists, but no local DB row was synced.");
    return;
  }

  const db = createDb(databaseUrl);
  const user = await upsertUserFromIdentity(db, {
    clerkId: clerkUser.id,
    email: primaryEmail,
  });

  console.log("Membership test user is ready.");
  console.log(JSON.stringify({
    email: primaryEmail,
    clerkId: clerkUser.id,
    localUserId: user.id,
    role: user.role,
    nextStep: "Sign in via the web app and complete the Stripe test checkout flow.",
  }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
