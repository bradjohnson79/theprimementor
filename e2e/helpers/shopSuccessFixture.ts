import { randomUUID } from "node:crypto";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { eq, like, or } from "drizzle-orm";
import { createDb, orders, shopEntitlements, shopProducts, users } from "../../packages/db/src/index.ts";
import {
  SHOP_TEST_READY_FIXTURES,
  SHOP_TEST_SESSION_IDS,
} from "../../apps/api/src/services/shop/shopFulfillmentTestStub.ts";

const repoRoot = process.cwd();
loadEnv({ path: path.join(repoRoot, "apps/api/.env") });

function assertLocalhostDatabase(databaseUrl: string) {
  const host = new URL(databaseUrl.replace(/^postgresql:/, "http:")).host;
  if (host.includes("ep-weathered-forest-ak5x524w")) {
    throw new Error("Refusing Shop success fixtures against the production Neon branch.");
  }
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to prepare Shop success fixtures.");
}
assertLocalhostDatabase(databaseUrl);

const db = createDb(databaseUrl);

export { SHOP_TEST_READY_FIXTURES, SHOP_TEST_SESSION_IDS };

export const SHOP_QA_EMAIL = process.env.E2E_CLERK_EMAIL?.trim() || "info@aetherx.co";
export const SHOP_QA_PASSWORD = process.env.E2E_CLERK_PASSWORD?.trim() || "sample123";
export const SHOP_QA_STORAGE_STATE = "e2e/.auth/shop-qa.json";
export const SHOP_TEST_API_ORIGIN = "http://127.0.0.1:3011";

export async function routeShopSuccessApi(page: import("@playwright/test").Page) {
  const forward = async (route: import("@playwright/test").Route) => {
    const original = new URL(route.request().url());
    const target = `${SHOP_TEST_API_ORIGIN}${original.pathname}${original.search}`;
    const response = await route.fetch({ url: target });
    await route.fulfill({ response });
  };
  await page.route("**/api/shop/order/success**", forward);
  await page.route("**/api/checkout-session/sync**", forward);
}

export async function findShopQaUser() {
  const [user] = await db.select().from(users).where(eq(users.email, SHOP_QA_EMAIL)).limit(1);
  if (!user) {
    throw new Error(
      `Clerk QA user ${SHOP_QA_EMAIL} is not in shop-localhost. Run pnpm --filter @wisdom/api membership:test-user after creating the user from apps/api/MEMBERSHIP_QA_SETUP.md.`,
    );
  }
  return user;
}

export async function cleanupShopSuccessFixtures() {
  await db.delete(shopEntitlements).where(like(shopEntitlements.stripe_checkout_session_id, "cs_test_shop_%"));
  await db.delete(orders).where(like(orders.payment_reference, "shop_test_%"));
  await db.delete(shopProducts).where(or(
    like(shopProducts.slug, "shop-test-ephemeral-%"),
    eq(shopProducts.slug, "shop-test-ephemeral-missing-fulfillment"),
    eq(shopProducts.slug, "shop-test-ephemeral-email-failed"),
  ));
}

async function upsertEntitlement(input: {
  userId: string;
  productId: string;
  sessionId: string;
  orderId?: string | null;
  purchasedAt: Date | null;
}) {
  const [row] = await db.insert(shopEntitlements).values({
    user_id: input.userId,
    product_id: input.productId,
    stripe_checkout_session_id: input.sessionId,
    order_id: input.orderId ?? null,
    purchased_at: input.purchasedAt,
  }).onConflictDoUpdate({
    target: [shopEntitlements.user_id, shopEntitlements.product_id],
    set: {
      stripe_checkout_session_id: input.sessionId,
      order_id: input.orderId ?? null,
      purchased_at: input.purchasedAt,
      revoked_at: null,
      updated_at: new Date(),
    },
  }).returning();
  return row;
}

export async function seedReadyFixture(slug: string, sessionId: string, emailStatus: "sent" | "failed" = "sent") {
  const user = await findShopQaUser();
  const [product] = await db.select().from(shopProducts).where(eq(shopProducts.slug, slug)).limit(1);
  if (!product) throw new Error(`Shop product ${slug} was not found.`);
  const [order] = await db.insert(orders).values({
    user_id: user.id,
    type: "shop",
    label: product.name,
    amount: product.price_cents,
    currency: product.currency,
    status: "completed",
    payment_reference: `shop_test_${sessionId}_${randomUUID()}`,
    metadata: {
      source: "shop_success_e2e",
      productId: product.id,
      fulfillmentEmailStatus: emailStatus,
    },
  }).returning();
  await upsertEntitlement({
    userId: user.id,
    productId: product.id,
    sessionId,
    orderId: order.id,
    purchasedAt: new Date(),
  });
  return { user, product, order };
}

