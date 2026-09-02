import { expect, test, type Page } from "@playwright/test";

const LANDING = "/sessions/prime-body-healing";

async function openHomepage(page: Page) {
  await page.goto("/");
  await expect(page.locator("#hero")).toBeVisible();
}

test.describe("Prime Body Healing landing", () => {
  test("desktop Sessions menu opens Prime Body Healing", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop hover menu");
    await openHomepage(page);
    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    await nav.getByRole("link", { name: "Sessions" }).hover();
    const menu = page.locator('[data-nav-dropdown="Sessions"]');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Prime Body Healing" })).toBeVisible();
    await menu.getByRole("link", { name: "Prime Body Healing" }).click();
    await expect(page).toHaveURL(/\/sessions\/prime-body-healing$/);
    await expect(page.getByRole("heading", { level: 1, name: /Deep Energetic Rejuvenation/ })).toBeVisible();
  });

  test("mobile Sessions accordion opens Prime Body Healing", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Hamburger Sessions accordion");
    await openHomepage(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
    await mobileNav.getByRole("button", { name: "Expand Sessions" }).click({ force: true });
    const menu = mobileNav.locator('[data-nav-dropdown="Sessions"]');
    await expect(menu.getByRole("link", { name: "Prime Body Healing" })).toBeVisible();
    await menu.getByRole("link", { name: "Prime Body Healing" }).click();
    await expect(page).toHaveURL(/\/sessions\/prime-body-healing$/);
  });

  test("landing shows both artworks, sections, FAQ, and CAD prices", async ({ page }) => {
    await page.goto(LANDING);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Deep Energetic Rejuvenation");
    await expect(page.getByRole("img", { name: "Prime Body Healing Level 1 artwork" })).toHaveCount(2);
    await expect(page.getByRole("img", { name: "Prime Body Healing Level 2 artwork" })).toHaveCount(2);
    await expect(page.locator("#level-1")).toBeVisible();
    await expect(page.locator("#level-2")).toBeVisible();
    await expect(page.locator("#which-level")).toBeVisible();
    await expect(page.locator("#faq")).toBeVisible();
    await expect(page.getByText("$79 CAD").first()).toBeVisible();
    await expect(page.getByText("$179 CAD").first()).toBeVisible();
    await expect(page.getByText(/not intended to diagnose, treat, cure or prevent/i)).toBeVisible();
    await expect(page.getByText(/booking window/i).first()).toBeVisible();

    await page.getByRole("link", { name: "Explore Level 1" }).click();
    await expect(page.locator("#level-1")).toBeInViewport();
    await page.getByRole("button", { name: "How long does delivery take?" }).click();
    await expect(page.locator("#faq").getByText(/turnaround based on available dates/i)).toBeVisible();
  });

  test("Level 1 and Level 2 CTAs go to the protected book flow", async ({ page }) => {
    await page.goto(LANDING);
    await page.getByRole("link", { name: "Book Level 1 — $79 CAD" }).click();
    await expect(page).toHaveURL(/\/sessions\/prime-body-healing\/book\?level=1|\/sign-in/);
    await page.goto(LANDING);
    await page.getByRole("link", { name: "Order Level 2 — $179 CAD" }).click();
    await expect(page).toHaveURL(/\/sessions\/prime-body-healing\/book\?level=2|\/sign-in/);
  });

  test("home sessions card links to the landing", async ({ page }) => {
    await page.goto("/#sessions");
    await expect(page.getByRole("heading", { name: "Prime Body Healing" })).toBeVisible();
    await page.getByRole("link", { name: "Explore Prime Body Healing" }).click();
    await expect(page).toHaveURL(/\/sessions\/prime-body-healing$/);
  });
});
