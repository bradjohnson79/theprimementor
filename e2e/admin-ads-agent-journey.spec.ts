import { expect, test } from "@playwright/test";
import { adminAuthSkipReason, adminBaseUrl } from "./helpers/adminAuth.ts";

const ADMIN_BASE = adminBaseUrl();
const AUTH_SKIP = adminAuthSkipReason();

test.describe("Admin Ads Agent live journey gates", () => {
  test.setTimeout(180_000);

  test("reload keeps the conversation and does not leak provider calls", async ({ page }) => {
    test.skip(Boolean(AUTH_SKIP), AUTH_SKIP || "Admin Clerk test session is required");
    const leaked: string[] = [];
    const failedFetch: string[] = [];
    page.on("request", (request) => {
      if (/openrouter\.ai|googleads\.googleapis\.com/.test(request.url())) leaked.push(request.url());
    });
    page.on("console", (message) => {
      if (/Failed to fetch|CORS/i.test(message.text())) failedFetch.push(message.text());
    });

    await page.goto(`${ADMIN_BASE}/admin/ads`);
    await page.locator("[data-ads-agent-rail]").click();
    await expect(page.locator("[data-ads-agent-drawer]")).toBeVisible();
    await page.getByPlaceholder("Ask the Ads Agent…").fill("Name the connected advertising account ID only.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.locator("[data-ads-agent-assistant]").first()).toBeVisible({ timeout: 185_000 });
    await page.reload();
    await page.locator("[data-ads-agent-rail]").click();
    await expect(page.locator("[data-ads-agent-drawer]")).toBeVisible();
    await expect(page.locator("[data-ads-agent-assistant]").first()).toBeVisible();
    await expect(page.locator("[data-ads-agent-progress]")).toHaveCount(0);
    expect(leaked).toEqual([]);
    expect(failedFetch).toEqual([]);
  });

  test("provider timeout shows a normalized error and Send recovers", async ({ page }) => {
    test.skip(Boolean(AUTH_SKIP), AUTH_SKIP || "Admin Clerk test session is required");
    await page.route("**/api/admin/ads/agent/chat", async (route) => {
      await route.fulfill({
        status: 504,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": new URL(ADMIN_BASE!).origin },
        body: JSON.stringify({
          success: false,
          error: "Ads Agent provider timed out. Please retry.",
          data: { code: "OPENROUTER_TIMEOUT" },
        }),
      });
    });
    await page.goto(`${ADMIN_BASE}/admin/ads`);
    await page.locator("[data-ads-agent-rail]").click();
    await page.getByPlaceholder("Ask the Ads Agent…").fill("Simulate a timeout.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.locator("[data-ads-agent-error]")).toBeVisible();
    await expect(page.getByText(/timed out|unavailable/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByText("Failed to fetch")).toHaveCount(0);
    await page.unroute("**/api/admin/ads/agent/chat");
    await expect(page.getByRole("button", { name: "Retry" })).toBeEnabled();
    await page.getByPlaceholder("Ask the Ads Agent…").fill("Retry after timeout.");
    await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
  });
});
