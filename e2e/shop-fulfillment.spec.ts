import { expect, test } from "@playwright/test";

const API_BASE = process.env.SHOP_API_BASE_URL?.trim() || "http://127.0.0.1:3001";

test.describe("Shop digital fulfillment success page", () => {
  test("success page asks signed-out buyers to sign in and never invents a download", async ({ page }) => {
    await page.goto("/shop/order/success?session_id=cs_test_invalid&download=https://drive.google.com/drive/folders/fake&paid=true&product=body");
    await expect(page.getByRole("heading", { name: /thank you for your order/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in to open your download/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /return to shop/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /download your product/i })).toHaveCount(0);
    await expect(page.locator("a[href*='drive.google.com']")).toHaveCount(0);
  });

  test("legacy /shop/success alias still renders the reusable thank-you page", async ({ page }) => {
    await page.goto("/shop/success?checkoutSessionId=cs_test_invalid");
    await expect(page.getByRole("heading", { name: /thank you for your order/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /return to shop/i })).toBeVisible();
  });

  test("public catalog still omits every Drive fulfillment URL", async ({ request }) => {
    let response;
    try {
      response = await request.get(`${API_BASE}/api/shop/products`);
    } catch {
      test.skip(true, "Local API is not running on :3001");
      return;
    }
    if (!response.ok()) {
      test.skip(true, `Local API GET /api/shop/products returned ${response.status()}`);
      return;
    }
    const body = await response.text();
    expect(body).not.toContain("drive.google.com");
    expect(body).not.toContain("1SJw4BK9jWK0yzSol9bdNc6EiVTALMWJK");
    expect(body).not.toContain("1AzNBGO807C9b_JiIn_ldvSRGr1D37UzW");
  });
});
