import { expect, test } from "@playwright/test";

const API_BASE = process.env.SHOP_API_BASE_URL?.trim() || "http://127.0.0.1:3001";

const PRODUCTS = [
  { slug: "healing-code-cards-body-deck", name: "Healing Code Cards: Body Deck", price: "$24.99 CAD" },
  { slug: "healing-code-cards-mind-deck", name: "Healing Code Cards: Mind Deck", price: "$24.99 CAD" },
  { slug: "healing-code-cards-energy-deck", name: "Healing Code Cards: Energy Deck", price: "$24.99 CAD" },
  { slug: "healing-code-cards-source-deck-body-set", name: "Healing Code Cards: Source Deck — Body Set", price: "$24.99 CAD" },
  { slug: "digital-safeguard-kit", name: "Digital Safeguard Kit", price: "$29.99 CAD" },
  { slug: "remote-source-bed-kit", name: "Remote Source Bed Kit", price: "$69.99 CAD" },
] as const;

test.describe("Shop purchase CTA pipeline", () => {
  test("signed-out Purchase sends the user to sign-in with a resume path", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Signed-out resume path once on desktop");
    await page.goto("/shop/healing-code-cards-body-deck");
    const cta = page.getByRole("button", { name: /purchase/i });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/sign-in\?redirect_url=/);
    expect(decodeURIComponent(page.url())).toContain("/shop/healing-code-cards-body-deck?purchase=1");
  });

  test("unauthenticated checkout is rejected and ignores client price fields", async ({ request }) => {
    let response;
    try {
      response = await request.post(`${API_BASE}/api/shop/checkout`, {
        data: {
          productId: "00000000-0000-0000-0000-000000000000",
          amount: 1,
          stripePriceId: "price_client_forged",
        },
      });
    } catch {
      test.skip(true, "Local API is not running on :3001");
      return;
    }
    expect(response.status()).toBeGreaterThanOrEqual(401);
    const body = await response.text();
    expect(body).not.toContain("checkout.stripe.com");
  });

  for (const product of PRODUCTS) {
    test(`product page CTA is visible for ${product.name}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === "tablet" && product.slug !== "healing-code-cards-body-deck", "Representative tablet coverage");
      test.skip(testInfo.project.name === "mobile" && product.slug !== "remote-source-bed-kit", "Representative mobile coverage");
      await page.goto(`/shop/${product.slug}`);
      await expect(page.getByRole("heading", { level: 1, name: product.name })).toBeVisible();
      await expect(page.getByText(product.price).first()).toBeVisible();
      const cta = page.getByRole("button", { name: new RegExp(`Purchase .+ — ${product.price.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) });
      await expect(cta).toBeVisible();
      const box = await cta.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThan(36);
      await page.screenshot({
        path: `test-results/shop-checkout-${product.slug}-${testInfo.project.name}.png`,
        animations: "disabled",
      });
    });
  }

  test("homepage gallery View Product reaches the same purchase CTA", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Homepage path once on desktop");
    await page.goto("/");
    const gallery = page.locator("#home-shop-gallery");
    await expect(gallery).toBeVisible();
    await gallery.getByRole("link", { name: /View Healing Code Cards: Body Deck/ }).click();
    await expect(page).toHaveURL(/\/shop\/healing-code-cards-body-deck$/);
    await expect(page.getByRole("button", { name: /purchase/i })).toBeVisible();
  });

  test("shop landing View Product reaches the same purchase CTA", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Shop landing path once on desktop");
    await page.goto("/shop");
    await page.getByRole("link", { name: "View Product" }).first().click();
    await expect(page).toHaveURL(/\/shop\/.+/);
    await expect(page.getByRole("button", { name: /purchase/i })).toBeVisible();
  });

  test("fake paid query does not grant a download", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    await page.goto("/shop/order/success?session_id=cs_does_not_exist&paid=true&download=https://drive.google.com/drive/folders/wrong");
    await expect(page.getByRole("link", { name: /download your product/i })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("1SJw4BK9jWK0yzSol9bdNc6EiVTALMWJK");
  });
});
