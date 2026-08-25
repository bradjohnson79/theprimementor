import { expect, test } from "@playwright/test";

const API_BASE = process.env.SHOP_API_BASE_URL?.trim() || "http://127.0.0.1:3001";

async function loadCatalog(request: { get: (url: string) => Promise<{ ok: () => boolean; json: () => Promise<unknown> }> }) {
  try {
    const response = await request.get(`${API_BASE}/api/shop/products`);
    if (!response.ok()) return null;
    const body = await response.json() as { data?: unknown } | unknown;
    if (body && typeof body === "object" && "data" in body) {
      return (body as { data: unknown }).data;
    }
    return body;
  } catch {
    return null;
  }
}

test.describe("Prime Mentor Shop public journeys", () => {
  test("Shop landing lists Body, Mind, Energy, and Source Decks from the catalog", async ({ page, request }) => {
    const catalog = await loadCatalog(request);
    await page.goto("/shop");
    await expect(page.getByRole("heading", { name: /digital tools/i })).toBeVisible();

    if (Array.isArray(catalog) && catalog.length > 0) {
      const bodyDeck = catalog.find((item) => (
        item && typeof item === "object" && "slug" in item && item.slug === "healing-code-cards-body-deck"
      )) as { name?: string; priceLabel?: string; formatLabel?: string } | undefined;
      const mindDeck = catalog.find((item) => (
        item && typeof item === "object" && "slug" in item && item.slug === "healing-code-cards-mind-deck"
      )) as { name?: string; priceLabel?: string; formatLabel?: string } | undefined;
      expect(bodyDeck?.name).toBe("Healing Code Cards: Body Deck");
      expect(bodyDeck?.priceLabel).toBe("$24.99 CAD");
      expect(bodyDeck?.formatLabel).toBe("Digital Edition");
      expect(mindDeck?.name).toBe("Healing Code Cards: Mind Deck");
      expect(mindDeck?.priceLabel).toBe("$24.99 CAD");
      expect(mindDeck?.formatLabel).toBe("Digital Edition");
      const energyDeck = catalog.find((item) => (
        item && typeof item === "object" && "slug" in item && item.slug === "healing-code-cards-energy-deck"
      )) as { name?: string; formatLabel?: string } | undefined;
      expect(energyDeck?.name).toBe("Healing Code Cards: Energy Deck");
      expect(energyDeck?.formatLabel).toBe("Digital Edition");
      const sourceDeck = catalog.find((item) => (
        item && typeof item === "object" && "slug" in item && item.slug === "healing-code-cards-source-deck-body-set"
      )) as { name?: string; formatLabel?: string } | undefined;
      expect(sourceDeck?.name).toBe("Healing Code Cards: Source Deck — Body Set");
      expect(sourceDeck?.formatLabel).toBe("Digital Edition");
      const safeguardKit = catalog.find((item) => (
        item && typeof item === "object" && "slug" in item && item.slug === "digital-safeguard-kit"
      )) as { name?: string; subtitle?: string; formatLabel?: string; priceLabel?: string } | undefined;
      expect(safeguardKit?.name).toBe("Digital Safeguard Kit");
      expect(safeguardKit?.subtitle).toBe("Personal & Environmental Safeguard Sets");
      expect(safeguardKit?.formatLabel).toBe("Digital Edition");
      expect(safeguardKit?.priceLabel).toBe("$29.99 CAD");
      await expect(page.getByRole("heading", { name: "Healing Code Cards: Body Deck" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Healing Code Cards: Mind Deck" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Healing Code Cards: Energy Deck" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Healing Code Cards: Source Deck — Body Set" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Digital Safeguard Kit" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Remote Source Bed Kit" })).toBeVisible();
      await expect(page.getByText("Personal & Environmental Safeguard Sets").first()).toBeVisible();
      await expect(page.getByText("Printable Digital Edition").first()).toBeVisible();
      await expect(page.getByText("$24.99 CAD").first()).toBeVisible();
      await expect(page.getByText("$29.99 CAD").first()).toBeVisible();
      await expect(page.getByText("$69.99 CAD").first()).toBeVisible();
      await expect(page.getByText("Digital Edition").first()).toBeVisible();
      await expect(page.getByRole("link", { name: "View Product" }).first()).toBeVisible();
    } else {
      await expect(page.getByText(/no digital products|unable to load the shop|loading shop products/i)).toBeVisible();
    }
  });

  test("Body Deck product page shows Digital Edition, price, and purchase CTA", async ({ page, request }) => {
    const catalog = await loadCatalog(request);
    await page.goto("/shop/healing-code-cards-body-deck");

    if (Array.isArray(catalog) && catalog.some((item) => item && typeof item === "object" && "slug" in item && item.slug === "healing-code-cards-body-deck")) {
      await expect(page.getByRole("heading", { name: "Healing Code Cards: Body Deck" })).toBeVisible();
      await expect(page.getByText("Digital Edition").first()).toBeVisible();
      await expect(page.getByText("$24.99 CAD").first()).toBeVisible();
      await expect(page.getByRole("button", { name: /Purchase .+ — \$[\d.]+ CAD/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /download .*(instruction|manual|booklet)/i })).toBeVisible();
      const embed = page.locator("iframe[title='Free Healing Code Cards E-Course']");
      if (await embed.count()) {
        await expect(embed).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/3Kd2zR1_FnA/);
      }
    } else {
      await expect(page.getByText(/not available|unable to load this product/i)).toBeVisible();
    }
  });

  test("Mind Deck product page shows catalog copy, e-course, and purchase CTA", async ({ page, request }) => {
    const catalog = await loadCatalog(request);
    await page.goto("/shop/healing-code-cards-mind-deck");

    if (Array.isArray(catalog) && catalog.some((item) => item && typeof item === "object" && "slug" in item && item.slug === "healing-code-cards-mind-deck")) {
      await expect(page.getByRole("heading", { name: "Healing Code Cards: Mind Deck" })).toBeVisible();
      await expect(page.getByText("Digital Edition").first()).toBeVisible();
      await expect(page.getByText("$24.99 CAD").first()).toBeVisible();
      await expect(page.getByText(/36-card/i).first()).toBeVisible();
      await expect(page.getByText(/22 Releaser/i).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /Purchase .+ — \$[\d.]+ CAD/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /download .*(instruction|manual|booklet)/i })).toBeVisible();
      await expect(page.getByText(/not medical devices, medicines, diagnostic tools or substitutes for professional medical or mental-health care/i)).toBeVisible();
      const embed = page.locator("iframe[title='Free Healing Code Cards E-Course']");
      if (await embed.count()) {
        await expect(embed).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/bMsyTvQSzDU/);
      }
    } else {
      await expect(page.getByText(/not available|unable to load this product/i)).toBeVisible();
    }
  });

  test("Energy Deck product page shows 44-card copy, booklet, and catalog e-course", async ({ page, request }) => {
    const catalog = await loadCatalog(request);
    await page.goto("/shop/healing-code-cards-energy-deck");

    if (Array.isArray(catalog) && catalog.some((item) => item && typeof item === "object" && "slug" in item && item.slug === "healing-code-cards-energy-deck")) {
      await expect(page.getByRole("heading", { name: "Healing Code Cards: Energy Deck" })).toBeVisible();
      await expect(page.getByText("Digital Edition").first()).toBeVisible();
      await expect(page.getByText(/44-card digital spiritual wellness deck/i).first()).toBeVisible();
      await expect(page.getByText("1 Positive Polarity Collector", { exact: true })).toBeVisible();
      await expect(page.getByText("1 Negative Polarity Receiver", { exact: true })).toBeVisible();
      await expect(page.getByText("30 Purifier Cards").first()).toBeVisible();
      await expect(page.getByText("7 Integrator Cards").first()).toBeVisible();
      await expect(page.getByText("1 Conflict Energy Container", { exact: true })).toBeVisible();
      await expect(page.getByText("4 Amplifier Cards").first()).toBeVisible();
      await expect(page.getByText(/not medical devices, medicines, diagnostic tools or substitutes for professional healthcare/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /Purchase .+ — \$[\d.]+ CAD/ })).toBeEnabled();
      await expect(page.getByRole("link", { name: /download .*(instruction|manual|booklet)/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Free Healing Code Cards E-Course" })).toBeVisible();
      const embed = page.locator("iframe[title='Free Healing Code Cards E-Course']");
      await expect(embed).toBeVisible();
      await expect(embed).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/_DniHEzLgps/);
      const box = await embed.boundingBox();
      expect(box?.width).toBeGreaterThan(300);
      await expect(page.getByText(/Second Edition|Special Edition/i)).toHaveCount(0);
    } else {
      await expect(page.getByText(/not available|unable to load this product/i)).toBeVisible();
    }
  });

  for (const { name, width, height } of [
    { name: "mobile", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 800 },
  ] as const) {
    test(`Energy Deck e-course embed is responsive on ${name}`, async ({ page, request }) => {
      const catalog = await loadCatalog(request);
      if (!Array.isArray(catalog) || !catalog.some((item) => item && typeof item === "object" && "slug" in item && item.slug === "healing-code-cards-energy-deck")) {
        test.skip(true, "Energy Deck is not in the local catalog.");
        return;
      }
      await page.setViewportSize({ width, height });
      await page.goto("/shop/healing-code-cards-energy-deck");
      const heading = page.getByRole("heading", { name: "Free Healing Code Cards E-Course" });
      await expect(heading).toBeVisible();
      const embed = page.locator("iframe[title='Free Healing Code Cards E-Course']");
      await expect(embed).toBeVisible();
      await expect(embed).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/_DniHEzLgps/);
      const box = await embed.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.width).toBeGreaterThan(width * 0.7);
      expect(box!.width).toBeLessThanOrEqual(width);
      expect(box!.height).toBeGreaterThan(120);
    });
  }

  test("Source Deck product page shows 28-card Balancer copy, booklet, and no empty e-course", async ({ page, request }) => {
    const catalog = await loadCatalog(request);
    await page.goto("/shop/healing-code-cards-source-deck-body-set");

    if (Array.isArray(catalog) && catalog.some((item) => item && typeof item === "object" && "slug" in item && item.slug === "healing-code-cards-source-deck-body-set")) {
      await expect(page.getByRole("heading", { name: "Healing Code Cards: Source Deck — Body Set" })).toBeVisible();
      await expect(page.getByText("Digital Edition").first()).toBeVisible();
      await expect(page.getByText(/28-card digital spiritual wellness deck/i).first()).toBeVisible();
      await expect(page.getByText("Brain Balancer").first()).toBeVisible();
      await expect(page.getByText("DNA Balancer").first()).toBeVisible();
      await expect(page.getByText(/unified/).first()).toBeVisible();
      await expect(page.getByText(/Scalar-wave concepts/i)).toBeVisible();
      await expect(page.getByText(/Earth Schumann Resonance — 7.83 Hz/i)).toBeVisible();
      await expect(page.getByText(/Remote Transmission Method/i)).toBeVisible();
      await expect(page.getByText(/scalar waves, Kundalini, Sekhmet, lattice work/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /Purchase .+ — \$[\d.]+ CAD/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Purchase .+ — \$[\d.]+ CAD/ })).toBeEnabled();
      await expect(page.getByRole("link", { name: /download .*(instruction|manual|booklet)/i })).toBeVisible();
      await expect(page.locator("iframe[title='Free Healing Code Cards E-Course']")).toHaveCount(0);
      await expect(page.getByText(/AetherX Source Deck/i)).toHaveCount(0);
    } else {
      await expect(page.getByText(/not available|unable to load this product/i)).toBeVisible();
    }
  });

  test("Digital Safeguard Kit product page shows two-system copy, safety, and instruction CTA", async ({ page, request }) => {
    const catalog = await loadCatalog(request);
    await page.goto("/shop/digital-safeguard-kit");

    if (Array.isArray(catalog) && catalog.some((item) => item && typeof item === "object" && "slug" in item && item.slug === "digital-safeguard-kit")) {
      await expect(page.getByRole("heading", { name: "Digital Safeguard Kit", level: 1 })).toBeVisible();
      await expect(page.getByText("Personal & Environmental Safeguard Sets").first()).toBeVisible();
      await expect(page.getByText("Digital Edition").first()).toBeVisible();
      await expect(page.getByText("$29.99 CAD").first()).toBeVisible();
      await expect(page.getByText(/Formerly called AetherX Digital Safeguards/i).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Personal Safeguard Set", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Environmental Safeguard Set", exact: true })).toBeVisible();
      await expect(page.getByText(/Image Strips/i).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Important Placement Safety" })).toBeVisible();
      await expect(page.getByText(/Never touch exposed wiring/i)).toBeVisible();
      await expect(page.getByText(/not a medical device, radiation-protection device, EMF shielding product/i)).toBeVisible();
      await expect(page.getByText(/awaiting attachment/i).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /Purchase .+ — \$[\d.]+ CAD/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Purchase .+ — \$[\d.]+ CAD/ })).toBeEnabled();
      await expect(page.getByRole("link", { name: /download digital safeguard kit instructions/i })).toBeVisible();
      await expect(page.getByRole("button", { name: "Download instruction manual" })).toHaveCount(0);
      await expect(page.locator("iframe[title='Free Healing Code Cards E-Course']")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: /what customers are saying/i })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: /explore the other healing code card decks/i })).toHaveCount(0);
    } else {
      await expect(page.getByText(/not available|unable to load this product/i)).toBeVisible();
    }
  });

  test("Remote Source Bed Kit product page shows printable setup copy, video, and purchaser-only manual", async ({ page, request }) => {
    const catalog = await loadCatalog(request);
    await page.goto("/shop/remote-source-bed-kit");

    if (Array.isArray(catalog) && catalog.some((item) => item && typeof item === "object" && "slug" in item && item.slug === "remote-source-bed-kit")) {
      await expect(page.getByRole("heading", { name: "Remote Source Bed Kit", level: 1 })).toBeVisible();
      await expect(page.getByText("Printable Digital Edition").first()).toBeVisible();
      await expect(page.getByText("$69.99 CAD").first()).toBeVisible();
      await expect(page.getByText(/Transform virtually any bed, couch or recliner/i).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Four Directional Geometry Arrays" })).toBeVisible();
      await expect(page.getByText("North Directional Geometry Array").first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Intersecting Figure-8 Geometry" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Physical Body Concentrator", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Subtle Body Concentrator", exact: true })).toBeVisible();
      await expect(page.getByText(/Full-color printing/i).first()).toBeVisible();
      await expect(page.getByText(/does not require a separate activation ritual/i)).toBeVisible();
      await expect(page.getByRole("heading", { name: "How to Set Up Your Remote Source Bed Kit" })).toBeVisible();
      await expect(page.locator("iframe[title='How to Set Up Your Remote Source Bed Kit']")).toBeVisible();
      await expect(page.locator("iframe[title='How to Set Up Your Remote Source Bed Kit']")).toHaveAttribute("src", /WT0bY_Vme94/);
      await expect(page.getByText("Remote Source Bed Kit Instruction Manual").first()).toBeVisible();
      await expect(page.getByText(/Instruction manual is included with purchase/i)).toBeVisible();
      await expect(page.getByRole("button", { name: "Download instruction manual" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: /download remote source bed kit/i })).toHaveCount(0);
      await expect(page.getByText(/not a medical device, diagnostic tool, therapeutic bed/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /Purchase .+ — \$[\d.]+ CAD/ })).toBeEnabled();
      await expect(page.getByRole("heading", { name: /what customers are saying/i })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: /explore the other healing code card decks/i })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: /explore more digital wellness tools/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Digital Safeguard Kit" })).toBeVisible();
    } else {
      await expect(page.getByText(/not available|unable to load this product/i)).toBeVisible();
    }
  });

  test("Body Deck cross-promotes the other active Healing Code Cards", async ({ page, request }) => {
    const catalog = await loadCatalog(request);
    await page.goto("/shop/healing-code-cards-body-deck");
    if (!Array.isArray(catalog) || !catalog.some((item) => item && typeof item === "object" && "slug" in item && item.slug === "healing-code-cards-body-deck")) {
      await expect(page.getByText(/not available|unable to load this product/i)).toBeVisible();
      return;
    }
    await expect(page.getByRole("heading", { name: /explore the other healing code card decks/i })).toBeVisible();
    const promo = page.getByRole("region", { name: /explore the other healing code card decks/i });
    await expect(promo.getByRole("heading", { name: "Healing Code Cards: Body Deck" })).toHaveCount(0);
    await expect(promo.getByRole("heading", { name: "Healing Code Cards: Mind Deck" })).toBeVisible();
    await expect(promo.getByRole("heading", { name: "Healing Code Cards: Energy Deck" })).toBeVisible();
    await expect(promo.getByRole("heading", { name: "Healing Code Cards: Source Deck — Body Set" })).toBeVisible();
    await expect(promo.getByRole("heading", { name: "Digital Safeguard Kit" })).toHaveCount(0);
    await expect(promo.getByRole("heading", { name: "Remote Source Bed Kit" })).toHaveCount(0);
    await expect(promo.getByText("Digital Edition").first()).toBeVisible();
    await expect(promo.getByText("$24.99 CAD").first()).toBeVisible();
    await promo.getByRole("link", { name: /Healing Code Cards: Mind Deck/i }).click();
    await expect(page).toHaveURL(/\/shop\/healing-code-cards-mind-deck/);
  });

  test("Mind, Energy, and Source pages exclude the current deck from cross-promotion", async ({ page, request }) => {
    const catalog = await loadCatalog(request);
    if (!Array.isArray(catalog) || catalog.length < 4) {
      test.skip(true, "Full Healing Code Cards catalog is not available.");
      return;
    }

    await page.goto("/shop/healing-code-cards-mind-deck");
    const mindPromo = page.getByRole("region", { name: /explore the other healing code card decks/i });
    await expect(mindPromo.getByRole("heading", { name: "Healing Code Cards: Mind Deck" })).toHaveCount(0);
    await expect(mindPromo.getByRole("heading", { name: "Healing Code Cards: Body Deck" })).toBeVisible();

    await page.goto("/shop/healing-code-cards-energy-deck");
    const energyPromo = page.getByRole("region", { name: /explore the other healing code card decks/i });
    await expect(energyPromo.getByRole("heading", { name: "Healing Code Cards: Energy Deck" })).toHaveCount(0);
    await expect(energyPromo.getByRole("heading", { name: "Healing Code Cards: Source Deck — Body Set" })).toBeVisible();

    await page.goto("/shop/healing-code-cards-source-deck-body-set");
    const sourcePromo = page.getByRole("region", { name: /explore the other healing code card decks/i });
    await expect(sourcePromo.getByRole("heading", { name: "Healing Code Cards: Source Deck — Body Set" })).toHaveCount(0);
    await expect(sourcePromo.getByRole("heading", { name: "Healing Code Cards: Body Deck" })).toBeVisible();
    await expect(sourcePromo.getByRole("link", { name: /View Deck/i }).first()).toBeVisible();
  });

  test("invalid Shop slug shows a status page, not a blank screen", async ({ page }) => {
    await page.goto("/shop/this-product-does-not-exist");
    await expect(page.getByRole("heading", { name: "This Shop product is not available." })).toBeVisible();
    await expect(page.locator("body")).not.toHaveText(/^$/);
  });
});
