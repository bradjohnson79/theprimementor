import { expect, test, type Page } from "@playwright/test";

const THANK_YOU = "/webinars/adronis-disclosure-to-contact/thank-you";
const CHECKOUT = "/webinars/adronis-disclosure-to-contact";
const POSTER_ALT = /Adronis: From Disclosure to Contact webinar with Brad Johnson, Saturday, September 12 at 10 AM Pacific/;

async function openHomepage(page: Page) {
  await page.goto("/");
  await expect(page.locator("#hero")).toBeVisible();
}

test.describe("Adronis webinar homepage card", () => {
  test("appears directly under the Hero and keeps CAD copy", async ({ page }) => {
    await openHomepage(page);
    const hero = page.locator("#hero");
    const card = page.locator("#adronis-webinar");
    await expect(card).toBeVisible();

    const heroBox = await hero.boundingBox();
    const cardBox = await card.boundingBox();
    expect(heroBox && cardBox).toBeTruthy();
    if (heroBox && cardBox) {
      expect(cardBox.y).toBeGreaterThan(heroBox.y);
      expect(cardBox.y).toBeLessThan(heroBox.y + heroBox.height + 80);
    }

    await expect(card.getByRole("heading", { name: "Adronis: From Disclosure to Contact" })).toBeVisible();
    await expect(card.getByRole("img", { name: POSTER_ALT })).toBeVisible();
    await expect(card.getByText("$14.99 CAD")).toBeVisible();
    await expect(card.getByText("Saturday, September 12, 2026")).toBeVisible();
    await expect(card.getByText("10:00 AM Pacific / 1:00 PM Eastern")).toBeVisible();
    await expect(card.getByRole("button", { name: "Register" })).toBeVisible();
    await expect(card.getByText(/free Prime Mentor account is required/i)).toBeVisible();
    await expect(page.locator("body")).not.toContainText("sCZZBeMQQgOQwsYb9XuM7Q");
    await expect(page.locator("body")).not.toContainText("price_1UB1hYAd5V3LaCqjzuAw3IlI");
  });

  test("logged-out Register preserves purchase intent", async ({ page }) => {
    await openHomepage(page);
    await page.locator("#adronis-webinar").getByRole("button", { name: "Register" }).click();
    await expect(page).toHaveURL(/\/sign-up/);
    expect(page.url()).toContain(encodeURIComponent("/webinars/adronis-disclosure-to-contact?autocheckout=1"));
  });

  test("thank-you URL stays gated for logged-out visitors", async ({ page }) => {
    await page.goto(THANK_YOU);
    await expect(page.getByRole("heading", { name: /sign in to view webinar access/i }).or(page.locator(".cl-signIn-root"))).toBeVisible();
    await expect(page.getByRole("link", { name: /Register on Zoom/i })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("sCZZBeMQQgOQwsYb9XuM7Q");
  });

  test("protected checkout route asks logged-out visitors to sign in", async ({ page }) => {
    await page.goto(`${CHECKOUT}?autocheckout=1`);
    await expect(page.getByRole("heading", { name: /sign in to continue registration/i }).or(page.locator(".cl-signIn-root"))).toBeVisible();
    await expect(page.locator("body")).not.toContainText("sCZZBeMQQgOQwsYb9XuM7Q");
  });

  test("desktop card uses a two-column poster layout", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop two-column layout");
    await openHomepage(page);
    const card = page.locator("#adronis-webinar");
    const image = card.getByRole("img", { name: POSTER_ALT });
    const heading = card.getByRole("heading", { name: "Adronis: From Disclosure to Contact" });
    const imageBox = await image.boundingBox();
    const headingBox = await heading.boundingBox();
    expect(imageBox && headingBox).toBeTruthy();
    if (imageBox && headingBox) {
      expect(headingBox.x).toBeGreaterThan(imageBox.x + imageBox.width / 2);
    }
    const natural = await image.evaluate((node) => {
      const img = node as HTMLImageElement;
      return { width: img.naturalWidth, height: img.naturalHeight };
    });
    expect(natural.width / natural.height).toBeCloseTo(9 / 16, 1);
  });

  test("mobile card stacks without horizontal overflow", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile stacked layout");
    await openHomepage(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
    const button = page.locator("#adronis-webinar").getByRole("button", { name: "Register" });
    const box = await button.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.x + box.width).toBeLessThanOrEqual(390 + 2);
    }
  });
});
