import { expect, test } from "@playwright/test";

test.describe("Homepage hero", () => {
  test("shows the Brad introduction first, rotates three slides, and keeps CTAs", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");

    await expect(page.getByText("18+ YEARS OF METAPHYSICAL EXPERIENCE")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Guidance Built on/ })).toBeVisible();
    const meetBrad = page.getByRole("link", { name: "Meet Brad" });
    const exploreSessions = page.getByRole("link", { name: "Explore Sessions" });
    await expect(meetBrad).toBeVisible();
    await expect(exploreSessions).toBeVisible();
    await expect(page.locator("[data-hero-indicators] span")).toHaveCount(3);

    await expect(meetBrad).toHaveAttribute("href", "/about");
    await expect(exploreSessions).toHaveAttribute("href", "/#sessions");

    await meetBrad.click();
    await expect(page).toHaveURL(/\/about$/);
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Explore Sessions" })).toBeVisible();
    await page.getByRole("link", { name: "Explore Sessions" }).click();
    await expect(page).toHaveURL(/\/#sessions/);

    await page.goto("/");
    await expect(page.getByText("18+ YEARS OF METAPHYSICAL EXPERIENCE")).toBeVisible();

    await page.clock.fastForward(15_000);
    await expect(page.getByText("THE PRIME MENTOR MEMBERSHIP")).toBeVisible();
    await expect(page.getByRole("link", { name: "Join Premium" })).toBeVisible();

    await page.clock.fastForward(15_000);
    await expect(page.getByText("PRIVATE SESSIONS & REPORTS")).toBeVisible();

    await page.clock.fastForward(15_000);
    await expect(page.getByText("18+ YEARS OF METAPHYSICAL EXPERIENCE")).toBeVisible();
    await expect(page.getByRole("link", { name: "Meet Brad" })).toBeVisible();
  });

  test("does not overflow horizontally at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByText("18+ YEARS OF METAPHYSICAL EXPERIENCE")).toBeVisible();
    const overflowed = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflowed).toBe(false);
  });
});
