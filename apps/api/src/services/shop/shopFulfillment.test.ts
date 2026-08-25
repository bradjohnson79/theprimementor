import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { resolveNotificationTemplate } from "../notifications/templates/index.js";
import { maskEmail, readShopFulfillmentRecord } from "./shopFulfillmentService.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../");

const EXPECTED_DOWNLOADS = {
  "healing-code-cards-body-deck": "https://drive.google.com/drive/folders/1SJw4BK9jWK0yzSol9bdNc6EiVTALMWJK?usp=sharing",
  "healing-code-cards-mind-deck": "https://drive.google.com/drive/folders/1EIBuHMGOcTYsmyZtEa0XHzqJ2zr7mhG1?usp=sharing",
  "healing-code-cards-energy-deck": "https://drive.google.com/drive/folders/1n49uVAUqqze51JAtHZhS1QMdG22yZSJp?usp=sharing",
  "healing-code-cards-source-deck-body-set": "https://drive.google.com/drive/folders/12XygFrHVkszd6TFFGmpODWUcs8Tuqdc_?usp=sharing",
  "digital-safeguard-kit": "https://drive.google.com/drive/folders/1VGlbedF6AbqFly5So0Bp1-Xi80HFupyB?usp=sharing",
  "remote-source-bed-kit": "https://drive.google.com/file/d/1AzNBGO807C9b_JiIn_ldvSRGr1D37UzW/view?usp=sharing",
} as const;

describe("Shop digital fulfillment", () => {
  it("masks customer emails", () => {
    assert.equal(maskEmail("brad@example.com"), "b***@example.com");
    assert.equal(maskEmail("  A@x.io "), "a***@x.io");
    assert.equal(maskEmail("not-an-email"), null);
  });

  it("reads folder and file fulfillment URLs without rewriting them", () => {
    const folder = readShopFulfillmentRecord({
      fulfillment_type: "external_download",
      fulfillment_download_url: EXPECTED_DOWNLOADS["healing-code-cards-body-deck"],
      fulfillment_download_label: "Download Your Product",
      fulfillment_email_enabled: true,
      fulfillment_instructions: null,
    } as Parameters<typeof readShopFulfillmentRecord>[0]);
    assert.equal(folder.downloadUrl, EXPECTED_DOWNLOADS["healing-code-cards-body-deck"]);
    assert.match(folder.downloadUrl ?? "", /\/drive\/folders\//);

    const file = readShopFulfillmentRecord({
      fulfillment_type: "external_download",
      fulfillment_download_url: EXPECTED_DOWNLOADS["remote-source-bed-kit"],
      fulfillment_download_label: null,
      fulfillment_email_enabled: true,
      fulfillment_instructions: null,
    } as Parameters<typeof readShopFulfillmentRecord>[0]);
    assert.equal(file.downloadUrl, EXPECTED_DOWNLOADS["remote-source-bed-kit"]);
    assert.match(file.downloadUrl ?? "", /\/file\/d\//);
    assert.equal(file.downloadLabel, "Download Your Product");
  });

  it("seeds all six Drive destinations from catalog data, not product-specific checkout code", () => {
    const seed = readFileSync(path.join(repoRoot, "packages/db/src/seed-shop.ts"), "utf8");
    const checkout = readFileSync(path.join(repoRoot, "apps/api/src/services/paymentService.ts"), "utf8");
    const success = readFileSync(path.join(repoRoot, "apps/web/src/routes/ShopSuccess.tsx"), "utf8");
    for (const [slug, url] of Object.entries(EXPECTED_DOWNLOADS)) {
      assert.match(seed, new RegExp(slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(seed, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.equal(checkout.includes(url), false);
      assert.equal(success.includes(url), false);
    }
    assert.equal(/if\s*\(.*slug.*body-deck/.test(success), false);
    assert.match(checkout, /\/shop\/order\/success\?session_id=\{CHECKOUT_SESSION_ID\}/);
  });

  it("renders a Prime Mentor fulfillment email from the product fulfillment record", () => {
    const rendered = resolveNotificationTemplate("shop.digital_fulfillment", {
      entityId: "order-1",
      orderId: "order-1",
      productName: "Healing Code Cards: Energy Deck",
      downloadUrl: EXPECTED_DOWNLOADS["healing-code-cards-energy-deck"],
      downloadLabel: "Download Your Product",
      firstName: "Alex",
      instructions: null,
    });
    assert.equal(rendered.subject, "Your Healing Code Cards: Energy Deck Is Ready");
    assert.match(rendered.html, /Thank You for Your Order/);
    assert.match(rendered.html, /Hi Alex/);
    assert.match(rendered.html, /Download Your Product/);
    assert.match(rendered.html, new RegExp(EXPECTED_DOWNLOADS["healing-code-cards-energy-deck"].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(rendered.html, /junk or spam folder/i);
    assert.match(rendered.html, /The Prime Mentor/);
    assert.match(rendered.html, /Brad Johnson/);
    assert.equal(rendered.html.includes("sk_live"), false);
    assert.equal(rendered.html.includes("STRIPE_SECRET"), false);
  });

  it("does not expose fulfillment URLs on the public catalog serializer", () => {
    const catalog = readFileSync(path.join(repoRoot, "apps/api/src/services/shop/shopCatalog.ts"), "utf8");
    const serializer = catalog.slice(catalog.indexOf("return {"));
    assert.equal(serializer.includes("fulfillment_download_url"), false);
    assert.equal(serializer.includes("fulfillmentDownloadUrl"), false);
    assert.equal(serializer.includes("drive.google.com"), false);
  });

  it("keeps payment simulation artifacts out of normal runtime source", () => {
    const forbidden = [
      "cs_test_shop_",
      "paid=true",
      "skipStripe",
      "bypassPayment",
      "mockPaid",
    ];
    const skipDir = new Set(["node_modules", "dist", "build", ".turbo"]);
    const skipFile = (file: string) =>
      file.endsWith(".test.ts")
      || file.endsWith("shopFulfillmentTestStub.ts")
      || file.endsWith("shopFulfillmentSuccessView.test.ts");

    function walk(dir: string, files: string[] = []) {
      for (const entry of readdirSync(dir)) {
        if (skipDir.has(entry)) continue;
        const full = path.join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) walk(full, files);
        else if (/\.(ts|tsx|js|jsx)$/.test(entry) && !skipFile(entry)) files.push(full);
      }
      return files;
    }

    const files = [
      ...walk(path.join(repoRoot, "apps/web/src")),
      ...walk(path.join(repoRoot, "apps/api/src")),
    ];
    const retrieve = readFileSync(path.join(repoRoot, "apps/api/src/services/shop/shopCheckoutSessionRetrieve.ts"), "utf8");
    assert.match(retrieve, /NODE_ENV === "production"/);
    assert.match(retrieve, /SHOP_TEST_FULFILLMENT/);
    assert.match(retrieve, /Unknown shop test checkout session/);
    assert.equal(retrieve.includes("cs_test_shop_"), false);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const token of forbidden) {
        assert.equal(source.includes(token), false, `${path.relative(repoRoot, file)} must not contain ${token}`);
      }
    }
  });
});
