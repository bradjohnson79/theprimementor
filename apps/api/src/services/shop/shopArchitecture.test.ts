import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../");

function read(rel: string) {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

describe("Shop catalog architecture", () => {
  it("does not hard-code Stripe Price IDs in frontend or checkout business logic", () => {
    const frontend = [
      "apps/web/src/lib/shopCheckout.ts",
      "apps/web/src/lib/shop.ts",
      "apps/web/src/routes/ShopProduct.tsx",
      "apps/web/src/routes/ShopLanding.tsx",
      "apps/web/src/routes/Home.tsx",
      "apps/web/src/components/home/HomeShopGallery.tsx",
      "apps/admin/src/pages/shop/ShopProductEditor.tsx",
    ].map(read).join("\n");
    assert.equal(frontend.includes("price_1U6awqAd5V3LaCqjYPtzgvir"), false);
    assert.equal(frontend.includes("price_1U6br5Ad5V3LaCqj7AUstqit"), false);
    assert.equal(frontend.includes("price_1U85OFAd5V3LaCqjUt1e8CXA"), false);
    assert.equal(frontend.includes("price_1U85gSAd5V3LaCqjVjszTGEo"), false);
    assert.equal(frontend.includes("price_1U85usAd5V3LaCqjPtqyWS0a"), false);
    assert.equal(frontend.includes("price_1U863FAd5V3LaCqjxdjoXqq5"), false);
    assert.equal(/STRIPE_[A-Z0-9_]*PRICE_ID/.test(frontend), false);

    const checkout = read("apps/api/src/services/paymentService.ts");
    const start = checkout.indexOf("async function createShopCheckoutSession");
    assert.notEqual(start, -1);
    const rest = checkout.slice(start);
    const nextFn = rest.indexOf("\nasync function ", 1);
    const shopCheckout = nextFn === -1 ? rest : rest.slice(0, nextFn);
    assert.equal(shopCheckout.includes("price_1U6awqAd5V3LaCqjYPtzgvir"), false);
    assert.equal(shopCheckout.includes("price_1U6br5Ad5V3LaCqj7AUstqit"), false);
    assert.equal(shopCheckout.includes("price_1U85OFAd5V3LaCqjUt1e8CXA"), false);
    assert.equal(shopCheckout.includes("price_1U85gSAd5V3LaCqjVjszTGEo"), false);
    assert.equal(shopCheckout.includes("price_1U85usAd5V3LaCqjPtqyWS0a"), false);
    assert.equal(shopCheckout.includes("price_1U863FAd5V3LaCqjxdjoXqq5"), false);
    assert.equal(shopCheckout.includes("STRIPE_BODY_DECK_PRICE_ID"), false);
    assert.equal(shopCheckout.includes("STRIPE_MIND_DECK_PRICE_ID"), false);
    assert.equal(shopCheckout.includes("STRIPE_ENERGY_DECK_PRICE_ID"), false);
    assert.equal(shopCheckout.includes("STRIPE_SOURCE_DECK_PRICE_ID"), false);
    assert.equal(shopCheckout.includes("STRIPE_DIGITAL_SAFEGUARD_KIT_PRICE_ID"), false);
    assert.equal(shopCheckout.includes("STRIPE_REMOTE_SOURCE_BED_KIT_PRICE_ID"), false);
    assert.equal(/if\s*\(.*slug.*body-deck/.test(shopCheckout), false);
    assert.equal(/if\s*\(.*slug.*mind-deck/.test(shopCheckout), false);
    assert.equal(/if\s*\(.*slug.*energy-deck/.test(shopCheckout), false);
    assert.equal(/if\s*\(.*slug.*source-deck/.test(shopCheckout), false);
    assert.equal(/if\s*\(.*slug.*digital-safeguard/.test(shopCheckout), false);
    assert.equal(/if\s*\(.*slug.*remote-source-bed/.test(shopCheckout), false);
    assert.match(shopCheckout, /product\.stripe_price_id/);
    assert.match(shopCheckout, /\/shop\/order\/success\?session_id=\{CHECKOUT_SESSION_ID\}/);
    assert.equal(shopCheckout.includes("drive.google.com"), false);
  });

  it("does not introduce a Mind Deck, Energy Deck, or Source Deck Stripe env var", () => {
    const seed = read("packages/db/src/seed-shop.ts");
    const envExample = read("apps/api/.env.example");
    assert.equal(seed.includes("STRIPE_MIND_DECK_PRICE_ID"), false);
    assert.equal(seed.includes("STRIPE_ENERGY_DECK_PRICE_ID"), false);
    assert.equal(seed.includes("STRIPE_SOURCE_DECK_PRICE_ID"), false);
    assert.equal(seed.includes("STRIPE_DIGITAL_SAFEGUARD_KIT_PRICE_ID"), false);
    assert.equal(seed.includes("STRIPE_REMOTE_SOURCE_BED_KIT_PRICE_ID"), false);
    assert.equal(envExample.includes("STRIPE_MIND_DECK_PRICE_ID"), false);
    assert.equal(envExample.includes("STRIPE_ENERGY_DECK_PRICE_ID"), false);
    assert.equal(envExample.includes("STRIPE_SOURCE_DECK_PRICE_ID"), false);
    assert.equal(envExample.includes("STRIPE_DIGITAL_SAFEGUARD_KIT_PRICE_ID"), false);
    assert.equal(envExample.includes("STRIPE_REMOTE_SOURCE_BED_KIT_PRICE_ID"), false);
    assert.match(seed, /price_1U6br5Ad5V3LaCqj7AUstqit/);
    assert.match(seed, /price_1U85OFAd5V3LaCqjUt1e8CXA/);
    assert.match(seed, /price_1U85gSAd5V3LaCqjVjszTGEo/);
    assert.match(seed, /price_1U85usAd5V3LaCqjPtqyWS0a/);
    assert.match(seed, /price_1U863FAd5V3LaCqjxdjoXqq5/);
    assert.match(seed, /remote-source-bed-kit/);
    assert.match(seed, /Remote Source Bed Kit/);
    assert.match(seed, /Printable Digital Edition/);
    assert.match(seed, /youtu\.be\/WT0bY_Vme94/);
    assert.match(seed, /kind: "manual"/);
    assert.match(seed, /North Directional Geometry Array/);
    assert.match(seed, /Physical Body Concentrator/);
    assert.match(seed, /not a medical device, diagnostic tool, therapeutic bed/);
    assert.match(seed, /healing-code-cards-mind-deck/);
    assert.match(seed, /healing-code-cards-energy-deck/);
    assert.match(seed, /Healing Code Cards: Energy Deck/);
    assert.match(seed, /healing-code-cards-source-deck-body-set/);
    assert.match(seed, /digital-safeguard-kit/);
    assert.match(seed, /Digital Safeguard Kit/);
    assert.match(seed, /Personal & Environmental Safeguard Sets/);
    assert.match(seed, /SAFEGUARD_KIT_DEFAULT_PRICE_ID/);
    assert.match(seed, /SOURCE_DECK_DEFAULT_PRICE_ID/);
    assert.match(seed, /collection: "digital-wellness-tools"/);
    assert.match(seed, /Important Placement Safety/);
    assert.match(seed, /not a medical device, radiation-protection device/);
    assert.match(seed, /awaiting attachment/);
    assert.match(seed, /stripe_price_id: existing\.stripe_price_id/);
    assert.match(seed, /Healing Code Cards: Source Deck — Body Set/);
    assert.equal(seed.includes("SOURCE_DECK_QUICK_SUMMARY =\n  \"AetherX"), false);
    assert.match(seed, /Brain Balancer/);
    assert.match(seed, /Scalp & Hair Balancer/);
    assert.match(seed, /Kidney & Bladder Balancer/);
    assert.match(seed, /Mammary Gland Balancer/);
    assert.match(seed, /Nervous System Balancer/);
    assert.match(seed, /DNA Balancer/);
    for (const card of [
      "Brain Balancer", "Scalp & Hair Balancer", "Eye Balancer", "Nose Balancer", "Ear Balancer",
      "Mouth Balancer", "Throat Balancer", "Thyroid Balancer", "Spine Balancer", "Heart Balancer",
      "Thymus Balancer", "Lung Balancer", "Liver Balancer", "Stomach Balancer", "Pancreas Balancer",
      "Spleen Balancer", "Kidney & Bladder Balancer", "Intestinal Balancer", "Skin Balancer",
      "Mammary Gland Balancer", "Skeletal Balancer", "Muscular Balancer", "Lymphatic Balancer",
      "Circulatory Balancer", "Reproductive Balancer", "Nervous System Balancer", "Cellular Balancer",
      "DNA Balancer",
    ]) {
      assert.match(seed, new RegExp(card.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(seed, /Scalar-wave concepts/);
    assert.match(seed, /Earth Schumann Resonance — 7.83 Hz/);
    assert.match(seed, /Solar Frequency — 432 Hz/);
    assert.equal(seed.includes("Second Edition"), false);
    assert.equal(seed.includes("Energy Deck Special Edition"), false);
    assert.match(seed, /1 Positive Polarity Collector/);
    assert.match(seed, /1 Negative Polarity Receiver/);
    assert.match(seed, /30 Purifier Cards/);
    assert.match(seed, /7 Integrator Cards/);
    assert.match(seed, /1 Conflict Energy Container/);
    assert.match(seed, /4 Amplifier Cards/);
    assert.match(seed, /https:\/\/www\.youtube\.com\/live\/_DniHEzLgps/);
    const productPage = read("apps/web/src/routes/ShopProduct.tsx");
    assert.equal(productPage.includes("_DniHEzLgps"), false);
    assert.match(productPage, /videoEmbedUrl/);
    for (const card of [
      "Brain Purifier", "Sensory Purifier", "Spinal Purifier", "Thyroid Purifier", "Thymus Purifier",
      "Heart Purifier", "Pericardium Purifier", "Lungs Purifier", "Liver Purifier", "Stomach Purifier",
      "Pancreas Purifier", "Spleen Purifier", "Small Intestine Purifier", "Large Intestine Purifier",
      "Reproductive Purifier", "Skin Purifier", "Bodily System Purifier", "Joint Purifier",
      "Cellular Body Purifier", "Musculoskeletal Purifier", "Red Ray Purifier", "Orange Ray Purifier",
      "Yellow Ray Purifier", "Green Ray Purifier", "Aqua Ray Purifier", "Blue Ray Purifier",
      "Violet Ray Purifier", "Subtle Body Purifier", "Sleep Purifier", "Food & Drink Purifier",
      "Multivitamin Integrator", "PEMF Integrator", "Pyramid Torsion Integrator", "Tree Life Force Integrator",
      "Amethyst Crystal Integrator", "Shungite Crystal Integrator", "Selenite Crystal Integrator",
    ]) {
      assert.match(seed, new RegExp(card.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("product purchase CTA resumes after sign-in and does not send client prices", () => {
    const productPage = read("apps/web/src/routes/ShopProduct.tsx");
    const checkout = read("apps/web/src/lib/shopCheckout.ts");
    assert.match(productPage, /startShopCheckout/);
    assert.match(productPage, /PromoCodeInput/);
    assert.match(productPage, /type: "shop"/);
    assert.match(productPage, /Preparing Checkout/);
    assert.match(productPage, /shopPurchaseReturnPath/);
    assert.ok(
      productPage.indexOf('searchParams.get("purchase")') < productPage.indexOf("if (missing) {"),
      "purchase resume hook must run before the missing-product return",
    );
    assert.match(checkout, /\/shop\/\$\{slug\}\?purchase=1/);
    assert.match(checkout, /Please sign in to continue checkout/);
    assert.match(checkout, /promoCode/);
    assert.equal(checkout.includes("amount"), false);
    assert.equal(checkout.includes("stripePriceId"), false);
    assert.match(checkout, /checkout\.stripe\.com/);
    assert.equal(productPage.includes("price_1U6awqAd5V3LaCqjYPtzgvir"), false);
  });

  it("checkout route accepts productId only and ignores client amount", () => {
    const routes = read("apps/api/src/routes/shop.ts");
    const checkout = routes.slice(routes.indexOf('app.post<{ Body: { productId?: string; promoCode?: string } }>("/shop/checkout"'));
    assert.match(checkout, /productId is required/);
    assert.match(checkout, /promoCode: request.body\?\.promoCode/);
    assert.equal(checkout.includes("request.body?.amount"), false);
    assert.equal(checkout.includes("request.body?.priceId"), false);
    assert.equal(checkout.includes("request.body?.stripePriceId"), false);
  });

  it("admin create does not require a per-product env var", () => {
    const admin = read("apps/api/src/services/shop/shopAdminService.ts");
    assert.equal(admin.includes("STRIPE_BODY_DECK_PRICE_ID"), false);
    assert.equal(admin.includes("STRIPE_MIND_DECK_PRICE_ID"), false);
    assert.equal(admin.includes("STRIPE_ENERGY_DECK_PRICE_ID"), false);
    assert.equal(admin.includes("STRIPE_SOURCE_DECK_PRICE_ID"), false);
    assert.equal(admin.includes("STRIPE_DIGITAL_SAFEGUARD_KIT_PRICE_ID"), false);
    assert.equal(admin.includes("STRIPE_REMOTE_SOURCE_BED_KIT_PRICE_ID"), false);
    assert.match(admin, /createShopStripeProductAndPrice|associateStripe/);
    assert.match(admin, /priceChanged && current\?\.stripe_price_id/);
    assert.match(admin, /retrieveShopPriceProductId/);
  });

  it("does not hard-code customer testimonial copy into the product page", () => {
    const productPage = read("apps/web/src/routes/ShopProduct.tsx");
    const landing = read("apps/web/src/routes/ShopLanding.tsx");
    assert.equal(productPage.includes("healing-code-cards-energy-deck"), false);
    assert.equal(landing.includes("healing-code-cards-energy-deck"), false);
    assert.equal(productPage.includes("healing-code-cards-source-deck-body-set"), false);
    assert.equal(landing.includes("healing-code-cards-source-deck-body-set"), false);
    assert.equal(productPage.includes("digital-safeguard-kit"), false);
    assert.equal(landing.includes("digital-safeguard-kit"), false);
    assert.equal(productPage.includes("remote-source-bed-kit"), false);
    assert.equal(landing.includes("remote-source-bed-kit"), false);
    assert.match(productPage, /videoHeading/);
    assert.match(productPage, /hasSecureManual/);
    assert.equal(productPage.includes("Barb Salerno"), false);
    assert.equal(productPage.includes("Alice Bacon"), false);
    assert.equal(landing.includes("Barb Salerno"), false);
    assert.equal(landing.includes("Alice Bacon"), false);
    assert.match(productPage, /ShopTestimonials/);
    assert.match(productPage, /ShopRelatedProducts/);
    assert.equal(/if\s*\(.*slug.*body-deck/.test(productPage), false);
    const related = read("apps/web/src/components/shop/ShopRelatedProducts.tsx");
    assert.equal(/if\s*\(.*slug.*includes/.test(related), false);
    assert.equal(related.includes("healing-code-cards-body-deck"), false);
    assert.match(related, /View Deck/);
    assert.match(related, /Explore more digital wellness tools/);
    assert.match(related, /healing-code-cards/);
    const catalog = read("apps/api/src/services/shop/shopCatalog.ts");
    assert.match(catalog, /relatedProducts/);
    assert.match(catalog, /collection/);
    assert.equal(/if\s*\(.*slug.*includes/.test(catalog), false);
    const publicTestimonials = read("apps/api/src/services/shop/shopTestimonials.ts");
    const publicSerializer = publicTestimonials.slice(
      publicTestimonials.indexOf("export function serializePublicTestimonial"),
      publicTestimonials.indexOf("export function filterActiveTestimonials"),
    );
    assert.match(publicSerializer, /serializePublicTestimonial/);
    assert.equal(publicSerializer.includes("sourceLabel"), false);
    const seed = read("packages/db/src/seed-shop.ts");
    const recovered = read("packages/db/src/seed-shop-card-testimonials.ts");
    assert.equal(/face cloth|t-shirts|Aether Bed Trial Symbol/i.test(seed.slice(seed.indexOf("BARB_TESTIMONIAL_TEXT"))), false);
    assert.equal(/Aether Bed Trial Symbol/i.test(recovered), false);
    assert.match(seed, /collection: input\.collection \?\? "healing-code-cards"/);
    assert.match(seed, /collection: "digital-wellness-tools"/);
    assert.match(seed, /SHOP_EXTERNAL_DOWNLOADS/);
    assert.match(seed, /fulfillment_download_url/);
  });

  it("serves instruction booklets publicly while keeping purchased files entitlement-scoped", () => {
    const routes = read("apps/api/src/routes/shop.ts");
    const downloads = read("apps/api/src/services/shop/shopDownloadService.ts");
    const entitlement = read("apps/api/src/services/shop/shopEntitlementService.ts");
    assert.match(routes, /\/shop\/products\/:slug\/booklet/);
    assert.match(routes, /buildShopContentDisposition/);
    assert.match(downloads, /export async function loadPublicShopBooklet/);
    assert.match(downloads, /export function buildShopContentDisposition/);
    assert.match(downloads, /file\.kind === "booklet"/);
    assert.match(downloads, /isShopInstructionFileKind/);
    assert.equal(downloads.includes("if (file.kind === \"manual\")"), false);
    assert.match(downloads, /getShopEntitlement\(db, \{ userId: input\.userId, productId: file\.product_id \}\)/);
    assert.match(entitlement, /eq\(shopEntitlements.product_id, input.productId\)/);
    assert.equal(entitlement.includes("digital-safeguard-kit"), false);
    assert.equal(entitlement.includes("remote-source-bed-kit"), false);
    assert.equal(entitlement.includes("healing-code-cards-body-deck"), false);
  });

  it("homepage gallery reads featured catalog products without hard-coded slugs", () => {
    const home = read("apps/web/src/routes/Home.tsx");
    const gallery = read("apps/web/src/components/home/HomeShopGallery.tsx");
    const routes = read("apps/api/src/routes/shop.ts");
    const catalog = read("apps/api/src/services/shop/shopCatalog.ts");
    const editor = read("apps/admin/src/pages/shop/ShopProductEditor.tsx");
    const combined = `${home}\n${gallery}`;
    assert.match(home, /<HeroSection \/>/);
    assert.match(home, /<HomeShopGallery \/>/);
    assert.ok(home.indexOf("<HomeShopGallery />") > home.indexOf("<HeroSection />"));
    assert.ok(home.indexOf("<RegenerationOfferHomePanel />") > home.indexOf("<HomeShopGallery />"));
    assert.match(gallery, /\/shop\/products\?featured=true/);
    assert.match(gallery, /unwrapShopProducts/);
    assert.match(gallery, /Previous products/);
    assert.match(gallery, /Next products/);
    assert.match(gallery, /useAuth/);
    assert.match(gallery, /data-shop-gallery-auth-note/);
    assert.match(gallery, /\/sign-up/);
    assert.match(gallery, /\/sign-in/);
    assert.equal(combined.includes("healing-code-cards-body-deck"), false);
    assert.equal(combined.includes("healing-code-cards-mind-deck"), false);
    assert.equal(combined.includes("healing-code-cards-energy-deck"), false);
    assert.equal(combined.includes("healing-code-cards-source-deck-body-set"), false);
    assert.equal(combined.includes("digital-safeguard-kit"), false);
    assert.equal(combined.includes("remote-source-bed-kit"), false);
    assert.equal(combined.includes("drive.google.com"), false);
    assert.equal(combined.includes("price_1U6awqAd5V3LaCqjYPtzgvir"), false);
    assert.equal(routes.includes("/homepage-card-products"), false);
    assert.equal(routes.includes("/api/homepage-card-products"), false);
    assert.match(catalog, /featuredOnly/);
    assert.match(catalog, /eq\(shopProducts.featured, true\)/);
    assert.match(editor, /Featured on Homepage/);
    assert.match(editor, /product\.featured/);
    assert.equal(editor.includes("featuredOnHomepage"), false);
  });

  it("wires the six Shop products into promo targets, validation, and checkout", () => {
    const promo = read("packages/utils/src/promo.ts");
    const promoService = read("apps/api/src/services/promoCodeService.ts");
    const payment = read("apps/api/src/services/paymentService.ts");
    const shopCheckout = payment.slice(payment.indexOf("async function createShopCheckoutSession"));
    assert.match(promo, /shop:remote-source-bed-kit/);
    assert.match(promo, /shop:digital-safeguard-kit/);
    assert.match(promo, /shop:healing-code-cards-source-deck-body-set/);
    assert.match(promo, /shop:healing-code-cards-body-deck/);
    assert.match(promo, /shop:healing-code-cards-mind-deck/);
    assert.match(promo, /shop:healing-code-cards-energy-deck/);
    assert.match(promoService, /buildShopPromoTarget/);
    assert.match(promoService, /type === "shop"/);
    assert.match(promoService, /addShopProductsToPromoTargetIndex/);
    assert.match(shopCheckout, /validatePromoForCheckout/);
    assert.match(shopCheckout, /type: "shop"/);
    assert.match(shopCheckout, /buildCheckoutDiscountConfig\(promo\)/);
  });

  it("shop nav dropdown reads the featured catalog and widens the Shop panel", () => {
    const layout = read("apps/web/src/layouts/RootLayout.tsx");
    assert.match(layout, /\/shop\/products\?featured=true/);
    assert.match(layout, /unwrapShopProducts/);
    assert.match(layout, /min-w-\[22rem\]/);
    assert.match(layout, /max-w-\[26rem\]/);
    assert.match(layout, /whitespace-normal/);
    assert.match(layout, /href: "\/shop"/);
  });

  it("keeps Shop tables out of startup schema repair", () => {
    const server = read("apps/api/src/server.ts");
    assert.equal(server.includes("shop_products"), false);
    const repair = read("apps/api/src/services/schemaRepairService.ts");
    assert.equal(repair.includes("shop_products"), false);
  });
});
