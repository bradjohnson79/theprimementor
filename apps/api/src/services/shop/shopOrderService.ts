import { eq } from "drizzle-orm";
import { orders, shopEntitlements, shopProducts, type Database } from "@wisdom/db";
import { createHttpError } from "../booking/errors.js";
import { getShopEntitlementById, markShopEntitlementPurchased } from "./shopEntitlementService.js";

export async function ensurePersistedShopOrder(
  db: Database,
  input: {
    userId: string;
    entitlementId: string;
    productId: string;
    amountCents: number;
    currency: string;
    paymentReference: string;
    stripePaymentIntentId?: string | null;
    stripeCheckoutSessionId?: string | null;
  },
) {
  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.payment_reference, input.paymentReference))
    .limit(1);
  if (existing) {
    return existing;
  }

  const [product] = await db
    .select()
    .from(shopProducts)
    .where(eq(shopProducts.id, input.productId))
    .limit(1);
  if (!product) {
    throw createHttpError(404, "Shop product was not found for order persistence.");
  }

  const [created] = await db
    .insert(orders)
    .values({
      user_id: input.userId,
      type: "shop",
      label: product.name,
      amount: input.amountCents,
      currency: input.currency,
      status: "completed",
      payment_reference: input.paymentReference,
      stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
      metadata: {
        source: "shop_purchase",
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        product_name: product.name,
        entitlementId: input.entitlementId,
        stripePriceId: product.stripe_price_id,
        stripeProductId: product.stripe_product_id,
        stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
      },
    })
    .onConflictDoNothing()
    .returning();

  const order = created ?? (await db.select().from(orders).where(eq(orders.payment_reference, input.paymentReference)).limit(1))[0];
  if (!order) {
    throw createHttpError(500, "Shop order could not be persisted.");
  }

  await db
    .update(shopEntitlements)
    .set({ order_id: order.id, updated_at: new Date() })
    .where(eq(shopEntitlements.id, input.entitlementId));

  return order;
}

export async function fulfillShopPurchase(
  db: Database,
  input: {
    entitlementId: string;
    userId: string;
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    amountCents: number;
    currency: string;
  },
) {
  const entitlement = await getShopEntitlementById(db, input.entitlementId);
  if (!entitlement) {
    throw createHttpError(404, "Shop entitlement was not found.");
  }

  const paymentReference = input.stripePaymentIntentId
    || input.stripeCheckoutSessionId
    || `shop_${entitlement.id}`;

  await markShopEntitlementPurchased(db, {
    entitlementId: entitlement.id,
    userId: input.userId,
    productId: entitlement.productId,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId,
    stripePaymentIntentId: input.stripePaymentIntentId,
  });

  return ensurePersistedShopOrder(db, {
    userId: input.userId,
    entitlementId: entitlement.id,
    productId: entitlement.productId,
    amountCents: input.amountCents,
    currency: input.currency,
    paymentReference,
    stripePaymentIntentId: input.stripePaymentIntentId,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId,
  });
}
