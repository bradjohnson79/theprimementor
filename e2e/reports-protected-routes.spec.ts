import { expect, test } from "@playwright/test";

const PROTECTED_CHECKOUT_ROUTES = [
  { path: "/reports/intro", dashboard: "/dashboard/reports/intro" },
  { path: "/reports/deep-dive", dashboard: "/dashboard/reports/deep-dive" },
  { path: "/reports/initiate", dashboard: "/dashboard/reports/initiate" },
] as const;

test.describe("Protected Divin8 report checkout routes", () => {
  test("legacy checkout shortcuts stay off the new marketing pages", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Route rank covered on desktop");

    for (const route of PROTECTED_CHECKOUT_ROUTES) {
      await page.goto(`${route.path}?gclid=test`);
      await expect(
        page.getByRole("heading", { level: 1, name: "Know Yourself Beyond the Surface" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { level: 1, name: "Personalized Birth & Natal Insight Report" }),
      ).toHaveCount(0);
      await expect(page.locator("main.reports-landing")).toHaveCount(0);
      await expect(page).not.toHaveURL(/\/reports\/introductory/);
      await expect(page).not.toHaveURL(/\/reports\/compatibility$/);

      const decoded = decodeURIComponent(page.url());
      expect(decoded).toMatch(
        new RegExp(`${route.path}|/sign-in|${route.dashboard}`.replaceAll("/", "\\/")),
      );
      expect(decoded).toContain("gclid=test");
    }
  });

  test("unsigned order path keeps paid-search params through the auth hop", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Auth hop covered on desktop");
    await page.goto("/reports?utm_source=google&utm_medium=cpc&gclid=test");
    await page
      .locator("#choose-reports")
      .getByRole("link", { name: "Order Introductory Report" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/sign-in|\/dashboard\/reports\/intro/);
    expect(decodeURIComponent(page.url())).toContain("gclid=test");
  });
});
