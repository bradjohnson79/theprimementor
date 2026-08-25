import { expect, test, type Locator, type Page } from "@playwright/test";
import { cleanupEphemeralGalleryProducts, getShopLocalhostDb, insertEphemeralGalleryProduct } from "./helpers/shopFeaturedToggle";

const API_BASE = process.env.SHOP_API_BASE_URL?.trim() || "http://127.0.0.1:3001";
const AGAINST_PRODUCTION = Boolean(process.env.PLAYWRIGHT_BASE_URL?.includes("theprimementor.com") || process.env.SHOP_SKIP_FEATURED_MUTATION === "1");

const EXPECTED_GALLERY_SLUGS = [
  "remote-source-bed-kit",
  "digital-safeguard-kit",
  "healing-code-cards-source-deck-body-set",
  "healing-code-cards-body-deck",
  "healing-code-cards-mind-deck",
  "healing-code-cards-energy-deck",
];

type CatalogProduct = {
  slug?: string;
  name?: string;
  formatLabel?: string;
  quickSummary?: string | null;
  priceLabel?: string;
};

function unwrapProducts(body: unknown): CatalogProduct[] {
  if (Array.isArray(body)) return body as CatalogProduct[];
  if (body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)) {
    return (body as { data: CatalogProduct[] }).data;
  }
  return [];
}

async function loadFeaturedCatalog(request: { get: (url: string) => Promise<{ ok: () => boolean; json: () => Promise<unknown> }> }) {
  try {
    const response = await request.get(`${API_BASE}/api/shop/products?featured=true`);
    if (!response.ok()) return [];
    return unwrapProducts(await response.json());
  } catch {
    return [];
  }
}

async function visibleCardCount(scroller: Locator) {
  const box = await scroller.boundingBox();
  if (!box) return 0;
  const cards = scroller.locator("[data-shop-gallery-card]");
  let visible = 0;
  for (const card of await cards.all()) {
    const cardBox = await card.boundingBox();
    if (!cardBox) continue;
    const overlap = Math.min(cardBox.x + cardBox.width, box.x + box.width) - Math.max(cardBox.x, box.x);
    if (overlap > Math.min(cardBox.width, box.width) * 0.4) visible += 1;
  }
  return visible;
}

async function openHomepageGallery(page: Page) {
  await page.goto("/");
  await expect(page.locator("#hero")).toBeVisible();
}

