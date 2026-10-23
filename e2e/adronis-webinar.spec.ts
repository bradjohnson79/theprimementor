import { expect, test, type Page } from "@playwright/test";

const STAR_FAMILY = "/webinars/adronis-star-family-communion";
const STAR_FAMILY_THANKS = "/webinars/adronis-star-family-communion/thank-you";
const DISCLOSURE_THANKS = "/webinars/adronis-disclosure-to-contact/thank-you";
const DISCLOSURE_ON_DEMAND = "/webinars/adronis-disclosure-to-contact/on-demand";
const STAR_FAMILY_ON_DEMAND = "/webinars/adronis-star-family-communion/on-demand";
const PRIME_ALCHEMY = "/webinars/prime-alchemy-teachings";
const PRIME_ALCHEMY_THANKS = "/webinars/prime-alchemy-teachings/thank-you";
const ZOOM_TOKEN = "eTHsHKnRQ16W0yoB5HaR6Q";
const DISCLOSURE_ZOOM_TOKEN = "sCZZBeMQQgOQwsYb9XuM7Q";
const PRIME_ALCHEMY_ZOOM_TOKEN = "W3SbW8mdQACjSbbU-YrHQg";

async function openHomepage(page: Page) {
  await page.goto("/");
  await expect(page.locator("#hero")).toBeVisible();
}

test.describe("Star Family public pages are retired", () => {
  test("homepage no longer promotes the ended webinar", async ({ page }) => {
    await openHomepage(page);
    await expect(page.locator("#star-family-communion")).toHaveCount(0);
    await expect(page.locator("#on-demand-webinars")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Upcoming" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Adronis: Star Family Communion" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Adronis: From Disclosure to Contact" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mentoring Circle: Prime Alchemy Teachings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Register — $19.99 CAD" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Learn More" })).toHaveAttribute("href", PRIME_ALCHEMY);
    await expect(page.getByRole("heading", { name: "Adronis: Star Family Communion" })).toHaveCount(0);
    await expect(page.locator(`a[href="${STAR_FAMILY}"]`)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(ZOOM_TOKEN);
    await expect(page.locator("body")).not.toContainText(DISCLOSURE_ZOOM_TOKEN);
    await expect(page.locator("body")).not.toContainText(PRIME_ALCHEMY_ZOOM_TOKEN);
  });

  test("registration and thank-you URLs return home", async ({ page }) => {
    await page.goto(STAR_FAMILY);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#hero")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Adronis: Star Family Communion", level: 1 })).toHaveCount(0);

    await page.goto(STAR_FAMILY_THANKS);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#hero")).toBeVisible();
    await expect(page.getByRole("link", { name: /Register on Zoom/i })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(ZOOM_TOKEN);
  });

  test("narrow layouts keep the homepage inside the viewport", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Narrow layout");
    await openHomepage(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
  });
});

test.describe("Disclosure on-demand remains isolated", () => {
  test("thank-you URL stays gated for logged-out visitors", async ({ page }) => {
    await page.goto(DISCLOSURE_THANKS);
    await expect(page.getByRole("heading", { name: /sign in to view webinar access/i }).or(page.locator(".cl-signIn-root"))).toBeVisible();
    await expect(page.getByRole("link", { name: /Register on Zoom/i })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(DISCLOSURE_ZOOM_TOKEN);
  });

  test("on-demand landing keeps the $7.99 purchase path", async ({ page }) => {
    await page.goto(DISCLOSURE_ON_DEMAND);
    await expect(page.getByRole("heading", { name: "Adronis: From Disclosure to Contact" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Get Instant Access — $7.99 CAD" }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(ZOOM_TOKEN);
    await expect(page.locator("body")).not.toContainText("Saturday, September 12, 2026");
  });

  test("Prime Alchemy learn-more page stays public and hides the Zoom link", async ({ page }) => {
    await page.goto(PRIME_ALCHEMY);
    await expect(page.getByRole("heading", { name: "Mentoring Circle: Prime Alchemy Teachings", level: 1 })).toBeVisible();
    await expect(page.getByText("Sunday, November 1, 2026").first()).toBeVisible();
    await expect(page.getByText("10:00 AM Pacific / 1:00 PM Eastern").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Register — $19.99 CAD" }).first()).toBeVisible();
    await expect(page.getByText(/90-minute Mentoring Session/)).toBeVisible();
    await expect(page.getByText(/45-minute Mentoring Session/)).toBeVisible();
    await expect(page.getByText(/natal charts that Divin8 will provide/)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(PRIME_ALCHEMY_ZOOM_TOKEN);

    await page.goto(PRIME_ALCHEMY_THANKS);
    await expect(page.getByRole("heading", { name: /sign in to view webinar access/i }).or(page.locator(".cl-signIn-root"))).toBeVisible();
    await expect(page.getByRole("link", { name: /Register on Zoom/i })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(PRIME_ALCHEMY_ZOOM_TOKEN);
  });

  test("Star Family on-demand landing keeps the $7.99 purchase path", async ({ page }) => {
    await page.goto(STAR_FAMILY_ON_DEMAND);
    await expect(page.getByRole("heading", { name: "Adronis: Star Family Communion", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Get Instant Access — $7.99 CAD" }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(ZOOM_TOKEN);
    await expect(page.locator("body")).not.toContainText("Saturday, October 17, 2026");
  });
});
