import { expect, test } from "@playwright/test";

const ORDER_LINKS = [
  { name: "Order Introductory Report", path: /\/dashboard\/reports\/intro|\/sign-in/ },
  { name: "Order Deep Dive Report", path: /\/dashboard\/reports\/deep-dive|\/sign-in/ },
  { name: "Order Initiate Report", path: /\/dashboard\/reports\/initiate|\/sign-in/ },
  { name: "Order 3 Questions Report", path: /\/dashboard\/reports\/three-questions|\/sign-in/ },
  { name: "Order Compatibility Report", path: /\/dashboard\/reports\/compatibility|\/sign-in/ },
  { name: "Order 12 Month Report", path: /\/dashboard\/reports\/annual-12-month|\/sign-in/ },
];

const PAID_SEARCH = "?utm_source=google&utm_medium=cpc&gclid=test";

test.describe("Divin8 Reports landing", () => {
  test("hero, catalogue, FAQ, and purchase handoff", async ({ page }, testInfo) => {
    await page.goto("/reports");
    await expect(
      page.getByRole("heading", { level: 1, name: "Know Yourself Beyond the Surface" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore Reports" })).toBeVisible();
    await expect(page.getByRole("link", { name: "See Sample Reports" })).toBeVisible();

    await page.getByRole("link", { name: "Explore Reports" }).click();
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

    await expect(catalogue.getByRole("button", { name: "View Sample" })).toHaveCount(5);
    await expect(catalogue.getByText("Sample in preparation")).toHaveCount(1);
    await expect(
      catalogue.getByText("A Partner Compatibility sample is not published yet."),
    ).toBeVisible();

    await expect(page.getByText("Craig Stickler")).toBeVisible();
    await expect(page.getByText(/The Deep dive report is certainly well titled/)).toBeVisible();
    await expect(page.getByText("Bibi Tinsley")).toHaveCount(0);

    const deliveryButton = page.getByRole("button", { name: "When will my report be delivered?" });
    await expect(deliveryButton).toBeVisible();
    await deliveryButton.click();
    await expect(
      page.getByRole("region", { name: "When will my report be delivered?" }),
    ).toHaveText("Your report is delivered within 48 hours Monday–Friday.");

    const writtenButton = page.getByRole("button", {
      name: "Is this a live session or a written report?",
    });
    await writtenButton.click();
    await expect(page.getByText(/written digital report, not a live consultation/)).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);

    await expect(
      page.locator("#choose-reports img[alt='Divin8 Introductory Report cover artwork']"),
    ).toHaveCount(1);
    await expect(
      page.locator("#see-inside img[alt='Divin8 Introductory Report cover artwork']"),
    ).toHaveCount(1);

    if (testInfo.project.name === "mobile") {
      await expect(page.locator("#compare-reports table")).toBeHidden();
      await expect(page.locator("#compare-reports dl").first()).toBeVisible();
    } else if (testInfo.project.name === "desktop") {
      await expect(page.locator("#compare-reports table")).toBeVisible();
    }

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
      const action = page.locator("#choose-reports").getByRole("link", { name: link.name }).first();
      await expect(action).toBeVisible();
      await action.click();
      await expect(page).toHaveURL(link.path);
    }
  });

  test("paid-search query params stay on catalogue order links", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Attribution covered on desktop");
    await page.goto(`/reports${PAID_SEARCH}`);
    const href = await page
      .locator("#choose-reports")
      .getByRole("link", { name: "Order Introductory Report" })
      .first()
      .getAttribute("href");
    expect(href).toContain("/dashboard/reports/intro");
    expect(href).toContain("utm_source=google");
    expect(href).toContain("utm_medium=cpc");
    expect(href).toContain("gclid=test");
  });
});