test.describe("Homepage featured product gallery", () => {
  test("desktop gallery sits under the hero and opens a catalog product", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop layout and arrow motion");
    const catalog = await loadFeaturedCatalog(request);
    test.skip(catalog.length === 0, "Local API featured catalog is unavailable on :3001");

    await openHomepageGallery(page);
    const gallery = page.locator("#home-shop-gallery");
    await expect(gallery).toBeVisible();
    const galleryBox = await gallery.boundingBox();
    const heroBox = await page.locator("#hero").boundingBox();
    expect(galleryBox && heroBox, "Gallery must render immediately under the hero").toBeTruthy();
    expect(galleryBox!.y).toBeGreaterThan(heroBox!.y);
    await expect(gallery.getByRole("heading", { name: "Explore the Prime Mentor Shop" })).toBeVisible();
    const authNote = gallery.locator("[data-shop-gallery-auth-note]");
    await expect(authNote).toBeVisible();
    await expect(authNote.getByRole("link", { name: "Create a free account" })).toHaveAttribute("href", "/sign-up");
    await expect(authNote.getByRole("link", { name: "sign in" })).toHaveAttribute("href", "/sign-in");

    const liveCatalog = catalog.filter((item) => EXPECTED_GALLERY_SLUGS.includes(item.slug || ""));
    expect(liveCatalog.map((item) => item.slug)).toEqual(EXPECTED_GALLERY_SLUGS);
    await expect.poll(async () => {
      const names = await gallery.locator("[data-shop-gallery-card] h3").allTextContents();
      return names.filter((name) => liveCatalog.some((item) => item.name === name));
    }).toEqual(liveCatalog.map((item) => item.name));

    const expectedNames = liveCatalog.map((item) => item.name!);
    for (const name of expectedNames) {
      const product = catalog.find((item) => item.name === name);
      expect(product, `${name} must come from the featured catalog`).toBeTruthy();
      const card = gallery.locator("[data-shop-gallery-card]").filter({ hasText: name });
      await expect(card).toHaveCount(1);
      await expect(card.locator("[data-shop-gallery-format]")).toHaveText(product!.formatLabel || "Digital Edition");
      await expect(card.getByText(product!.priceLabel || "", { exact: true })).toBeVisible();
      await expect(card.getByText("View Product")).toBeVisible();
      if (product?.quickSummary) {
        await expect(card.locator("[data-shop-gallery-summary]")).toContainText(product.quickSummary.slice(0, 24));
      }
      await expect(card.locator("img").first()).toBeVisible();
    }

    const scroller = gallery.locator("[data-shop-gallery-scroller]");
    const orderBefore = await scroller.locator("[data-shop-gallery-card] h3").allTextContents();
    const before = await scroller.evaluate((node) => node.scrollLeft);
    await gallery.getByRole("button", { name: "Next products" }).click();
    await expect.poll(async () => scroller.evaluate((node) => node.scrollLeft)).toBeGreaterThan(before);
    await gallery.getByRole("button", { name: "Previous products" }).click();
    await expect.poll(async () => scroller.evaluate((node) => node.scrollLeft)).toBeLessThan(80);
    await expect(scroller.locator("[data-shop-gallery-card] h3")).toHaveText(orderBefore);

    const firstProduct = liveCatalog[0];
    await gallery.getByRole("link", { name: `View ${firstProduct.name}` }).click();
    await expect(page).toHaveURL(new RegExp(`/shop/${firstProduct.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: firstProduct.name! })).toBeVisible();
    await page.goBack();
    await expect(page.locator("#home-shop-gallery")).toBeVisible();
  });

  test("tablet and mobile show a readable bounded gallery without page overflow", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Viewport card-count coverage");
    const catalog = await loadFeaturedCatalog(request);
    test.skip(catalog.length === 0, "Local API featured catalog is unavailable on :3001");

    await openHomepageGallery(page);
    const gallery = page.locator("#home-shop-gallery");
    await expect(gallery.getByRole("heading", { name: "Explore the Prime Mentor Shop" })).toBeVisible();
    const authNote = gallery.locator("[data-shop-gallery-auth-note]");
    await expect(authNote).toBeVisible();
    await expect(authNote.getByRole("link", { name: "Create a free account" })).toHaveAttribute("href", "/sign-up");
    await expect(authNote.getByRole("link", { name: "sign in" })).toHaveAttribute("href", "/sign-in");
    const scroller = gallery.locator("[data-shop-gallery-scroller]");
    const visible = await visibleCardCount(scroller);
    if (testInfo.project.name === "mobile") {
      expect(visible).toBeGreaterThanOrEqual(1);
      expect(visible).toBeLessThanOrEqual(2);
    } else {
      expect(visible).toBeGreaterThanOrEqual(2);
      expect(visible).toBeLessThanOrEqual(3);
    }
    const liveCatalog = catalog.filter((item) => EXPECTED_GALLERY_SLUGS.includes(item.slug || ""));
    await expect.poll(async () => {
      const names = await scroller.locator("[data-shop-gallery-card] h3").allTextContents();
      return names.filter((name) => liveCatalog.some((item) => item.name === name));
    }).toEqual(liveCatalog.map((item) => item.name));
    expect(liveCatalog[0]?.name).toBe("Remote Source Bed Kit");
    await scroller.evaluate((node) => node.scrollBy({ left: 160 }));
    await expect.poll(async () => {
      const names = await scroller.locator("[data-shop-gallery-card] h3").allTextContents();
      return names.filter((name) => liveCatalog.some((item) => item.name === name));
    }).toEqual(liveCatalog.map((item) => item.name));
    const firstCard = scroller.locator("[data-shop-gallery-card]").first();
    await expect(firstCard.getByText("View Product")).toBeVisible();
    const summary = firstCard.locator("[data-shop-gallery-summary]");
    if (await summary.count()) {
      const height = await summary.evaluate((node) => (node as HTMLElement).clientHeight);
      expect(height).toBeGreaterThanOrEqual(48);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThan(8);
  });

  test("gallery heading, images, and arrows are keyboard reachable", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Keyboard focus coverage");
    const catalog = await loadFeaturedCatalog(request);
    test.skip(catalog.length === 0, "Local API featured catalog is unavailable on :3001");

    await openHomepageGallery(page);
    const gallery = page.locator("#home-shop-gallery");
    await expect(gallery.getByRole("heading", { name: "Explore the Prime Mentor Shop" })).toBeVisible();
    await expect(gallery.locator("img").first()).toHaveAttribute("alt", /.+/);
    await gallery.getByRole("button", { name: "Previous products" }).focus();
    await expect(gallery.getByRole("button", { name: "Previous products" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(gallery.getByRole("button", { name: "Next products" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(gallery.locator("[data-shop-gallery-card]").first()).toBeFocused();
  });

  test("featured persist removes and restores a catalog product on the homepage", async ({ page }, testInfo) => {
    test.skip(AGAINST_PRODUCTION, "Do not mutate featured flags on production");
    test.skip(testInfo.project.name !== "desktop", "Persist proof once on desktop");
    if (!getShopLocalhostDb()) {
      test.skip(true, "DATABASE_URL is unavailable; Admin Playwright UI stays Clerk-gated and was not bypassed.");
      return;
    }

    const persistName = "Ephemeral Gallery Persist Product";
    await cleanupEphemeralGalleryProducts();
    const created = await insertEphemeralGalleryProduct({
      slug: "persist-card",
      name: persistName,
      featured: true,
      isActive: true,
    });
    expect(created).toBeTruthy();

    try {
      await openHomepageGallery(page);
      const gallery = page.locator("#home-shop-gallery");
      await expect(gallery.getByRole("link", { name: `View ${persistName}` })).toHaveCount(1);

      await insertEphemeralGalleryProduct({
        slug: "persist-card",
        name: persistName,
        featured: false,
        isActive: true,
      });
      await page.reload();
      await expect(page.locator("#home-shop-gallery").getByRole("link", { name: `View ${persistName}` })).toHaveCount(0);

      await insertEphemeralGalleryProduct({
        slug: "persist-card",
        name: persistName,
        featured: true,
        isActive: true,
      });
      await page.reload();
      await expect(page.locator("#home-shop-gallery").getByRole("link", { name: `View ${persistName}` })).toHaveCount(1);
    } finally {
      await cleanupEphemeralGalleryProducts();
    }
  });

  test("captures homepage gallery screenshots for visual review", async ({ page, request }, testInfo) => {
    const catalog = await loadFeaturedCatalog(request);
    test.skip(catalog.length === 0, "Local API featured catalog is unavailable on :3001");
    await openHomepageGallery(page);
    const gallery = page.locator("#home-shop-gallery");
    await expect(gallery).toBeVisible();
    await gallery.scrollIntoViewIfNeeded();
    await gallery.screenshot({
      path: `test-results/home-shop-gallery-${testInfo.project.name}.png`,
      animations: "disabled",
    });
  });
});
