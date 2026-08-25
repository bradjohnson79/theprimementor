import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { config as loadEnv } from "dotenv";
import { eq, like } from "drizzle-orm";
import { createDb, orders, shopEntitlements, shopProducts, users } from "@wisdom/db";
import {
  SHOP_TEST_READY_FIXTURES,
  SHOP_TEST_SESSION_IDS,
  retrieveStubbedShopCheckoutSession,
} from "./shopFulfillmentTestStub.js";
import { getShopOrderSuccessView } from "./shopFulfillmentService.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../");
loadEnv({ path: path.join(repoRoot, "apps/api/.env") });

function assertLocalhostDatabase(databaseUrl: string) {
  const host = new URL(databaseUrl.replace(/^postgresql:/, "http:")).host;
  if (host.includes("ep-weathered-forest-ak5x524w")) {
    throw new Error("Refusing Shop fulfillment smoke writes against the production Neon branch.");
  }
}

const databaseUrl = process.env.DATABASE_URL?.trim();
const canRun = Boolean(databaseUrl);
if (databaseUrl) assertLocalhostDatabase(databaseUrl);

const db = databaseUrl ? createDb(databaseUrl) : null;

const TEST_CLERK_ID = "shop_success_view_smoke";
const TEST_EMAIL = "shop-success-view-smoke@example.com";

