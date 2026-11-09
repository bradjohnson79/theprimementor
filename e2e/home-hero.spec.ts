import { expect, test } from "@playwright/test";

const ROTATION_MS = 12_000;

test.describe("Homepage hero", () => {
  test("rotates six slides and each CTA lands on its homepage section", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");

    const hero = page.locator("#hero");
    await expect(hero).toHaveAttribute("data-hero-slide", "star-initiation");
    await expect(page.locator("[data-hero-indicators] [role='tab']")).toHaveCount(6);

    await page.getByRole("tab", { name: "Express slide" }).click();
    await expect(hero).toHaveAttribute("data-hero-slide", "express");
    await expect(page.getByRole("heading", { name: /Express Services/ })).toBeVisible();
    const expressCta = page.getByRole("link", { name: "Explore Express Services" });
    await expect(expressCta).toHaveAttribute("href", "/?serviceType=express#services");

    await page.getByRole("tab", { name: "Brad slide" }).click();
    await expect(hero).toHaveAttribute("data-hero-slide", "brad");
    const startHere = page.getByRole("link", { name: "Find your starting point" });
    await expect(startHere).toHaveAttribute("href", "#services");
    await startHere.click();
    await expect(page).toHaveURL(/#services$/);
    await expect(page.getByRole("heading", { name: "Premium & Express Services" })).toBeInViewport();

    await page.goto("/");
    await page.getByRole("tab", { name: "Shop slide" }).click();
    await expect(hero).toHaveAttribute("data-hero-slide", "shop");
    const shopCta = page.getByRole("link", { name: "Explore the Shop" });
    await expect(shopCta).toHaveAttribute("href", "#shop");
    await shopCta.click();
    await expect(page).toHaveURL(/#shop$/);
    await expect(page.getByRole("heading", { name: "The Prime Mentor Shop", exact: true })).toBeInViewport();

    await page.goto("/");
    await page.getByRole("tab", { name: "Services slide" }).click();
    await expect(hero).toHaveAttribute("data-hero-slide", "services");
    const servicesCta = page.getByRole("link", { name: "Explore services" });
    await expect(servicesCta).toHaveAttribute("href", "#services");
    await servicesCta.click();
    await expect(page).toHaveURL(/#services$/);
    await expect(page.getByRole("heading", { name: "Premium & Express Services" })).toBeInViewport();

    await page.goto("/");
    await page.getByRole("tab", { name: "Reports slide" }).click();
    await expect(hero).toHaveAttribute("data-hero-slide", "reports");
    const reportsCta = page.getByRole("link", { name: "Explore reports" });
    await expect(reportsCta).toHaveAttribute("href", "#reports");
    await reportsCta.click();
    await expect(page).toHaveURL(/#reports$/);
    await expect(page.getByRole("heading", { name: "Detailed life reports that remove guesswork" })).toBeInViewport();

    await page.goto("/");
    await expect(hero).toHaveAttribute("data-hero-slide", "star-initiation");
    await page.getByRole("button", { name: "Next slide" }).click();
    await expect(hero).toHaveAttribute("data-hero-slide", "express");
    await page.getByRole("button", { name: "Previous slide" }).click();
    await expect(hero).toHaveAttribute("data-hero-slide", "star-initiation");

    await page.getByRole("button", { name: "Pause hero rotation" }).click();
    await page.mouse.move(0, 0);
    await page.clock.fastForward(ROTATION_MS);
    await expect(hero).toHaveAttribute("data-hero-slide", "star-initiation");

    await page.getByRole("button", { name: "Play hero rotation" }).click();
    await page.mouse.move(0, 0);
    await page.clock.fastForward(ROTATION_MS);
    await expect(hero).toHaveAttribute("data-hero-slide", "express");
    await page.clock.fastForward(ROTATION_MS);
    await expect(hero).toHaveAttribute("data-hero-slide", "brad");
    await page.clock.fastForward(ROTATION_MS);
    await expect(hero).toHaveAttribute("data-hero-slide", "shop");
    await page.clock.fastForward(ROTATION_MS);
    await expect(hero).toHaveAttribute("data-hero-slide", "services");
    await page.clock.fastForward(ROTATION_MS);
    await expect(hero).toHaveAttribute("data-hero-slide", "reports");
    await page.clock.fastForward(ROTATION_MS);
    await expect(hero).toHaveAttribute("data-hero-slide", "star-initiation");
  });

  test("pauses rotation while the hero is hovered", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");
    const hero = page.locator("#hero");
    await expect(hero).toHaveAttribute("data-hero-slide", "star-initiation");
    await hero.hover();
    await page.clock.fastForward(ROTATION_MS + 500);
    await expect(hero).toHaveAttribute("data-hero-slide", "star-initiation");
  });

  test("does not overflow horizontally at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Reconnect with Your/ })).toBeVisible();
    const overflowed = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflowed).toBe(false);
  });
});
