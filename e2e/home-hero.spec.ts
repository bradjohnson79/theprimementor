import { expect, test } from "@playwright/test";

const ROTATION_MS = 12_000;

test.describe("Homepage hero", () => {
  test("rotates four slides and each CTA lands on its homepage section", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");

    const hero = page.locator("#hero");
    await expect(hero).toHaveAttribute("data-hero-slide", "brad");
    await expect(page.getByText("Clarity you can live, not just understand.")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Stuck at a crossroads/ })).toBeVisible();
    await expect(page.locator("[data-hero-indicators] [role='tab']")).toHaveCount(4);

    const startHere = page.getByRole("link", { name: "Find your starting point" });
    const sampleReport = page.getByRole("link", { name: "See a sample report" });
    await expect(startHere).toHaveAttribute("href", "#start-here");
    await expect(sampleReport).toHaveAttribute("href", "#reports");

    await startHere.click();
    await expect(page).toHaveURL(/#start-here$/);
    await expect(page.getByRole("heading", { name: "Where most people start" })).toBeInViewport();

    await page.goto("/");
    await expect(hero).toHaveAttribute("data-hero-slide", "brad");
    await page.getByRole("tab", { name: "Shop slide" }).click();
    await expect(hero).toHaveAttribute("data-hero-slide", "shop");
    await expect(page.getByRole("heading", { name: /Sacred apparel/ })).toBeVisible();
    const shopCta = page.getByRole("link", { name: "Explore the Shop" });
    await expect(shopCta).toHaveAttribute("href", "#shop");
    await shopCta.click();
    await expect(page).toHaveURL(/#shop$/);
    await expect(page.getByRole("heading", { name: "The Prime Mentor Shop", exact: true })).toBeInViewport();

    await page.goto("/");
    await page.getByRole("tab", { name: "Services slide" }).click();
    await expect(hero).toHaveAttribute("data-hero-slide", "services");
    const servicesCta = page.getByRole("link", { name: "Explore services" });
    await expect(servicesCta).toHaveAttribute("href", "#sessions");
    await servicesCta.click();
    await expect(page).toHaveURL(/#sessions$/);
    await expect(page.getByRole("heading", { name: "Prime Mentor Services" })).toBeInViewport();

    await page.goto("/");
    await page.getByRole("tab", { name: "Reports slide" }).click();
    await expect(hero).toHaveAttribute("data-hero-slide", "reports");
    const reportsCta = page.getByRole("link", { name: "Explore reports" });
    await expect(reportsCta).toHaveAttribute("href", "#reports");
    await reportsCta.click();
    await expect(page).toHaveURL(/#reports$/);
    await expect(page.getByRole("heading", { name: "Detailed life reports that remove guesswork" })).toBeInViewport();

    await page.goto("/");
    await expect(hero).toHaveAttribute("data-hero-slide", "brad");
    await page.getByRole("button", { name: "Next slide" }).click();
    await expect(hero).toHaveAttribute("data-hero-slide", "shop");
    await page.getByRole("button", { name: "Previous slide" }).click();
    await expect(hero).toHaveAttribute("data-hero-slide", "brad");

    await page.getByRole("button", { name: "Pause hero rotation" }).click();
    await page.mouse.move(0, 0);
    await page.clock.fastForward(ROTATION_MS);
    await expect(hero).toHaveAttribute("data-hero-slide", "brad");

    await page.getByRole("button", { name: "Play hero rotation" }).click();
    await page.mouse.move(0, 0);
    await page.clock.fastForward(ROTATION_MS);
    await expect(hero).toHaveAttribute("data-hero-slide", "shop");
    await page.clock.fastForward(ROTATION_MS);
    await expect(hero).toHaveAttribute("data-hero-slide", "services");
    await page.clock.fastForward(ROTATION_MS);
    await expect(hero).toHaveAttribute("data-hero-slide", "reports");
    await page.clock.fastForward(ROTATION_MS);
    await expect(hero).toHaveAttribute("data-hero-slide", "brad");
  });

  test("pauses rotation while the hero is hovered", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");
    const hero = page.locator("#hero");
    await expect(hero).toHaveAttribute("data-hero-slide", "brad");
    await hero.hover();
    await page.clock.fastForward(ROTATION_MS + 500);
    await expect(hero).toHaveAttribute("data-hero-slide", "brad");
  });

  test("does not overflow horizontally at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByText("Clarity you can live, not just understand.")).toBeVisible();
    const overflowed = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflowed).toBe(false);
  });
});
