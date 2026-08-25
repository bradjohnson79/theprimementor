import { expect, test } from "@playwright/test";

const API_BASE = process.env.SHOP_API_BASE_URL?.trim() || "http://127.0.0.1:3001";

async function productHasTestimonials(request: { get: (url: string) => Promise<{ ok: () => boolean; json: () => Promise<unknown> }> }, slug: string) {
  try {
    const response = await request.get(`${API_BASE}/api/shop/products/${slug}`);
    if (!response.ok()) return false;
    const body = await response.json() as { data?: { testimonials?: unknown[] } } | { testimonials?: unknown[] };
    const product = body && typeof body === "object" && "data" in body ? body.data : body;
    return Boolean(product && Array.isArray(product.testimonials) && product.testimonials.length > 0);
  } catch {
    return false;
  }
}

async function expectCardOnlyGallery(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { name: /what customers are saying/i })).toBeVisible();
  await expect(page.getByText(/Experiences shared by people who have worked with the Healing Code Cards/i)).toBeVisible();
  await expect(page.getByText("Barb Salerno")).toBeVisible();
  await expect(page.getByText("Los Angeles, CA")).toBeVisible();
  await expect(page.getByText(/Originally shared regarding the Body & Mind Decks/i).first()).toBeVisible();
  await expect(page.getByText(/I began working with the Body and Mind cards a year ago/i)).toBeVisible();
  await expect(page.getByText("Alice Bacon")).toBeVisible();
  await expect(page.getByText(/Originally shared regarding the Body, Mind & Energy Decks/i).first()).toBeVisible();
  await expect(page.getByText(/I received my sample cards and within 4 days/i)).toBeVisible();
  await expect(page.getByText(/Customer testimonials reflect individual personal experiences/i)).toBeVisible();
  await expect(page.getByText(/face cloth/i)).toHaveCount(0);
  await expect(page.getByText(/t-shirts/i)).toHaveCount(0);
  await expect(page.getByText(/Aether Bed Trial Symbol/i)).toHaveCount(0);
  await expect(page.getByText("AetherX customer testimonial")).toHaveCount(0);
  const next = page.getByRole("button", { name: "Next testimonial" }).first();
  const previous = page.getByRole("button", { name: "Previous testimonial" }).first();
  await expect(next).toBeVisible();
  await expect(previous).toBeVisible();
  await next.click();
  await previous.click();
  await expect(page.getByText("Barb Salerno")).toBeVisible();
}

test.describe("Shop customer testimonials", () => {
  test("Body Deck shows a card-only testimonial gallery", async ({ page, request }) => {
    const seeded = await productHasTestimonials(request, "healing-code-cards-body-deck");
    await page.goto("/shop/healing-code-cards-body-deck");
    if (!seeded) {
      await expect(page.getByRole("heading", { name: "Healing Code Cards: Body Deck" })).toBeVisible();
      await expect(page.getByRole("heading", { name: /what customers are saying/i })).toHaveCount(0);
      return;
    }
    await expect(page.getByRole("heading", { name: "Healing Code Cards: Body Deck" })).toBeVisible();
    await expectCardOnlyGallery(page);
  });

  test("Mind Deck shows the same gallery without unrelated AetherX products", async ({ page, request }) => {
    const seeded = await productHasTestimonials(request, "healing-code-cards-mind-deck");
    await page.goto("/shop/healing-code-cards-mind-deck");
    if (!seeded) {
      await expect(page.getByRole("heading", { name: "Healing Code Cards: Mind Deck" })).toBeVisible();
      await expect(page.getByRole("heading", { name: /what customers are saying/i })).toHaveCount(0);
      return;
    }
    await expect(page.getByRole("heading", { name: "Healing Code Cards: Mind Deck" })).toBeVisible();
    await expectCardOnlyGallery(page);
  });

  test("Energy Deck gallery keeps historical context and excludes Energy from self-promo", async ({ page, request }) => {
    const seeded = await productHasTestimonials(request, "healing-code-cards-energy-deck");
    await page.goto("/shop/healing-code-cards-energy-deck");
    if (!seeded) {
      await expect(page.getByRole("heading", { name: "Healing Code Cards: Energy Deck" })).toBeVisible();
      await expect(page.getByRole("heading", { name: /what customers are saying/i })).toHaveCount(0);
      return;
    }
    await expect(page.getByRole("heading", { name: "Healing Code Cards: Energy Deck" })).toBeVisible();
    await expectCardOnlyGallery(page);
  });

  test("Source Deck gallery does not invent Source-specific quotes", async ({ page, request }) => {
    const seeded = await productHasTestimonials(request, "healing-code-cards-source-deck-body-set");
    await page.goto("/shop/healing-code-cards-source-deck-body-set");
    if (!seeded) {
      await expect(page.getByRole("heading", { name: "Healing Code Cards: Source Deck — Body Set" })).toBeVisible();
      await expect(page.getByRole("heading", { name: /what customers are saying/i })).toHaveCount(0);
      return;
    }
    await expect(page.getByRole("heading", { name: "Healing Code Cards: Source Deck — Body Set" })).toBeVisible();
    await expectCardOnlyGallery(page);
    await expect(page.getByText(/Originally shared regarding the Source Deck/i)).toHaveCount(0);
  });

  test("Remote Source Bed Kit does not show Healing Code Cards testimonials", async ({ page, request }) => {
    const seeded = await productHasTestimonials(request, "remote-source-bed-kit");
    await page.goto("/shop/remote-source-bed-kit");
    await expect(page.getByRole("heading", { name: "Remote Source Bed Kit", level: 1 })).toBeVisible();
    expect(seeded).toBe(false);
    await expect(page.getByRole("heading", { name: /what customers are saying/i })).toHaveCount(0);
    await expect(page.getByText("Barb Salerno")).toHaveCount(0);
    await expect(page.getByText("Alice Bacon")).toHaveCount(0);
  });

  test("Digital Safeguard Kit does not show Healing Code Cards testimonials", async ({ page, request }) => {
    const seeded = await productHasTestimonials(request, "digital-safeguard-kit");
    await page.goto("/shop/digital-safeguard-kit");
    await expect(page.getByRole("heading", { name: "Digital Safeguard Kit", level: 1 })).toBeVisible();
    expect(seeded).toBe(false);
    await expect(page.getByRole("heading", { name: /what customers are saying/i })).toHaveCount(0);
    await expect(page.getByText("Barb Salerno")).toHaveCount(0);
    await expect(page.getByText("Alice Bacon")).toHaveCount(0);
  });

  test("testimonial gallery is keyboard operable", async ({ page, request }) => {
    const seeded = await productHasTestimonials(request, "healing-code-cards-body-deck");
    await page.goto("/shop/healing-code-cards-body-deck");
    if (!seeded) {
      test.skip(true, "Testimonials have not been seeded.");
      return;
    }
    await expect(page.getByRole("heading", { name: /what customers are saying/i })).toBeVisible();
    const scroller = page.locator("[aria-labelledby]").filter({ hasText: /what customers are saying/i }).locator("div[tabindex='0']");
    await scroller.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("Barb Salerno")).toBeVisible();
  });
});
