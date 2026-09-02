import { expect, test } from "@playwright/test";
import { adminAuthSkipReason, adminBaseUrl } from "./helpers/adminAuth.ts";

const ADMIN_BASE = adminBaseUrl();
const AUTH_SKIP = adminAuthSkipReason();

test.describe("Admin PMA Keyword Strategy", () => {
  test("discovers Divin8 opportunities and stays proposal-only", async ({ page }) => {
    test.skip(Boolean(AUTH_SKIP), AUTH_SKIP || "Admin Clerk test session is required");
    const leakedProviderCalls: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("openrouter.ai") || url.includes("googleads.googleapis.com")) {
        leakedProviderCalls.push(url);
      }
    });

    await page.goto(`${ADMIN_BASE}/admin/ads/keyword-strategy`);
    await expect(page.getByText("Divin8 Reports")).toBeVisible();
    await page.locator("#pma-seeds").fill("detailed birth chart report");
    await page.getByRole("button", { name: "Discover Opportunities" }).click();
    await expect(page.getByText(/birth chart|natal|report/i).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Build Campaign from Cluster" }).first().click();
    await expect(page.getByRole("heading", { name: "Campaign Lab" })).toBeVisible();
    await expect(page.getByText(/Proposal workspace only|No Google Ads writes/i)).toBeVisible();

    await page.locator("[data-ads-agent-rail]").click();
    await expect(page.locator("[data-ads-agent-drawer]")).toBeVisible();
    await page.getByPlaceholder("Ask the Ads Agent…").fill("Why is this cluster strategically valuable for Divin8?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Why is this cluster strategically valuable for Divin8?")).toBeVisible();
    expect(leakedProviderCalls).toEqual([]);
  });
});
