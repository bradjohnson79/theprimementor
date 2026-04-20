/**
 * Grants Seeker membership without Stripe (demo / QA).
 * Inserts a synthetic active subscription + member_entitlements row.
 *
 * Membership in the app is resolved by Clerk → users.clerk_id, not by email alone.
 * If multiple DB users share an email, you must pass --clerk-id (from Clerk: user_…).
 *
 * Usage:
 *   cd apps/api && npx tsx src/scripts/grantSeekerDemoByEmail.ts info@anoint.me
 *   cd apps/api && npx tsx src/scripts/grantSeekerDemoByEmail.ts --clerk-id=user_2abc...
 */
import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { createDb, subscriptions, users } from "@wisdom/db";
import { upsertMemberEntitlementSnapshot } from "../services/divin8/entitlementService.js";

function parseArgs(argv: string[]) {
  let clerkId: string | undefined;
  const positionals: string[] = [];
  for (const a of argv.slice(2)) {
    if (a.startsWith("--clerk-id=")) {
      clerkId = a.slice("--clerk-id=".length).trim();
    } else if (!a.startsWith("-")) {
      positionals.push(a);
    }
  }
  const email = positionals[0]?.trim().toLowerCase();
  return { clerkId, email };
}

function demoStripeIds(userId: string) {
  const suffix = userId.replace(/-/g, "");
  return {
    stripeSubscriptionId: `sub_internal_demo_seeker_${suffix}`,
    stripeCustomerId: `cus_internal_demo_${suffix}`,
  };
}

async function main() {
  const { clerkId, email } = parseArgs(process.argv);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  if (!clerkId && !email) {
    throw new Error("Provide an email (positional) or --clerk-id=user_…");
  }

  const db = createDb(databaseUrl);

  let user: { id: string; email: string; clerk_id: string };

  if (clerkId) {
    const [row] = await db
      .select({ id: users.id, email: users.email, clerk_id: users.clerk_id })
      .from(users)
      .where(eq(users.clerk_id, clerkId))
      .limit(1);
    if (!row) {
      console.error(`No user row for clerk_id: ${clerkId}`);
      process.exit(1);
    }
    user = row;
  } else {
    const matches = await db
      .select({ id: users.id, email: users.email, clerk_id: users.clerk_id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email!}`);

    if (matches.length === 0) {
      console.error(`No user row found for email: ${email}`);
      process.exit(1);
    }
    if (matches.length > 1) {
      console.error(
        `Multiple users share email ${email}. Pass the Clerk user id for the account you log in with:\n` +
          matches.map((m) => `  --clerk-id=${m.clerk_id}  (db id ${m.id})`).join("\n"),
      );
      process.exit(1);
    }
    user = matches[0]!;
  }

  const { stripeSubscriptionId, stripeCustomerId } = demoStripeIds(user.id);

  const periodStart = new Date();
  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 10);

  const metadata = {
    billingInterval: "monthly" as const,
    currentPeriodStart: periodStart.toISOString(),
    demoGrant: true,
    note: "Manual demo Seeker grant (no live Stripe payment)",
  };

  await db
    .insert(subscriptions)
    .values({
      user_id: user.id,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id: stripeCustomerId,
      tier: "seeker",
      status: "active",
      cancel_at_period_end: false,
      current_period_end: periodEnd,
      metadata,
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: subscriptions.stripe_subscription_id,
      set: {
        user_id: user.id,
        tier: "seeker",
        status: "active",
        cancel_at_period_end: false,
        current_period_end: periodEnd,
        metadata,
        updated_at: new Date(),
      },
    });

  await upsertMemberEntitlementSnapshot(db, {
    userId: user.id,
    stripeSubscriptionId: stripeSubscriptionId,
    tier: "seeker",
    billingInterval: "monthly",
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: user.email,
        clerk_id: user.clerk_id,
        userId: user.id,
        stripeSubscriptionId,
        tier: "seeker",
        billingInterval: "monthly",
        currentPeriodEnd: periodEnd.toISOString(),
        hint:
          "If the site still shows Free: confirm DATABASE_URL is the same DB the production API uses, " +
            "and that you passed the clerk_id for the account you are logged into (see Clerk Dashboard → Users).",
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
