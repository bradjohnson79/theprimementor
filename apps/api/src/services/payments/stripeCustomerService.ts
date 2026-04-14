import Stripe from "stripe";
import { stripeCustomers, type Database } from "@wisdom/db";
import { eq } from "drizzle-orm";

type DbExecutor = Pick<Database, "select" | "insert">;

async function getExistingStripeCustomerId(db: DbExecutor, userId: string) {
  const [mapping] = await db
    .select({ stripeCustomerId: stripeCustomers.stripe_customer_id })
    .from(stripeCustomers)
    .where(eq(stripeCustomers.user_id, userId))
    .limit(1);

  return mapping?.stripeCustomerId ?? null;
}

async function upsertStripeCustomerId(
  db: DbExecutor,
  userId: string,
  stripeCustomerId: string,
) {
  await db
    .insert(stripeCustomers)
    .values({
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
    })
    .onConflictDoUpdate({
      target: stripeCustomers.user_id,
      set: {
        stripe_customer_id: stripeCustomerId,
      },
    });
}

function isMissingStripeCustomerError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown; type?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const type = typeof candidate.type === "string" ? candidate.type : "";
  const message = typeof candidate.message === "string" ? candidate.message : "";

  return code === "resource_missing"
    || (type === "StripeInvalidRequestError" && message.includes("No such customer"));
}

export async function ensureStripeCustomerId(
  db: DbExecutor,
  input: {
    stripe: Stripe;
    userId: string;
    email: string;
    name?: string | null;
    metadata?: Record<string, string>;
  },
) {
  const existing = await getExistingStripeCustomerId(db, input.userId);
  if (existing) {
    try {
      const customer = await input.stripe.customers.retrieve(existing);
      if (!("deleted" in customer) || customer.deleted !== true) {
        return existing;
      }
    } catch (error) {
      if (!isMissingStripeCustomerError(error)) {
        throw error;
      }
    }
  }

  const created = await input.stripe.customers.create({
    email: input.email,
    ...(input.name?.trim() ? { name: input.name.trim() } : {}),
    metadata: input.metadata ?? {
      userId: input.userId,
    },
  });

  await upsertStripeCustomerId(db, input.userId, created.id);
  return created.id;
}
