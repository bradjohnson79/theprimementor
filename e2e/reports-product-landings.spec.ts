import { expect, test } from "@playwright/test";

const PAID_SEARCH = "?utm_source=google&utm_medium=cpc&gclid=test";

test.describe("Divin8 Reports product landings", () => {
  test("introductory conversion page", async ({ page }, testInfo) => {
    await page.goto(`/reports/introductory${PAID_SEARCH}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Personalized Birth & Natal Insight Report" }),
    ).toBeVisible();
    await expect(page.getByText("$69 CAD").first()).toBeVisible();
    await expect(
      page.locator('img[alt="Divin8 Introductory Report cover artwork"]'),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "View Sample" })).toBeVisible();
    await expect(
      page.getByText("Your report is delivered within 24 hours Monday–Friday.").first(),
    ).toBeVisible();
    await expect(page.getByText(/48 hours/i)).toHaveCount(0);

    const orderHref = await page
      .getByRole("link", { name: "Order Introductory Report" })
      .first()
      .getAttribute("href");
    expect(orderHref).toContain("/dashboard/reports/intro");
    expect(orderHref).toContain("utm_source=google");
    expect(orderHref).toContain("utm_medium=cpc");
    expect(orderHref).toContain("gclid=test");

    if (testInfo.project.name === "mobile") {
      await expect(page.locator(".reports-sticky-cta")).toBeVisible();
      await expect(page.locator(".reports-sticky-cta").getByText("$69 CAD")).toBeVisible();
      await expect(
        page.locator(".reports-sticky-cta").getByRole("link", { name: "Order Introductory Report" }),
      ).toBeVisible();
    } else if (testInfo.project.name === "desktop") {
      await expect(page.locator(".reports-sticky-cta")).toBeHidden();
    }

    await page.screenshot({
      path: `e2e/evidence/reports-introductory-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test("compatibility conversion page uses an intentional empty sample", async ({
    page,
  }, testInfo) => {
    await page.goto(`/reports/compatibility${PAID_SEARCH}`);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Personalized Relationship Compatibility Report",
      }),
    ).toBeVisible();
    await expect(page.getByText("$59 CAD").first()).toBeVisible();
    await expect(
      page.locator('img[alt="Divin8 Partner Compatibility Report cover artwork"]'),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "View Sample" })).toHaveCount(0);
    await expect(page.getByText("Sample in preparation").first()).toBeVisible();
    await expect(
      page.getByText("A Partner Compatibility sample is not published yet.").first(),
    ).toBeVisible();
    await expect(
      page.getByText("Your report is delivered within 24 hours Monday–Friday.").first(),
    ).toBeVisible();
    await expect(page.getByText(/48 hours/i)).toHaveCount(0);
    await expect(page.locator("iframe")).toHaveCount(0);

    const orderHref = await page
      .getByRole("link", { name: "Order Compatibility Report" })
      .first()
      .getAttribute("href");
    expect(orderHref).toContain("/dashboard/reports/compatibility");
    expect(orderHref).toContain("gclid=test");

    if (testInfo.project.name === "mobile") {
      await expect(page.locator(".reports-sticky-cta")).toBeVisible();
    }

    await page.screenshot({
      path: `e2e/evidence/reports-compatibility-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });
});
