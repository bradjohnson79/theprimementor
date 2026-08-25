import { expect, test } from "@playwright/test";
import {
  cleanupEphemeralGalleryProducts,
  getShopLocalhostDb,
  insertEphemeralGalleryProduct,
} from "./helpers/shopFeaturedToggle";

const API_BASE = process.env.SHOP_API_BASE_URL?.trim() || "http://127.0.0.1:3001";

function unwrapProducts(body: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(body)) return body as Array<Record<string, unknown>>;
  if (body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)) {
    return (body as { data: Array<Record<string, unknown>> }).data;
  }
  return [];
}

test.describe("Shop catalog API trust", () => {
  test("public catalog exposes Body Deck and Mind Deck without Stripe IDs to the client", async ({ request }) => {
    let response;
    try {
      response = await request.get(`${API_BASE}/api/shop/products`);
    } catch {
      test.skip(true, "Local API is not running on :3001. Start pnpm --filter @wisdom/api dev to certify catalog reads.");
      return;
    }
    if (!response.ok()) {
      test.skip(true, `Local API GET /api/shop/products returned ${response.status()}`);
      return;
    }

    const body = await response.json() as { data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
    const products = Array.isArray(body)
      ? body
      : Array.isArray(body.data)
        ? body.data
        : [];
    const bodyDeck = products.find((product) => product.slug === "healing-code-cards-body-deck");
    expect(bodyDeck, "Body Deck must exist in the Shop catalog").toBeTruthy();
    expect(bodyDeck?.name).toBe("Healing Code Cards: Body Deck");
    expect(bodyDeck?.priceCents).toBe(2499);
    expect(bodyDeck?.currency).toBe("CAD");
    expect(bodyDeck?.priceLabel).toBe("$24.99 CAD");
    expect(bodyDeck?.formatLabel).toBe("Digital Edition");
    expect(JSON.stringify(bodyDeck)).not.toContain("price_1U6awqAd5V3LaCqjYPtzgvir");
    expect(JSON.stringify(bodyDeck)).not.toMatch(/"stripePriceId"/);

    const mindDeck = products.find((product) => product.slug === "healing-code-cards-mind-deck");
    expect(mindDeck, "Mind Deck must exist in the Shop catalog").toBeTruthy();
    expect(mindDeck?.name).toBe("Healing Code Cards: Mind Deck");
    expect(mindDeck?.priceCents).toBe(2499);
    expect(mindDeck?.currency).toBe("CAD");
    expect(mindDeck?.priceLabel).toBe("$24.99 CAD");
    expect(mindDeck?.formatLabel).toBe("Digital Edition");
    expect(JSON.stringify(mindDeck)).not.toContain("price_1U6br5Ad5V3LaCqj7AUstqit");
    expect(JSON.stringify(mindDeck)).not.toMatch(/"stripePriceId"/);

    const energyDeck = products.find((product) => product.slug === "healing-code-cards-energy-deck");
    expect(energyDeck, "Energy Deck must exist in the Shop catalog").toBeTruthy();
    expect(energyDeck?.name).toBe("Healing Code Cards: Energy Deck");
    expect(energyDeck?.formatLabel).toBe("Digital Edition");
    expect(energyDeck?.quickSummary).toMatch(/44-card digital spiritual wellness deck/i);
    expect(energyDeck?.awaitingDeckAssets).toBe(true);
    expect(energyDeck?.awaitingBooklet).toBe(false);
    expect(energyDeck?.canPurchase).toBe(true);
    expect(JSON.stringify(energyDeck)).not.toContain("price_1U85OFAd5V3LaCqjUt1e8CXA");
    expect(energyDeck?.publicBooklet).toMatchObject({
      displayName: "Energy Deck Instruction Booklet",
      url: "/api/shop/products/healing-code-cards-energy-deck/booklet",
    });
    expect(JSON.stringify(energyDeck)).not.toMatch(/"stripePriceId"/);
    expect(JSON.stringify(energyDeck)).not.toMatch(/STRIPE_ENERGY_DECK_PRICE_ID/);
    expect(energyDeck?.videoUrl).toMatch(/youtube\.com\/live\/_DniHEzLgps/);
    expect(energyDeck?.videoEmbedUrl).toMatch(/youtube-nocookie\.com\/embed\/_DniHEzLgps/);

    const sourceDeck = products.find((product) => product.slug === "healing-code-cards-source-deck-body-set");
    expect(sourceDeck, "Source Deck must exist in the Shop catalog").toBeTruthy();
    expect(sourceDeck?.name).toBe("Healing Code Cards: Source Deck — Body Set");
    expect(sourceDeck?.formatLabel).toBe("Digital Edition");
    expect(sourceDeck?.quickSummary).toMatch(/28-card digital spiritual wellness deck/i);
    expect(sourceDeck?.awaitingDeckAssets).toBe(true);
    expect(sourceDeck?.awaitingBooklet).toBe(false);
    expect(sourceDeck?.canPurchase).toBe(true);
    expect(sourceDeck?.priceCents).toBe(2499);
    expect(sourceDeck?.priceLabel).toBe("$24.99 CAD");
    expect(JSON.stringify(sourceDeck)).not.toContain("price_1U85gSAd5V3LaCqjVjszTGEo");
    expect(sourceDeck?.publicBooklet).toMatchObject({
      displayName: "Source Deck — Body Set User's Manual",
      url: "/api/shop/products/healing-code-cards-source-deck-body-set/booklet",
    });
    expect(JSON.stringify(sourceDeck)).not.toMatch(/"stripePriceId"/);
    expect(JSON.stringify(sourceDeck)).not.toMatch(/STRIPE_SOURCE_DECK_PRICE_ID/);
    expect(JSON.stringify(sourceDeck)).not.toMatch(/AetherX Source Deck/);
    expect(JSON.stringify(products)).not.toMatch(/"stripePriceId"/);

    const safeguardKit = products.find((product) => product.slug === "digital-safeguard-kit");
    expect(safeguardKit, "Digital Safeguard Kit must exist in the Shop catalog").toBeTruthy();
    expect(safeguardKit?.name).toBe("Digital Safeguard Kit");
    expect(safeguardKit?.subtitle).toBe("Personal & Environmental Safeguard Sets");
    expect(safeguardKit?.formatLabel).toBe("Digital Edition");
    expect(safeguardKit?.priceCents).toBe(2999);
    expect(safeguardKit?.priceLabel).toBe("$29.99 CAD");
    expect(safeguardKit?.canPurchase).toBe(true);
    expect(safeguardKit?.awaitingBooklet).toBe(false);
    expect(safeguardKit?.awaitingDeckAssets).toBe(true);
    expect(safeguardKit?.collection).toBe("digital-wellness-tools");
    expect(safeguardKit?.publicBooklet).toMatchObject({
      displayName: "Digital Safeguard Kit Instructions",
      url: "/api/shop/products/digital-safeguard-kit/booklet",
    });
    expect(JSON.stringify(safeguardKit)).not.toContain("price_1U85usAd5V3LaCqjPtqyWS0a");
    expect(JSON.stringify(safeguardKit)).not.toMatch(/"stripePriceId"/);
    expect(JSON.stringify(safeguardKit)).not.toMatch(/STRIPE_DIGITAL_SAFEGUARD_KIT_PRICE_ID/);

    const sourceBedKit = products.find((product) => product.slug === "remote-source-bed-kit");
    expect(sourceBedKit, "Remote Source Bed Kit must exist in the Shop catalog").toBeTruthy();
    expect(sourceBedKit?.name).toBe("Remote Source Bed Kit");
    expect(sourceBedKit?.subtitle).toBe("Printable Digital Edition");
    expect(sourceBedKit?.formatLabel).toBe("Printable Digital Edition");
    expect(sourceBedKit?.priceCents).toBe(6999);
    expect(sourceBedKit?.priceLabel).toBe("$69.99 CAD");
    expect(sourceBedKit?.canPurchase).toBe(true);
    expect(sourceBedKit?.awaitingBooklet).toBe(false);
    expect(sourceBedKit?.hasSecureManual).toBe(true);
    expect(sourceBedKit?.publicBooklet).toBeNull();
    expect(sourceBedKit?.collection).toBe("digital-wellness-tools");
    expect(sourceBedKit?.videoUrl).toMatch(/youtu\.be\/WT0bY_Vme94/);
    expect(sourceBedKit?.videoEmbedUrl).toMatch(/youtube-nocookie\.com\/embed\/WT0bY_Vme94/);
    expect(sourceBedKit?.videoHeading).toBe("How to Set Up Your Remote Source Bed Kit");
    expect(JSON.stringify(sourceBedKit)).not.toContain("price_1U863FAd5V3LaCqjxdjoXqq5");
    expect(JSON.stringify(sourceBedKit)).not.toMatch(/"stripePriceId"/);
    expect(JSON.stringify(sourceBedKit)).not.toMatch(/STRIPE_REMOTE_SOURCE_BED_KIT_PRICE_ID/);
    expect(JSON.stringify(products)).not.toContain("drive.google.com");
    expect(JSON.stringify(products)).not.toMatch(/fulfillmentDownloadUrl/);
    expect(JSON.stringify(products)).not.toMatch(/fulfillment_download_url/);
  });

  test("Energy Deck public booklet is downloadable and deck files stay locked", async ({ request }) => {
    let booklet;
    try {
      booklet = await request.get(`${API_BASE}/api/shop/products/healing-code-cards-energy-deck/booklet`);
    } catch {
      test.skip(true, "Local API is not running on :3001");
      return;
    }
    expect(booklet.ok()).toBeTruthy();
    expect(booklet.headers()["content-type"]).toMatch(/pdf/i);
    expect(booklet.headers()["content-disposition"]).toMatch(/Energy Deck Instruction Booklet/);
    const bytes = await booklet.body();
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");

    const token = await request.post(`${API_BASE}/api/shop/downloads/not-a-file/token`);
    expect(token.status()).toBeGreaterThanOrEqual(401);
  });

  test("Source Deck public manual is downloadable and deck files stay locked", async ({ request }) => {
    let booklet;
    try {
      booklet = await request.get(`${API_BASE}/api/shop/products/healing-code-cards-source-deck-body-set/booklet`);
    } catch {
      test.skip(true, "Local API is not running on :3001");
      return;
    }
    expect(booklet.ok()).toBeTruthy();
    expect(booklet.headers()["content-type"]).toMatch(/pdf/i);
    expect(booklet.headers()["content-disposition"]).toMatch(/Source Deck/);
    const bytes = await booklet.body();
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");

    const token = await request.post(`${API_BASE}/api/shop/downloads/not-a-file/token`);
    expect(token.status()).toBeGreaterThanOrEqual(401);
  });

  test("Remote Source Bed Kit instruction manual is not a public booklet", async ({ request }) => {
    let booklet;
    try {
      booklet = await request.get(`${API_BASE}/api/shop/products/remote-source-bed-kit/booklet`);
    } catch {
      test.skip(true, "Local API is not running on :3001");
      return;
    }
    expect(booklet.status()).toBeGreaterThanOrEqual(400);

    const token = await request.post(`${API_BASE}/api/shop/downloads/not-a-file/token`);
    expect(token.status()).toBeGreaterThanOrEqual(401);
  });

  test("Digital Safeguard Kit public manual is downloadable and kit files stay locked", async ({ request }) => {
    let booklet;
    try {
      booklet = await request.get(`${API_BASE}/api/shop/products/digital-safeguard-kit/booklet`);
    } catch {
      test.skip(true, "Local API is not running on :3001");
      return;
    }
    expect(booklet.ok()).toBeTruthy();
    expect(booklet.headers()["content-type"]).toMatch(/pdf/i);
    expect(booklet.headers()["content-disposition"]).toMatch(/Digital Safeguard Kit Instructions/);
    const bytes = await booklet.body();
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");

    const token = await request.post(`${API_BASE}/api/shop/downloads/not-a-file/token`);
    expect(token.status()).toBeGreaterThanOrEqual(401);
  });

  test("public product detail includes shared testimonials without private admin fields", async ({ request }) => {
    let response;
    try {
      response = await request.get(`${API_BASE}/api/shop/products/healing-code-cards-body-deck`);
    } catch {
      test.skip(true, "Local API is not running on :3001");
      return;
    }
    if (!response.ok()) {
      test.skip(true, `Local API GET /api/shop/products/:slug returned ${response.status()}`);
      return;
    }
    const body = await response.json() as { data?: Record<string, unknown> } | Record<string, unknown>;
    const product = (body && typeof body === "object" && "data" in body ? body.data : body) as Record<string, unknown>;
    const testimonials = Array.isArray(product.testimonials) ? product.testimonials as Array<Record<string, unknown>> : [];
    if (testimonials.length === 0) {
      test.skip(true, "Testimonials have not been seeded on shop-localhost yet.");
      return;
    }
    const names = testimonials.map((item) => item.customerName);
    expect(names).toContain("Barb Salerno");
    expect(names).toContain("Alice Bacon");
    expect(testimonials.length).toBeGreaterThan(2);
    expect(JSON.stringify(testimonials)).not.toMatch(/"isActive"/);
    expect(JSON.stringify(testimonials)).not.toMatch(/"productIds"/);
    expect(JSON.stringify(testimonials)).not.toMatch(/"sourceLabel"/);
    expect(JSON.stringify(testimonials)).not.toMatch(/face cloth|t-shirts|Aether Bed Trial Symbol/i);
    expect(product.testimonialSection).toMatchObject({
      heading: expect.stringMatching(/what customers are saying/i),
      disclaimer: expect.stringMatching(/individual personal experiences/i),
    });
    const related = Array.isArray(product.relatedProducts) ? product.relatedProducts as Array<Record<string, unknown>> : [];
    expect(related.map((item) => item.slug)).not.toContain("healing-code-cards-body-deck");
    expect(related.map((item) => item.slug)).toEqual(expect.arrayContaining([
      "healing-code-cards-mind-deck",
      "healing-code-cards-energy-deck",
      "healing-code-cards-source-deck-body-set",
    ]));
  });

  test("unauthenticated fulfillment lookup is rejected and does not leak a download URL", async ({ request }) => {
    let response;
    try {
      response = await request.get(`${API_BASE}/api/shop/order/success?session_id=cs_test_invalid&product=body&download=https://drive.google.com/drive/folders/fake&paid=true`);
    } catch {
      test.skip(true, "Local API is not running on :3001");
      return;
    }
    expect(response.status()).toBeGreaterThanOrEqual(401);
    const body = await response.text();
    expect(body).not.toContain("drive.google.com");
    expect(body).not.toContain("fulfillmentDownloadUrl");
  });

  test("admin fulfillment resend requires admin auth", async ({ request }) => {
    let response;
    try {
      response = await request.post(`${API_BASE}/api/admin/shop/orders/not-a-real-order/resend-fulfillment-email`);
    } catch {
      test.skip(true, "Local API is not running on :3001");
      return;
    }
    expect(response.status()).toBeGreaterThanOrEqual(401);
  });

  test("unauthenticated checkout is rejected", async ({ request }) => {
    let response;
    try {
      response = await request.post(`${API_BASE}/api/shop/checkout`, {
        data: { productId: "not-a-real-id", amount: 1, stripePriceId: "price_client_supplied" },
      });
    } catch {
      test.skip(true, "Local API is not running on :3001");
      return;
    }
    expect(response.status()).toBeGreaterThanOrEqual(401);
  });

  test("featured=true returns only featured active products and omits fulfillment URLs", async ({ request }, testInfo) => {
    let response;
    try {
      response = await request.get(`${API_BASE}/api/shop/products?featured=true`);
    } catch {
      test.skip(true, "Local API is not running on :3001");
      return;
    }
    if (!response.ok()) {
      test.skip(true, `Local API GET /api/shop/products?featured=true returned ${response.status()}`);
      return;
    }

    const products = unwrapProducts(await response.json());
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((product) => product.featured === true)).toBeTruthy();
    expect(JSON.stringify(products)).not.toContain("drive.google.com");
    expect(JSON.stringify(products)).not.toMatch(/fulfillmentDownloadUrl/);
    expect(JSON.stringify(products)).not.toMatch(/fulfillment_download_url/);

    if (!getShopLocalhostDb()) {
      test.info().annotations.push({
        type: "note",
        description: "DATABASE_URL unavailable; skipped unfeatured/inactive persist proof.",
      });
      return;
    }

    const suffix = `${testInfo.project.name}-${testInfo.workerIndex}`;
    const unfeatured = await insertEphemeralGalleryProduct({
      slug: `unfeatured-active-${suffix}`,
      name: "Gallery Persist Unfeatured",
      featured: false,
      isActive: true,
    });
    const inactive = await insertEphemeralGalleryProduct({
      slug: `featured-inactive-${suffix}`,
      name: "Gallery Persist Inactive",
      featured: true,
      isActive: false,
      status: "active",
    });
    expect(unfeatured, "Could not insert unfeatured persist product on shop-localhost").toBeTruthy();
    expect(inactive, "Could not insert inactive persist product on shop-localhost").toBeTruthy();

    try {
      const featuredOnly = unwrapProducts(await (await request.get(`${API_BASE}/api/shop/products?featured=true`)).json());
      const fullCatalog = unwrapProducts(await (await request.get(`${API_BASE}/api/shop/products`)).json());
      expect(featuredOnly.some((product) => product.slug === unfeatured?.slug)).toBeFalsy();
      expect(fullCatalog.some((product) => product.slug === unfeatured?.slug)).toBeTruthy();
      expect(featuredOnly.some((product) => product.slug === inactive?.slug)).toBeFalsy();
      expect(fullCatalog.some((product) => product.slug === inactive?.slug)).toBeFalsy();
    } finally {
      await cleanupEphemeralGalleryProducts();
    }
  });

  test("admin shop mutations require admin auth", async ({ request }) => {
    let response;
    try {
      response = await request.post(`${API_BASE}/api/admin/shop/products`, {
        data: { name: "Unauthorized product" },
      });
    } catch {
      test.skip(true, "Local API is not running on :3001");
      return;
    }
    expect(response.status()).toBeGreaterThanOrEqual(401);
  });

  test("admin testimonial mutations require admin auth", async ({ request }) => {
    let response;
    try {
      response = await request.post(`${API_BASE}/api/admin/shop/testimonials`, {
        data: { customerName: "Unauthorized", testimonialText: "Should not persist." },
      });
    } catch {
      test.skip(true, "Local API is not running on :3001");
      return;
    }
    expect(response.status()).toBeGreaterThanOrEqual(401);
  });
});
