import { expect, test, type Page } from "@playwright/test";

const LANDING = "/sessions/prime-body-healing";

async function openHomepage(page: Page) {
  await page.goto("/");
  await expect(page.locator("#hero")).toBeVisible();
}

test.describe("Prime Body Healing landing", () => {
  test("desktop Services menu opens Prime Body Healing Level 2", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop hover menu");
    await openHomepage(page);
    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    await nav.getByRole("link", { name: "Services" }).hover();
    const menu = page.locator('[data-nav-dropdown="Services"]');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Prime Body Healing Level 2" })).toBeVisible();
    await menu.getByRole("link", { name: "Prime Body Healing Level 2" }).click();
    await expect(page).toHaveURL(/\/sessions\/prime-body-healing#level-2$/);
    await expect(page.getByRole("heading", { level: 1, name: /Deep Energetic Rejuvenation/ })).toBeVisible();
  });

  test("mobile Services accordion opens Prime Body Healing Level 2", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Hamburger Services accordion");
    await openHomepage(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
    await mobileNav.getByRole("button", { name: "Expand Services" }).click({ force: true });
    const menu = mobileNav.locator('[data-nav-dropdown="Services"]');
    await expect(menu.getByRole("link", { name: "Prime Body Healing Level 2" })).toBeVisible();
    await menu.getByRole("link", { name: "Prime Body Healing Level 2" }).click();
    await expect(page).toHaveURL(/\/sessions\/prime-body-healing#level-2$/);
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

  test("Level 1 goes to the protected book flow and Level 2 opens guest checkout", async ({ page }) => {
    await page.goto(LANDING);
    await page.getByRole("link", { name: "Book Level 1 — $79 CAD" }).click();
    await expect(page).toHaveURL(/\/sessions\/prime-body-healing\/book\?level=1|\/sign-in/);
    await page.goto(LANDING);
    await page.getByRole("button", { name: "Order Level 2 — $179 CAD" }).click();
    await expect(page.getByRole("heading", { name: "Continue as guest" })).toBeVisible();
    await expect(page.getByText("Prime Body Healing Level 2 — $179 CAD")).toBeVisible();
  });

  test("homepage services widget offers Level 2 guest checkout", async ({ page }) => {
    await page.goto("/");
    const widget = page.locator("#services");
    await expect(widget.getByRole("heading", { name: "Premium & Express Services" })).toBeVisible();
    await widget.getByRole("button", { name: "Prime Body Healing Level 2", exact: true }).click();
    await widget.getByRole("button", { name: "Book Prime Body Healing Level 2 — $179 CAD" }).click();
    await expect(page.getByRole("heading", { name: "Continue as guest" })).toBeVisible();
    await expect(page.getByText("Prime Body Healing Level 2")).toBeVisible();
  });
});
