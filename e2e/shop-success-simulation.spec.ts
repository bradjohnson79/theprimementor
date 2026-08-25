import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  SHOP_QA_STORAGE_STATE,
  SHOP_TEST_READY_FIXTURES,
  SHOP_TEST_SESSION_IDS,
  cleanupShopSuccessFixtures,
  routeShopSuccessApi,
  markProcessingFixturePurchased,
  seedEmailFailedFixture,
  seedMissingFulfillmentFixture,
  seedProcessingFixture,
  seedReadyFixture,
} from "./helpers/shopSuccessFixture";

test.describe.configure({ mode: "serial" });

function clerkStorageAvailable() {
  return existsSync(SHOP_QA_STORAGE_STATE);
}

function clerkSkipReason() {
  try {
    return readFileSync("e2e/.auth/SKIP_REASON.txt", "utf8").trim() || "Clerk storage state is missing.";
  } catch {
    return "Clerk storage state is missing.";
  }
}

async function openSuccess(page: Page, sessionId: string, extraQuery = "") {
  await page.goto(`/shop/order/success?session_id=${encodeURIComponent(sessionId)}${extraQuery}`);
}

test.describe("Shop thank-you simulation", () => {
  test.use({ storageState: clerkStorageAvailable() ? SHOP_QA_STORAGE_STATE : { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    test.skip(!clerkStorageAvailable(), clerkSkipReason());
    await routeShopSuccessApi(page);
  });

  test.afterEach(async () => {
    await cleanupShopSuccessFixtures();
  });

  for (const fixture of SHOP_TEST_READY_FIXTURES) {
    test(`ready state for ${fixture.name}`, async ({ page }, testInfo) => {
      const project = testInfo.project.name;
      if (project === "tablet") {
        test.skip(fixture.key !== "body" && fixture.key !== "safeguard", "Tablet covers Body and Safeguard");
      }
      if (project === "mobile") {
        test.skip(fixture.key !== "body" && fixture.key !== "bed", "Mobile covers Body and Bed Kit");
      }

      await seedReadyFixture(fixture.slug, fixture.sessionId);
      await openSuccess(page, fixture.sessionId);
      await expect(page.getByRole("heading", { name: "Thank You for Your Order" })).toBeVisible();
      await expect(page.getByText(`Your purchase of ${fixture.name} is complete.`)).toBeVisible();
      await expect(page.getByRole("heading", { name: fixture.name, exact: true }).first()).toBeVisible();
      const download = page.getByRole("link", { name: "Download Your Product" });
      await expect(download).toBeVisible();
      await expect(download).toHaveAttribute("href", fixture.downloadUrl);
      await expect(download).toHaveAttribute("target", "_blank");
      await expect(download).toHaveAttribute("rel", /noopener/);
      for (const other of SHOP_TEST_READY_FIXTURES) {
        if (other.downloadUrl === fixture.downloadUrl) continue;
        await expect(page.locator(`a[href="${other.downloadUrl}"]`)).toHaveCount(0);
      }
      await expect(page.getByRole("heading", { name: /we've also emailed your download/i })).toBeVisible();
      await expect(page.getByText(/junk or spam folder/i)).toBeVisible();
      await expect(page.getByRole("link", { name: "Return to Shop" })).toBeVisible();
      const image = page.locator("img").first();
      await expect(image).toBeVisible();
      await expect(image).toHaveAttribute("alt", new RegExp(fixture.name.split(":")[0] || fixture.name, "i"));

      if (project === "mobile") {
        const scroll = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }));
        expect(scroll.width).toBeLessThanOrEqual(scroll.client + 2);
        const box = await download.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(36);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(page.viewportSize()!.width + 2);
      }

      await page.screenshot({
        path: `e2e/evidence/shop-success-${fixture.key}-${project}.png`,
        fullPage: true,
      });
    });
  }

  test("processing becomes ready after entitlement is granted", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Processing race is covered once on desktop");
    await seedProcessingFixture();
    await openSuccess(page, SHOP_TEST_SESSION_IDS.processing);
    await expect(page.getByRole("heading", { name: "Your payment was successful" })).toBeVisible();
    await expect(page.getByText(/preparing your download/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Download Your Product" })).toHaveCount(0);
    await markProcessingFixturePurchased();
    await expect(page.getByRole("link", { name: "Download Your Product" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Thank You for Your Order" })).toBeVisible();
  });

  test("invalid session has no download URL", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    await openSuccess(page, "cs_test_shop_unknown");
    await expect(page.getByRole("heading", { name: "Thank You for Your Order" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download Your Product" })).toHaveCount(0);
    await expect(page.locator("a[href*='drive.google.com']")).toHaveCount(0);
    await expect(page.getByText(/could not be verified|not a Shop purchase|preparing/i)).toBeVisible();
  });

  test("unpaid and canceled fixtures never reveal a Drive URL", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    await openSuccess(page, SHOP_TEST_SESSION_IDS.unpaid);
    await expect(page.getByRole("heading", { name: "This payment is not complete" })).toBeVisible();
    await expect(page.locator("a[href*='drive.google.com']")).toHaveCount(0);

    await openSuccess(page, SHOP_TEST_SESSION_IDS.canceled);
    await expect(page.getByRole("heading", { name: "This payment is not complete" })).toBeVisible();
    await expect(page.locator("a[href*='drive.google.com']")).toHaveCount(0);
  });

  test("missing fulfillment does not fabricate a URL", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    await seedMissingFulfillmentFixture();
    await openSuccess(page, SHOP_TEST_SESSION_IDS.missingFulfillment);
    await expect(page.getByText(/contact support/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Download Your Product" })).toHaveCount(0);
    await expect(page.locator("a[href*='drive.google.com']")).toHaveCount(0);
  });

  test("email failure keeps the download and does not claim delivery", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    await seedEmailFailedFixture();
    await openSuccess(page, SHOP_TEST_SESSION_IDS.emailFailed);
    await expect(page.getByRole("link", { name: "Download Your Product" })).toBeVisible();
    await expect(page.getByText(/weren't able to confirm delivery/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /we've also emailed your download/i })).toHaveCount(0);
  });

  test("browser-supplied download query is ignored", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    const fixture = SHOP_TEST_READY_FIXTURES[0];
    await seedReadyFixture(fixture.slug, fixture.sessionId);
    await openSuccess(
      page,
      fixture.sessionId,
      "&download=https://drive.google.com/drive/folders/wrong&paid=true&product=mind",
    );
    const download = page.getByRole("link", { name: "Download Your Product" });
    await expect(download).toHaveAttribute("href", fixture.downloadUrl);
    await expect(page.locator("a[href*='drive.google.com/drive/folders/wrong']")).toHaveCount(0);
  });

  test("download and return links are keyboard reachable", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    const fixture = SHOP_TEST_READY_FIXTURES[0];
    await seedReadyFixture(fixture.slug, fixture.sessionId);
    await openSuccess(page, fixture.sessionId);
    const download = page.getByRole("link", { name: "Download Your Product" });
    await expect(download).toBeVisible();
    await page.keyboard.press("Tab");
    let reachedDownload = false;
    let reachedReturn = false;
    for (let i = 0; i < 20; i += 1) {
      const active = await page.evaluate(() => document.activeElement?.textContent?.trim() || "");
      if (active.includes("Download Your Product")) reachedDownload = true;
      if (active.includes("Return to Shop")) reachedReturn = true;
      if (reachedDownload && reachedReturn) break;
      await page.keyboard.press("Tab");
    }
    expect(reachedDownload).toBeTruthy();
    expect(reachedReturn).toBeTruthy();
  });
});

test.describe("Shop thank-you signed-out simulation", () => {
  test("forged query params never invent a download", async ({ page }, testInfo) => {
    await page.goto("/shop/order/success?session_id=cs_test_shop_unknown&download=https://drive.google.com/drive/folders/fake&paid=true&product=body");
    await expect(page.getByRole("heading", { name: "Thank You for Your Order" })).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in to open your download/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Return to Shop" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download Your Product" })).toHaveCount(0);
    await expect(page.locator("a[href*='drive.google.com']")).toHaveCount(0);
    await page.screenshot({ path: `e2e/evidence/shop-success-signed-out-${testInfo.project.name}.png`, fullPage: true });
  });
});