describe("Shop order success view smoke", { skip: !canRun }, () => {
  let userId = "";

  async function cleanup() {
    if (!db) return;
    await db.delete(shopEntitlements).where(like(shopEntitlements.stripe_checkout_session_id, "cs_test_shop_%"));
    await db.delete(orders).where(like(orders.payment_reference, "shop_test_%"));
    await db.delete(shopProducts).where(like(shopProducts.slug, "shop-test-ephemeral-%"));
    await db.delete(users).where(eq(users.clerk_id, TEST_CLERK_ID));
  }

  before(async () => {
    if (!db) return;
    await cleanup();
    const [user] = await db.insert(users).values({
      clerk_id: TEST_CLERK_ID,
      email: TEST_EMAIL,
      role: "client",
    }).returning();
    userId = user.id;
  });

  after(async () => {
    await cleanup();
  });

  async function seedReady(sessionId: string, slug: string, emailStatus: "sent" | "failed" = "sent") {
    if (!db) throw new Error("Database is required");
    const [product] = await db.select().from(shopProducts).where(eq(shopProducts.slug, slug)).limit(1);
    assert.ok(product, `Catalog product ${slug} must exist`);
    const [order] = await db.insert(orders).values({
      user_id: userId,
      type: "shop",
      label: product.name,
      amount: product.price_cents,
      currency: product.currency,
      status: "completed",
      payment_reference: `shop_test_${sessionId}_${randomUUID()}`,
      metadata: {
        source: "shop_success_smoke",
        productId: product.id,
        fulfillmentEmailStatus: emailStatus,
      },
    }).returning();
    const [entitlement] = await db.insert(shopEntitlements).values({
      user_id: userId,
      product_id: product.id,
      stripe_checkout_session_id: sessionId,
      order_id: order.id,
      purchased_at: new Date(),
    }).onConflictDoUpdate({
      target: [shopEntitlements.user_id, shopEntitlements.product_id],
      set: {
        stripe_checkout_session_id: sessionId,
        order_id: order.id,
        purchased_at: new Date(),
        revoked_at: null,
        updated_at: new Date(),
      },
    }).returning();
    return { product, order, entitlement };
  }

  it("resolves all six catalog fulfillment URLs from verified paid fixtures", async () => {
    if (!db) return;
    const allUrls = SHOP_TEST_READY_FIXTURES.map((fixture) => fixture.downloadUrl);
    for (const fixture of SHOP_TEST_READY_FIXTURES) {
      await seedReady(fixture.sessionId, fixture.slug);
      const view = await getShopOrderSuccessView(db as never, {
        sessionId: fixture.sessionId,
        userId,
        userEmail: TEST_EMAIL,
        clerkId: TEST_CLERK_ID,
      }, async (sessionId, owner) => {
        const session = retrieveStubbedShopCheckoutSession(sessionId, owner);
        if (!session) throw new Error("missing stub");
        return session;
      });
      assert.equal(view.state, "ready");
      assert.equal(view.productName, fixture.name);
      assert.equal(view.downloadUrl, fixture.downloadUrl);
      assert.equal(view.downloadLabel, "Download Your Product");
      assert.equal(view.formatLabel, fixture.slug === "remote-source-bed-kit" ? "Printable Digital Edition" : "Digital Edition");
      for (const other of allUrls) {
        if (other === fixture.downloadUrl) continue;
        assert.notEqual(view.downloadUrl, other);
      }
    }
  });

  it("rejects unknown, unpaid, and canceled sessions without a download URL", async () => {
    if (!db) return;
    const retrieve = async (sessionId: string, owner?: { userId: string; userEmail: string; clerkId: string }) => {
      const session = retrieveStubbedShopCheckoutSession(sessionId, owner);
      if (!session) throw new Error("No such checkout session");
      return session;
    };
    const unknown = await getShopOrderSuccessView(db as never, {
      sessionId: "cs_test_shop_unknown",
      userId,
      userEmail: TEST_EMAIL,
      clerkId: TEST_CLERK_ID,
    }, retrieve);
    assert.equal(unknown.state, "invalid");
    assert.equal(unknown.downloadUrl, null);

    const unpaid = await getShopOrderSuccessView(db as never, {
      sessionId: SHOP_TEST_SESSION_IDS.unpaid,
      userId,
      userEmail: TEST_EMAIL,
      clerkId: TEST_CLERK_ID,
    }, retrieve);
    assert.equal(unpaid.state, "unpaid");
    assert.equal(unpaid.downloadUrl, null);

    const canceled = await getShopOrderSuccessView(db as never, {
      sessionId: SHOP_TEST_SESSION_IDS.canceled,
      userId,
      userEmail: TEST_EMAIL,
      clerkId: TEST_CLERK_ID,
    }, retrieve);
    assert.equal(canceled.state, "canceled");
    assert.equal(canceled.downloadUrl, null);
  });

  it("returns processing then ready after entitlement is purchased", async () => {
    if (!db) return;
    const [product] = await db.select().from(shopProducts).where(eq(shopProducts.slug, "healing-code-cards-body-deck")).limit(1);
    assert.ok(product);
    await db.insert(shopEntitlements).values({
      user_id: userId,
      product_id: product.id,
      stripe_checkout_session_id: SHOP_TEST_SESSION_IDS.processing,
      purchased_at: null,
    }).onConflictDoUpdate({
      target: [shopEntitlements.user_id, shopEntitlements.product_id],
      set: {
        stripe_checkout_session_id: SHOP_TEST_SESSION_IDS.processing,
        purchased_at: null,
        revoked_at: null,
        updated_at: new Date(),
      },
    });
    const retrieve = async (sessionId: string, owner?: { userId: string; userEmail: string; clerkId: string }) => {
      const session = retrieveStubbedShopCheckoutSession(sessionId, owner);
      if (!session) throw new Error("missing stub");
      return session;
    };
    const processing = await getShopOrderSuccessView(db as never, {
      sessionId: SHOP_TEST_SESSION_IDS.processing,
      userId,
      userEmail: TEST_EMAIL,
      clerkId: TEST_CLERK_ID,
    }, retrieve);
    assert.equal(processing.state, "processing");
    assert.equal(processing.downloadUrl, null);

    await db.update(shopEntitlements).set({
      purchased_at: new Date(),
      updated_at: new Date(),
    }).where(eq(shopEntitlements.stripe_checkout_session_id, SHOP_TEST_SESSION_IDS.processing));

    const ready = await getShopOrderSuccessView(db as never, {
      sessionId: SHOP_TEST_SESSION_IDS.processing,
      userId,
      userEmail: TEST_EMAIL,
      clerkId: TEST_CLERK_ID,
    }, retrieve);
    assert.equal(ready.state, "ready");
    assert.equal(ready.downloadUrl, SHOP_TEST_READY_FIXTURES[0].downloadUrl);
  });

  it("does not fabricate a URL when fulfillment is missing", async () => {
    if (!db) return;
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
    }).returning();
    await db.insert(shopEntitlements).values({
      user_id: userId,
      product_id: product.id,
      stripe_checkout_session_id: SHOP_TEST_SESSION_IDS.missingFulfillment,
      purchased_at: new Date(),
    });
    const view = await getShopOrderSuccessView(db as never, {
      sessionId: SHOP_TEST_SESSION_IDS.missingFulfillment,
      userId,
      userEmail: TEST_EMAIL,
      clerkId: TEST_CLERK_ID,
    }, async (sessionId, owner) => {
      const session = retrieveStubbedShopCheckoutSession(sessionId, owner);
      if (!session) throw new Error("missing stub");
      return session;
    });
    assert.equal(view.state, "missing_fulfillment");
    assert.equal(view.downloadUrl, null);
    assert.equal(view.productName, "Shop Test Missing Fulfillment");
  });

  it("keeps the download when fulfillment email failed", async () => {
    if (!db) return;
    await seedReady(SHOP_TEST_SESSION_IDS.emailFailed, "digital-safeguard-kit", "failed");
    const view = await getShopOrderSuccessView(db as never, {
      sessionId: SHOP_TEST_SESSION_IDS.emailFailed,
      userId,
      userEmail: TEST_EMAIL,
      clerkId: TEST_CLERK_ID,
    }, async (sessionId, owner) => {
      const session = retrieveStubbedShopCheckoutSession(sessionId, owner);
      if (!session) throw new Error("missing stub");
      return session;
    });
    assert.equal(view.state, "email_failed");
    assert.equal(view.downloadUrl, SHOP_TEST_READY_FIXTURES.find((fixture) => fixture.key === "safeguard")?.downloadUrl);
    assert.match(view.message, /could not confirm/i);
  });

  it("ignores browser-supplied download or paid query values because they never reach the view", async () => {
    if (!db) return;
    const fixture = SHOP_TEST_READY_FIXTURES[0];
    await seedReady(fixture.sessionId, fixture.slug);
    const view = await getShopOrderSuccessView(db as never, {
      sessionId: fixture.sessionId,
      userId,
      userEmail: TEST_EMAIL,
      clerkId: TEST_CLERK_ID,
    }, async (sessionId, owner) => {
      const session = retrieveStubbedShopCheckoutSession(sessionId, owner);
      if (!session) throw new Error("missing stub");
      return session;
    });
    assert.equal(view.downloadUrl, fixture.downloadUrl);
    assert.notEqual(view.downloadUrl, "https://drive.google.com/drive/folders/wrong");
  });
});
