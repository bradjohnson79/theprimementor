import { and, eq } from "drizzle-orm";
import { shopEntitlements, shopProductFiles, shopProducts, type Database } from "@wisdom/db";
import { createHttpError } from "../booking/errors.js";
import { getShopProductById, isPurchasableShopProduct } from "./shopCatalog.js";

export interface ShopEntitlementSummary {
  id: string;
  userId: string;
  productId: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  orderId: string | null;
  purchasedAt: Date | null;
  revokedAt: Date | null;
}

function serialize(row: typeof shopEntitlements.$inferSelect): ShopEntitlementSummary {
  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    orderId: row.order_id,
    purchasedAt: row.purchased_at,
    revokedAt: row.revoked_at,
  };
}

export function hasActiveShopEntitlement(entitlement?: Pick<ShopEntitlementSummary, "purchasedAt" | "revokedAt"> | null) {
  return Boolean(entitlement?.purchasedAt && !entitlement.revokedAt);
}

export async function getShopEntitlement(
  db: Database,
  input: { userId: string; productId: string },
) {
  const [row] = await db
    .select()
    .from(shopEntitlements)
    .where(and(
      eq(shopEntitlements.user_id, input.userId),
      eq(shopEntitlements.product_id, input.productId),
    ))
    .limit(1);
  return row ? serialize(row) : null;
}

export async function getShopEntitlementByCheckoutSessionId(db: Database, checkoutSessionId: string) {
  const [row] = await db
    .select()
    .from(shopEntitlements)
    .where(eq(shopEntitlements.stripe_checkout_session_id, checkoutSessionId))
    .limit(1);
  return row ? serialize(row) : null;
}

export async function getShopEntitlementById(db: Database, entitlementId: string) {
  const [row] = await db
    .select()
    .from(shopEntitlements)
    .where(eq(shopEntitlements.id, entitlementId))
    .limit(1);
  return row ? serialize(row) : null;
}

export async function prepareShopEntitlementForCheckout(
  db: Database,
  input: { userId: string; productId: string },
): Promise<
  | { kind: "already_paid"; entitlement: ShopEntitlementSummary }
  | { kind: "pending_payment"; entitlement: ShopEntitlementSummary }
> {
  const product = await getShopProductById(db, input.productId);
  if (!product || !isPurchasableShopProduct(product)) {
    throw createHttpError(409, "This Shop product is not available for purchase.");
  }

  const existing = await getShopEntitlement(db, input);
  if (hasActiveShopEntitlement(existing)) {
    return { kind: "already_paid", entitlement: existing! };
  }
  if (existing) {
    return { kind: "pending_payment", entitlement: existing };
  }

  const [created] = await db
    .insert(shopEntitlements)
    .values({
      user_id: input.userId,
      product_id: input.productId,
    })
    .onConflictDoUpdate({
      target: [shopEntitlements.user_id, shopEntitlements.product_id],
      set: { updated_at: new Date() },
    })
    .returning();

  if (!created) {
    throw createHttpError(500, "Shop entitlement could not be prepared.");
  }

  return { kind: "pending_payment", entitlement: serialize(created) };
}

export async function markShopEntitlementPurchased(
  db: Database,
  input: {
    entitlementId: string;
    userId: string;
    productId?: string;
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    orderId?: string | null;
    purchasedAt?: Date;
  },
) {
  const [updated] = await db
    .update(shopEntitlements)
    .set({
      purchased_at: input.purchasedAt ?? new Date(),
      revoked_at: null,
      stripe_checkout_session_id: input.stripeCheckoutSessionId ?? undefined,
      stripe_payment_intent_id: input.stripePaymentIntentId ?? undefined,
      order_id: input.orderId ?? undefined,
      updated_at: new Date(),
    })
    .where(and(
      eq(shopEntitlements.id, input.entitlementId),
      eq(shopEntitlements.user_id, input.userId),
    ))
    .returning();

  if (!updated) {
    throw createHttpError(404, "Shop entitlement was not found.");
  }

  return serialize(updated);
}

export async function listMemberShopPurchases(db: Database, userId: string) {
  const rows = await db
    .select({
      entitlement: shopEntitlements,
      product: shopProducts,
    })
    .from(shopEntitlements)
    .innerJoin(shopProducts, eq(shopProducts.id, shopEntitlements.product_id))
    .where(eq(shopEntitlements.user_id, userId));

  const purchases = [];
  for (const row of rows) {
    if (!hasActiveShopEntitlement(serialize(row.entitlement))) {
      continue;
    }
    const files = await db
      .select()
      .from(shopProductFiles)
      .where(and(
        eq(shopProductFiles.product_id, row.product.id),
        eq(shopProductFiles.is_available, true),
      ));
    purchases.push({
      entitlementId: row.entitlement.id,
      productId: row.product.id,
      productName: row.product.name,
      slug: row.product.slug,
      formatLabel: row.product.format_label,
      purchasedAt: row.entitlement.purchased_at?.toISOString() ?? null,
      files: files.map((file) => ({
        id: file.id,
        displayName: file.display_name,
        mimeType: file.mime_type,
        sizeBytes: file.size_bytes,
        kind: file.kind,
      })),
      awaitingAssets: files.length === 0,
      awaitingDeckAssets: !files.some((file) => file.kind === "deck"),
      awaitingBooklet: !files.some((file) => file.kind === "booklet" || file.kind === "manual"),
    });
  }

  return purchases;
}
