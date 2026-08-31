import { expect, test } from "@playwright/test";

const ADMIN_BASE = process.env.PLAYWRIGHT_ADMIN_BASE_URL?.trim();
const HAS_CLERK_SESSION = Boolean(
  process.env.CLERK_TEST_SESSION_TOKEN?.trim()
  || process.env.PLAYWRIGHT_CLERK_SESSION?.trim(),
);

test.describe("Admin Emails", () => {
  test("opens the Emails workspace when admin session env is present", async ({ page }) => {
    test.skip(!ADMIN_BASE || !HAS_CLERK_SESSION, "PLAYWRIGHT_ADMIN_BASE_URL and a Clerk test session are required");
    await page.goto(`${ADMIN_BASE}/admin/emails`);
    await expect(page.getByRole("heading", { name: "Emails" })).toBeVisible();
    await expect(page.locator("[data-emails-compliance-notice]")).toBeVisible();
  });
});
