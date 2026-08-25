import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { createDb, shopProducts, users } from "@wisdom/db";
import { createCheckoutSession } from "../paymentService.js";
import { prepareShopEntitlementForCheckout } from "./shopEntitlementService.js";

config({ path: path.resolve(process.cwd(), ".env") });

const PUBLIC_SLUGS = [
  "healing-code-cards-body-deck",
  "healing-code-cards-mind-deck",
  "healing-code-cards-energy-deck",
  "healing-code-cards-source-deck-body-set",
  "digital-safeguard-kit",
  "remote-source-bed-kit",
] as const;

describe("Shop checkout session create", () => {
  it("creates Stripe Checkout sessions from catalog Price IDs for all six products", async (t) => {
    if (process.env.SHOP_CHECKOUT_CREATE_TEST !== "1") {
      t.skip("Set SHOP_CHECKOUT_CREATE_TEST=1 to create unpaid Stripe Checkout sessions on shop-localhost.");
      return;
    }
    const databaseUrl = process.env.DATABASE_URL?.trim();
    const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!databaseUrl || databaseUrl.includes("ep-weathered-forest")) {
      t.skip("shop-localhost DATABASE_URL is required.");
      return;
    }
    if (!stripeKey) {
      t.skip("STRIPE_SECRET_KEY is required.");
      return;
    }
    if (stripeKey.startsWith("sk_live_")) {
      // Session create is allowed and does not charge. Payments stay blocked.
    }

    const db = createDb(databaseUrl);
    const email = process.env.E2E_CLERK_EMAIL?.trim() || "info@aetherx.co";
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      t.skip(`QA user ${email} is not in shop-localhost.`);
      return;
    }

    const created: Array<{ slug: string; url: string; amount: number; currency: string; name: string }> = [];
    for (const slug of PUBLIC_SLUGS) {
      const [product] = await db.select().from(shopProducts).where(eq(shopProducts.slug, slug)).limit(1);
      assert.ok(product, `${slug} must exist`);
      assert.ok(product.stripe_price_id, `${slug} must have a Stripe Price`);
      const prepared = await prepareShopEntitlementForCheckout(db, {
        userId: user.id,
        productId: product.id,
      });
      if (prepared.kind === "already_paid") {
        t.skip(`${slug} is already purchased by ${email}; cannot create a new checkout session.`);
        return;
      }
      const session = await createCheckoutSession(db, {
        type: "shop",
        shopEntitlementId: prepared.entitlement.id,
        userId: user.id,
        userEmail: user.email,
        clerkId: user.clerk_id,
      });
      assert.ok(session.url?.startsWith("https://checkout.stripe.com/"), `${slug} must return a Stripe Checkout URL`);
      assert.equal(session.metadata?.type, "shop");
      assert.equal(session.metadata?.shopProductId, product.id);
      assert.match(session.success_url ?? "", /\/shop\/order\/success\?session_id=/);
      assert.match(session.cancel_url ?? "", new RegExp(`/shop/${slug}\\?checkout=canceled`));
      assert.equal(session.payment_status, "unpaid");
      assert.equal(session.amount_total, product.price_cents);
      assert.equal(session.currency, product.currency.toLowerCase());
      created.push({
        slug,
        url: session.url ?? "",
        amount: product.price_cents,
        currency: product.currency,
        name: product.name,
      });
    }
    assert.equal(created.length, 6);
    console.log(JSON.stringify({ created: created.map((row) => ({ slug: row.slug, amount: row.amount, currency: row.currency, hasUrl: Boolean(row.url) })) }));
  });
});
