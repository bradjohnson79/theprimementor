import { expect, test } from "@playwright/test";

const ADMIN_BASE = process.env.PLAYWRIGHT_ADMIN_BASE_URL?.trim();
const HAS_CLERK_SESSION = Boolean(
  process.env.CLERK_TEST_SESSION_TOKEN?.trim()
  || process.env.PLAYWRIGHT_CLERK_SESSION?.trim(),
);

const BUDGET_MESSAGE = "Our initial Divin8 Ads test budget is CA$20/day and Canada only.";
const RECALL_MESSAGE = "What budget and geography did I choose for the initial Divin8 campaign?";

test.describe("Admin Ads Agent memory and fetch", () => {
  test("opens Ads Agent, submits, and never shows Failed to fetch or CORS", async ({ page }) => {
    test.skip(!ADMIN_BASE || !HAS_CLERK_SESSION, "PLAYWRIGHT_ADMIN_BASE_URL and a Clerk test session are required");
    const corsFailures: string[] = [];
    const failedFetch: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (/Failed to fetch/i.test(text)) failedFetch.push(text);
      if (/CORS|Access-Control-Allow-Origin/i.test(text)) corsFailures.push(text);
    });
    page.on("pageerror", (error) => {
      if (/Failed to fetch|CORS/i.test(error.message)) failedFetch.push(error.message);
    });

    await page.goto(`${ADMIN_BASE}/admin/ads`);
    await expect(page.locator("[data-ads-agent-rail]")).toBeVisible();
    await page.locator("[data-ads-agent-rail]").click();
    await expect(page.locator("[data-ads-agent-drawer]")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ads Agent" })).toBeVisible();

    await page.getByPlaceholder("Ask the Ads Agent…").fill("Explain Google Ads in one short paragraph.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.locator("[data-ads-agent-progress]")).toBeVisible();
    await expect(page.getByText("Explain Google Ads in one short paragraph.")).toBeVisible();
    await expect(page.locator("[data-ads-agent-assistant]").first()).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-ads-agent-error]")).toHaveCount(0);
    expect(corsFailures).toEqual([]);
    expect(failedFetch).toEqual([]);
  });

  test("persists owner budget and geography across new conversation and reload", async ({ page }) => {
    test.skip(!ADMIN_BASE || !HAS_CLERK_SESSION, "PLAYWRIGHT_ADMIN_BASE_URL and a Clerk test session are required");

    await page.goto(`${ADMIN_BASE}/admin/ads`);
    await page.locator("[data-ads-agent-rail]").click();
    await expect(page.locator("[data-ads-agent-drawer]")).toBeVisible();
    await page.getByRole("button", { name: "New conversation" }).click();
    await page.getByPlaceholder("Ask the Ads Agent…").fill(BUDGET_MESSAGE);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(BUDGET_MESSAGE)).toBeVisible();
    await expect(page.getByText(/CA\$20\/day|Canada only/i).first()).toBeVisible({ timeout: 90_000 });

    await page.getByRole("button", { name: "New conversation" }).click();
    await expect(page.getByText(BUDGET_MESSAGE)).toHaveCount(0);
    await page.getByPlaceholder("Ask the Ads Agent…").fill(RECALL_MESSAGE);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/CA\$20\/day/i).first()).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/Canada only/i).first()).toBeVisible();

    await page.reload();
    await page.locator("[data-ads-agent-rail]").click();
    await page.getByRole("button", { name: "New conversation" }).click();
    await page.getByPlaceholder("Ask the Ads Agent…").fill(RECALL_MESSAGE);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/CA\$20\/day/i).first()).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/Canada only/i).first()).toBeVisible();
  });

  test("shows a normalized error when the Ads Agent provider fails", async ({ page }) => {
    test.skip(!ADMIN_BASE || !HAS_CLERK_SESSION, "PLAYWRIGHT_ADMIN_BASE_URL and a Clerk test session are required");
    await page.route("**/api/admin/ads/agent/chat", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": new URL(ADMIN_BASE!).origin },
        body: JSON.stringify({
          success: false,
          error: "OpenRouter is temporarily unavailable.",
          data: { code: "OPENROUTER_UNAVAILABLE" },
        }),
      });
    });
    await page.goto(`${ADMIN_BASE}/admin/ads`);
    await page.locator("[data-ads-agent-rail]").click();
    await page.getByPlaceholder("Ask the Ads Agent…").fill("Simulate a provider failure.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.locator("[data-ads-agent-error]")).toBeVisible();
    await expect(page.getByText("OpenRouter is temporarily unavailable.")).toBeVisible();
    await expect(page.getByText("Failed to fetch")).toHaveCount(0);
  });

  test("exposes Ads memory controls on Agent settings", async ({ page }) => {
    test.skip(!ADMIN_BASE || !HAS_CLERK_SESSION, "PLAYWRIGHT_ADMIN_BASE_URL and a Clerk test session are required");
    await page.goto(`${ADMIN_BASE}/admin/ads/settings`);
    await expect(page.locator("[data-ads-memory]")).toBeVisible();
    await expect(page.getByText("Memory status: On")).toBeVisible();
    await page.getByRole("button", { name: "View Ads Memory" }).click();
    await expect(page.getByPlaceholder("Search memory")).toBeVisible();
  });
});
