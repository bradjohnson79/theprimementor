import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const outDir = process.argv[2] || "/Users/bradjohnson/Documents/primementor-revamp/before";
const base = "http://localhost:3000";
const pages = [
  ["home", "/"],
  ["mentoring", "/sessions/mentoring"],
  ["qa", "/sessions/qa"],
  ["reports", "/reports"],
  ["shop", "/shop"],
  ["subscriptions", "/subscriptions/seeker"],
  ["about", "/about"],
  ["media", "/media"],
  ["prime-alchemy", "/webinars/prime-alchemy-teachings"],
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();

async function shot(viewport, suffix) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  for (const [name, route] of pages) {
    await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: path.join(outDir, `${name}-${suffix}.png`),
      fullPage: name === "home",
    });
    console.log(`wrote ${name}-${suffix}`);
  }
  await context.close();
}

await shot({ width: 1440, height: 900 }, "desktop");
await shot({ width: 390, height: 844 }, "mobile");
await browser.close();
console.log("screenshots written to", outDir);
