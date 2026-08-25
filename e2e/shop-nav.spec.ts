import { expect, test, type Page } from "@playwright/test";

const API_BASE = process.env.SHOP_API_BASE_URL?.trim() || "http://127.0.0.1:3001";

const EXPECTED_SHOP_NAV = [
  { name: "Remote Source Bed Kit", slug: "remote-source-bed-kit" },
  { name: "Digital Safeguard Kit", slug: "digital-safeguard-kit" },
  { name: "Healing Code Cards: Source Deck — Body Set", slug: "healing-code-cards-source-deck-body-set" },
  { name: "Healing Code Cards: Body Deck", slug: "healing-code-cards-body-deck" },
  { name: "Healing Code Cards: Mind Deck", slug: "healing-code-cards-mind-deck" },
  { name: "Healing Code Cards: Energy Deck", slug: "healing-code-cards-energy-deck" },
];

function unwrapProducts(body: unknown): Array<{ slug?: string; name?: string }> {
  if (Array.isArray(body)) return body as Array<{ slug?: string; name?: string }>;
  if (body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)) {
    return (body as { data: Array<{ slug?: string; name?: string }> }).data;
  }
  return [];
}

async function openHomepage(page: Page) {
  await page.goto("/");
  await expect(page.locator("#hero")).toBeVisible();
}

test.describe("Shop navigation dropdown", () => {
  test("desktop Shop menu lists catalog products in gallery order", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop hover menu");
    const catalog = unwrapProducts(await (await request.get(`${API_BASE}/api/shop/products?featured=true`)).json());
    test.skip(catalog.length === 0, "Featured catalog is unavailable");
    expect(catalog.filter((item) => EXPECTED_SHOP_NAV.some((expected) => expected.slug === item.slug)).map((item) => item.slug)).toEqual(EXPECTED_SHOP_NAV.map((item) => item.slug));

    await openHomepage(page);
    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    await expect(nav.getByRole("link", { name: "Shop", exact: true })).toHaveAttribute("href", "/shop");
    await nav.getByRole("link", { name: "Shop", exact: true }).hover();
    const menu = page.locator('[data-nav-dropdown="Shop"]');
    await expect(menu).toBeVisible();
    const labels = (await menu.locator("a").allTextContents())
      .map((label) => label.trim())
      .filter((label) => EXPECTED_SHOP_NAV.some((item) => item.name === label));
    expect(labels).toEqual(EXPECTED_SHOP_NAV.map((item) => item.name));

    await menu.getByRole("link", { name: "Remote Source Bed Kit" }).click();
    await expect(page).toHaveURL(/\/shop\/remote-source-bed-kit$/);
    await expect(page.getByRole("heading", { level: 1, name: "Remote Source Bed Kit" })).toBeVisible();

    await page.goto("/");
    await nav.getByRole("link", { name: "Shop", exact: true }).hover();
    await page.locator('[data-nav-dropdown="Shop"]').getByRole("link", { name: "Digital Safeguard Kit" }).click();
    await expect(page).toHaveURL(/\/shop\/digital-safeguard-kit$/);

    await page.goto("/");
    await nav.getByRole("link", { name: "Shop", exact: true }).hover();
    await page.locator('[data-nav-dropdown="Shop"]').getByRole("link", { name: "Healing Code Cards: Body Deck" }).click();
    await expect(page).toHaveURL(/\/shop\/healing-code-cards-body-deck$/);

    await page.goto("/");
    await expect(nav.getByRole("link", { name: "Sessions" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Reports" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Subscriptions" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Events" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Links" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "About" })).toBeVisible();
  });

  test("tablet and mobile Shop accordion lists the same catalog order", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Hamburger Shop accordion");
    const catalog = unwrapProducts(await (await request.get(`${API_BASE}/api/shop/products?featured=true`)).json());
    test.skip(catalog.length === 0, "Featured catalog is unavailable");

    await openHomepage(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(mobileNav.getByRole("link", { name: "Shop", exact: true })).toHaveAttribute("href", "/shop");
    await mobileNav.getByRole("button", { name: "Expand Shop" }).click({ force: true });
    const menu = mobileNav.locator('[data-nav-dropdown="Shop"]');
    await expect(menu).toBeVisible();
    const labels = (await menu.locator("a").allTextContents())
      .map((label) => label.trim())
      .filter((label) => EXPECTED_SHOP_NAV.some((item) => item.name === label));
    expect(labels).toEqual(EXPECTED_SHOP_NAV.map((item) => item.name));
    await menu.getByRole("link", { name: "Remote Source Bed Kit" }).click();
    await expect(page).toHaveURL(/\/shop\/remote-source-bed-kit$/);
  });
});
