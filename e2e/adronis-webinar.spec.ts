import { expect, test, type Page } from "@playwright/test";

const STAR_FAMILY = "/webinars/adronis-star-family-communion";
const STAR_FAMILY_THANKS = "/webinars/adronis-star-family-communion/thank-you";
const DISCLOSURE_THANKS = "/webinars/adronis-disclosure-to-contact/thank-you";
const DISCLOSURE_ON_DEMAND = "/webinars/adronis-disclosure-to-contact/on-demand";
const STAR_POSTER_ALT = "Adronis: Star Family Communion webinar poster featuring Brad Johnson meditating beneath a luminous mothership above Earth.";
const ZOOM_TOKEN = "eTHsHKnRQ16W0yoB5HaR6Q";
const DISCLOSURE_ZOOM_TOKEN = "sCZZBeMQQgOQwsYb9XuM7Q";

async function openHomepage(page: Page) {
  await page.goto("/");
  await expect(page.locator("#hero")).toBeVisible();
}

test.describe("Star Family homepage hierarchy", () => {
  test("places the live webinar above the compact on-demand card", async ({ page }) => {
    await openHomepage(page);
    const primary = page.locator("#star-family-communion");
    const compact = page.locator("#disclosure-on-demand-compact-heading");
    await expect(primary.getByRole("heading", { name: "Adronis: Star Family Communion" })).toBeVisible();
    await expect(primary.getByText("Saturday, October 17, 2026")).toBeVisible();
    await expect(primary.getByText("$14.99 CAD", { exact: true })).toBeVisible();
    await expect(primary.getByRole("button", { name: "Register Now — $14.99 CAD" })).toBeVisible();
    await expect(primary.getByRole("link", { name: "Learn More" })).toHaveAttribute("href", STAR_FAMILY);
    await expect(compact).toBeVisible();
    const compactSection = page.locator("section").filter({ has: page.locator("#disclosure-on-demand-compact-heading") });
    await expect(compactSection.getByRole("link", { name: "Learn More" })).toHaveAttribute("href", DISCLOSURE_ON_DEMAND);
    await expect(compactSection.getByRole("button", { name: "Purchase — $7.99 CAD" })).toBeVisible();

    const primaryBox = await primary.boundingBox();
    const compactBox = await compact.boundingBox();
    expect(primaryBox && compactBox).toBeTruthy();
    if (primaryBox && compactBox) {
      expect(compactBox.y).toBeGreaterThan(primaryBox.y);
    }

    await expect(page.locator("body")).not.toContainText(ZOOM_TOKEN);
    await expect(page.locator("body")).not.toContainText(DISCLOSURE_ZOOM_TOKEN);
  });

  test("signed-out Register Now preserves the Star Family purchase path", async ({ page }) => {
    await openHomepage(page);
    await page.locator("#star-family-communion").getByRole("button", { name: "Register Now — $14.99 CAD" }).click();
    await expect(page).toHaveURL(/\/sign-up/);
    expect(page.url()).toContain(encodeURIComponent(`${STAR_FAMILY}?autocheckout=1`));
    await expect(page.locator("body")).not.toContainText(ZOOM_TOKEN);
  });

  test("desktop primary section places copy beside the poster", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop two-column layout");
    await openHomepage(page);
    const section = page.locator("#star-family-communion");
    const image = section.getByRole("img", { name: STAR_POSTER_ALT });
    const heading = section.getByRole("heading", { name: "Adronis: Star Family Communion" });
    const imageBox = await image.boundingBox();
    const headingBox = await heading.boundingBox();
    expect(imageBox && headingBox).toBeTruthy();
    if (imageBox && headingBox) {
      expect(headingBox.x).toBeGreaterThan(imageBox.x);
    }
  });

  test("narrow layouts keep the page inside the viewport", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Narrow layout");
    await openHomepage(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
  });
});

test.describe("Star Family public landing", () => {
  test("shows the event and hides the Zoom registration URL", async ({ page }) => {
    await page.goto(STAR_FAMILY);
    await expect(page.getByRole("heading", { name: "Adronis: Star Family Communion", level: 1 })).toBeVisible();
    await expect(page.getByText("Saturday, October 17, 2026").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Register Now — $14.99 CAD" }).first()).toBeVisible();
    await expect(page.getByRole("img", { name: STAR_POSTER_ALT })).toBeVisible();
    await page.getByText("When is the webinar?").click();
    await expect(page.getByText("10:00 AM Pacific / 1:00 PM Eastern").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(ZOOM_TOKEN);
    await expect(page.locator('script[type="application/ld+json"]')).not.toContainText(ZOOM_TOKEN);
  });

  test("thank-you stays gated for signed-out visitors", async ({ page }) => {
    await page.goto(STAR_FAMILY_THANKS);
    await expect(page.getByRole("link", { name: /Register on Zoom/i })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(ZOOM_TOKEN);
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
});
