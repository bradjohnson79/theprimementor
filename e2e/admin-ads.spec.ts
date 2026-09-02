import { expect, test } from "@playwright/test";
import { adminAuthSkipReason, adminBaseUrl } from "./helpers/adminAuth.ts";

const ADMIN_BASE = adminBaseUrl();
const AUTH_SKIP = adminAuthSkipReason();

test.describe("Admin Ads", () => {
  test("walks Settings, Command Center, Campaigns, and Ads Agent without leaking secrets", async ({ page }) => {
    test.skip(Boolean(AUTH_SKIP), AUTH_SKIP || "Admin Clerk test session is required");
    const leakedSecrets: string[] = [];
    const leakedProviderCalls: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (
        url.includes("openrouter.ai")
        || url.includes("googleads.googleapis.com")
        || url.includes("localhost:11434")
        || url.includes("127.0.0.1:11434")
      ) {
        leakedProviderCalls.push(url);
      }
    });
    page.on("response", async (response) => {
      if (!response.url().includes("/api/admin/ads/")) return;
      const body = await response.text().catch(() => "");
      if (/GOOGLE_ADS_CLIENT_SECRET|GOOGLE_ADS_REFRESH_TOKEN|developerToken|refreshToken|sk-or-v1-|ya29\./.test(body)) {
        leakedSecrets.push(response.url());
      }
    });

    await page.goto(`${ADMIN_BASE}/admin/ads/settings`);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Google Ads" })).toBeVisible();
    await expect(page.getByText("405-845-9597")).toBeVisible();
    await expect(page.getByText("860-469-0994")).toBeVisible();
    await expect(page.getByRole("button", { name: /Connect Google Ads|Reconnect Google Ads/ })).toBeVisible();
    await expect(page.getByText(/Not Connected|Connected — Read Only/)).toBeVisible();

    await page.getByRole("link", { name: "Command Center" }).first().click();
    await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
    await expect(page.locator("[data-ads-agent-rail]")).toBeVisible();

    await page.getByRole("link", { name: "Campaigns" }).first().click();
    await expect(page.getByRole("heading", { name: /Campaigns/ })).toBeVisible();

    await page.locator("[data-ads-agent-rail]").click();
    await expect(page.locator("[data-ads-agent-drawer]")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ads Agent" })).toBeVisible();
    await expect(page.getByText("GLM 5.3 Flash")).toBeVisible();
    await expect(page.getByText(/OpenRouter Connected|Connected — GLM 5.3 Flash via OpenRouter/)).toBeVisible();

    const question = "How are my Google Ads campaigns performing over the last 30 days?";
    await page.getByPlaceholder("Ask the Ads Agent…").fill(question);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(question).first()).toBeVisible();

    await page.getByRole("button", { name: "Collapse", exact: true }).click();
    await expect(page.locator("[data-ads-agent-drawer]")).toHaveCount(0);
    await page.locator("[data-ads-agent-rail]").click();
    await expect(page.locator("[data-ads-agent-drawer]")).toBeVisible();
    await expect(page.getByText(question).first()).toBeVisible();
    expect(leakedSecrets).toEqual([]);
    expect(leakedProviderCalls).toEqual([]);
  });
});
