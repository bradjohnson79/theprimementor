import { expect, test } from "@playwright/test";

const ADMIN_BASE = process.env.PLAYWRIGHT_ADMIN_BASE_URL?.trim();
const HAS_CLERK_SESSION = Boolean(
  process.env.CLERK_TEST_SESSION_TOKEN?.trim()
  || process.env.PLAYWRIGHT_CLERK_SESSION?.trim(),
);

test.describe("Admin PMA Keyword Strategy", () => {
  test("discovers Divin8 opportunities and stays proposal-only", async ({ page }) => {
    test.skip(!ADMIN_BASE || !HAS_CLERK_SESSION, "PLAYWRIGHT_ADMIN_BASE_URL and a Clerk test session are required");
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
