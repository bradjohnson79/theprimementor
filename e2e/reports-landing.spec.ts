import { expect, test } from "@playwright/test";

const ORDER_LINKS = [
  { name: "Order Introductory Report", path: /\/dashboard\/reports\/intro|\/sign-in/ },
  { name: "Order Deep Dive Report", path: /\/dashboard\/reports\/deep-dive|\/sign-in/ },
  { name: "Order Initiate Report", path: /\/dashboard\/reports\/initiate|\/sign-in/ },
  { name: "Order 3 Questions Report", path: /\/dashboard\/reports\/three-questions|\/sign-in/ },
  { name: "Order Compatibility Report", path: /\/dashboard\/reports\/compatibility|\/sign-in/ },
  { name: "Order 12 Month Report", path: /\/dashboard\/reports\/annual-12-month|\/sign-in/ },
];

test.describe("Divin8 Reports landing", () => {
  test("hero, catalogue, FAQ, and purchase handoff", async ({ page }, testInfo) => {
    await page.goto("/reports");
    await expect(
      page.getByRole("heading", { level: 1, name: "Discover the Deeper Blueprint of Your Life" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore the Reports" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View Sample Reports" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "View Sample Report" })).toHaveCount(0);

    await page.getByRole("link", { name: "Explore the Reports" }).click();
    await expect(page.locator("#choose-reports")).toBeInViewport();

    const catalogue = page.locator("#choose-reports");
    await expect(
      catalogue.getByRole("heading", { name: "Introductory Divin8 Report" }),
    ).toBeVisible();
    await expect(catalogue.getByRole("heading", { name: "Deep Dive Divin8 Report" })).toBeVisible();
    await expect(catalogue.getByRole("heading", { name: "Initiate Divin8 Report" })).toBeVisible();
    await expect(
      catalogue.getByRole("heading", { name: "Divin8 3 Questions Report" }),
    ).toBeVisible();
    await expect(
      catalogue.getByRole("heading", { name: "Divin8 Compatibility Report" }),
    ).toBeVisible();
    await expect(
      catalogue.getByRole("heading", { name: "Divin8 12 Month Annual Report" }),
    ).toBeVisible();

    await expect(page.getByText("Craig Stickler")).toBeVisible();
    await expect(page.getByText(/The Deep dive report is certainly well titled/)).toBeVisible();
    await expect(page.getByText("Bibi Tinsley")).toHaveCount(0);

    const faqButton = page.getByRole("button", { name: "Do I need an exact birth time?" });
    await expect(faqButton).toBeVisible();
    await faqButton.click();
    await expect(page.getByText(/the report intake defaults to 00:00/)).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);

    await expect(page.locator('img[alt="Divin8 Introductory Report cover artwork"]')).toHaveCount(
      1,
    );
    await expect(page.locator('img[alt="Divin8 Deep Dive Report cover artwork"]')).toHaveCount(2);
    await expect(
      page.locator(
        'img[alt="Cover artwork titled Initiate’s Report for the Initiate Divin8 Report"]',
      ),
    ).toHaveCount(1);
    await expect(page.locator('img[alt="Divin8 3 Questions Report cover artwork"]')).toHaveCount(1);
    await expect(
      page.locator('img[alt="Divin8 Partner Compatibility Report cover artwork"]'),
    ).toHaveCount(2);
    await expect(
      page.locator('img[alt="Divin8 12 Month Annual Report cover artwork"]'),
    ).toHaveCount(2);

    await page.screenshot({
      path: `e2e/evidence/reports-landing-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test("each report purchase action reaches the existing order flow", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "tablet", "Purchase handoff covered on desktop and mobile");
    await page.goto("/reports");

    for (const link of ORDER_LINKS) {
      await page.goto("/reports");
      const action = page.getByRole("link", { name: link.name }).first();
      await expect(action).toBeVisible();
      await action.click();
      await expect(page).toHaveURL(link.path);
    }
  });
});