export async function seedProcessingFixture() {
  const user = await findShopQaUser();
  const [product] = await db.select().from(shopProducts).where(eq(shopProducts.slug, "healing-code-cards-body-deck")).limit(1);
  if (!product) throw new Error("Body Deck was not found.");
  await upsertEntitlement({
    userId: user.id,
    productId: product.id,
    sessionId: SHOP_TEST_SESSION_IDS.processing,
    purchasedAt: null,
  });
  return { user, product };
}

export async function markProcessingFixturePurchased() {
  const user = await findShopQaUser();
  const [product] = await db.select().from(shopProducts).where(eq(shopProducts.slug, "healing-code-cards-body-deck")).limit(1);
  if (!product) throw new Error("Body Deck was not found.");
  const [order] = await db.insert(orders).values({
    user_id: user.id,
    type: "shop",
    label: product.name,
    amount: product.price_cents,
    currency: product.currency,
    status: "completed",
    payment_reference: `shop_test_${SHOP_TEST_SESSION_IDS.processing}_${randomUUID()}`,
    metadata: {
      source: "shop_success_e2e",
      productId: product.id,
      fulfillmentEmailStatus: "sent",
    },
  }).returning();
  await db.update(shopEntitlements).set({
    purchased_at: new Date(),
    order_id: order.id,
    updated_at: new Date(),
  }).where(eq(shopEntitlements.stripe_checkout_session_id, SHOP_TEST_SESSION_IDS.processing));
}

export async function seedMissingFulfillmentFixture() {
  const user = await findShopQaUser();
  const [product] = await db.insert(shopProducts).values({
    name: "Shop Test Missing Fulfillment",
    slug: "shop-test-ephemeral-missing-fulfillment",
    status: "draft",
    is_active: false,
    featured: false,
    sort_order: 999,
    price_cents: 100,
    currency: "CAD",
    format_label: "Digital Edition",
    fulfillment_type: "external_download",
    fulfillment_download_url: null,
  }).onConflictDoUpdate({
    target: shopProducts.slug,
    set: {
      fulfillment_download_url: null,
      updated_at: new Date(),
    },
  }).returning();
  await upsertEntitlement({
    userId: user.id,
    productId: product.id,
    sessionId: SHOP_TEST_SESSION_IDS.missingFulfillment,
    purchasedAt: new Date(),
  });
}

export async function seedEmailFailedFixture() {
  const [product] = await db.insert(shopProducts).values({
    name: "Shop Test Email Failed",
    slug: "shop-test-ephemeral-email-failed",
    status: "draft",
    is_active: false,
    featured: false,
    sort_order: 998,
    price_cents: 100,
    currency: "CAD",
    format_label: "Digital Edition",
    fulfillment_type: "external_download",
    fulfillment_download_url: "https://drive.google.com/drive/folders/1SJw4BK9jWK0yzSol9bdNc6EiVTALMWJK?usp=sharing",
    fulfillment_download_label: "Download Your Product",
  }).onConflictDoUpdate({
    target: shopProducts.slug,
    set: {
      fulfillment_download_url: "https://drive.google.com/drive/folders/1SJw4BK9jWK0yzSol9bdNc6EiVTALMWJK?usp=sharing",
      updated_at: new Date(),
    },
  }).returning();
  const user = await findShopQaUser();
  const [order] = await db.insert(orders).values({
    user_id: user.id,
    type: "shop",
    label: product.name,
    amount: 100,
    currency: "CAD",
    status: "completed",
    payment_reference: `shop_test_${SHOP_TEST_SESSION_IDS.emailFailed}_${randomUUID()}`,
    metadata: {
      source: "shop_success_e2e",
      productId: product.id,
      fulfillmentEmailStatus: "failed",
    },
  }).returning();
  await upsertEntitlement({
    userId: user.id,
    productId: product.id,
    sessionId: SHOP_TEST_SESSION_IDS.emailFailed,
    orderId: order.id,
    purchasedAt: new Date(),
  });
}
