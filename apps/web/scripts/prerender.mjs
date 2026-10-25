#!/usr/bin/env node
/**
 * Post-build prerender (AI/SEO round, Oct 25 2026).
 *
 * Loads each public route of the built SPA in headless Chromium, waits for the
 * page to render, and writes the resulting HTML to dist/<route>.html so
 * crawlers (Googlebot, GPTBot, ClaudeBot, ...) get real content, titles, meta
 * and JSON-LD without running JavaScript. The SPA still boots on top (see
 * main.tsx). Also writes dist/spa.html (the untouched client shell used as the
 * fallback for private routes) and dist/sitemap.xml.
 *
 * Network during prerender: only GET requests to the public API (proxied via
 * Node so CORS never blocks), same-origin assets, and fonts/images are allowed.
 * Clerk, analytics and ad scripts are blocked, and every non-GET is aborted, so
 * prerendering never writes data or records a visit.
 *
 * Fail-soft: if Chromium cannot start, the build still succeeds as a plain SPA
 * (with a loud warning) unless PRERENDER_STRICT=1. Set PRERENDER=0 to skip.
 */
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_ROUTES, SITE_ORIGIN, fetchShopRoutes } from "./seo-routes.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");
const strict = process.env.PRERENDER_STRICT === "1";
// Same normalization as src/lib/apiBase.ts: a bare origin means "<origin>/api".
function normalizeApiBase(value) {
  const trimmed = (value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (!url.pathname || url.pathname === "/") url.pathname = "/api";
    return url.toString().replace(/\/+$/, "");
  } catch { return trimmed; }
}
const apiBase = normalizeApiBase(process.env.VITE_API_URL);
const log = (...args) => console.log("[prerender]", ...args);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".mp4": "video/mp4", ".webm": "video/webm", ".pdf": "application/pdf",
};

const BLOCKED_HOST = /(^|\.)(clerk\.[a-z.]+|clerk\.accounts\.dev|clerk\.com|clerkstage\.dev|umami\.is|cloud\.umami\.is|goatcounter\.com|googletagmanager\.com|google-analytics\.com|doubleclick\.net|googleadservices\.com|googlesyndication\.com|facebook\.net|connect\.facebook\.net|stripe\.com|js\.stripe\.com|m\.stripe\.network|mux\.com|litix\.io)$/i;

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[ch]);
}

async function writeSitemap(routes) {
  const today = new Date().toISOString().slice(0, 10);
  const body = routes.map((route) => [
    "  <url>",
    `    <loc>${escapeXml(SITE_ORIGIN + (route.path === "/" ? "/" : route.path))}</loc>`,
    `    <lastmod>${today}</lastmod>`,
    `    <changefreq>${route.changefreq}</changefreq>`,
    `    <priority>${route.priority}</priority>`,
    "  </url>",
  ].join("\n")).join("\n");
  await writeFile(path.join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
  log(`sitemap.xml: ${routes.length} URLs`);
}

const LLMS_SECTIONS = [
  ["Start here", (p) => ["/", "/start-here", "/about", "/media", "/contact"].includes(p)],
  ["Private sessions", (p) => p.startsWith("/sessions/") || p === "/regeneration-offer"],
  ["Divin8 reports", (p) => p.startsWith("/reports")],
  ["Webinars", (p) => p.startsWith("/webinars/")],
  ["Membership", (p) => p === "/membership-signup" || p.startsWith("/subscriptions/")],
  ["Shop", (p) => p.startsWith("/shop")],
  ["Optional", (p) => p === "/privacy" || p === "/terms"],
];

function offerSummary(jsonLd) {
  const offers = [];
  for (const item of jsonLd) {
    if (!item || !["Service", "Product", "Event"].includes(item["@type"])) continue;
    for (const offer of [].concat(item.offers || [])) {
      if (!offer?.price) continue;
      const unit = offer.priceSpecification?.unitText ? `/${offer.priceSpecification.unitText}` : "";
      offers.push(`${offer.name ? `${offer.name}: ` : ""}$${offer.price} ${offer.priceCurrency}${unit}`);
    }
  }
  return [...new Set(offers)];
}

async function writeLlmsTxt(routes, pageFacts) {
  const lines = [
    "# The Prime Mentor",
    "",
    "> The Prime Mentor (https://theprimementor.com) is the metaphysical mentoring practice of Brad Johnson, a metaphysical teacher and mentor. It offers private Q&A and mentoring sessions, offline sessions, written Divin8 astrology and numerology reports, memberships, and live and on-demand webinars, including teachings Brad channels from Adronis.",
    "",
    "- Who: Brad Johnson, founder of The Prime Mentor. He has spent more than 18 years helping people understand themselves more deeply through private sessions, Divin8 reports, and teachings.",
    "- How sessions happen: mostly by phone or Zoom, for clients worldwide. Offline sessions (no live appointment) are delivered as a private MP3 recording by email.",
    "- In person: Brad also sees local clients in person around Langley, Surrey and greater Vancouver, British Columbia, Canada.",
    "- Prices below are in Canadian dollars (CAD) and come from the site's checkout catalog at build time.",
    "- Profiles: YouTube https://www.youtube.com/@ThePrimeMentorYT | Facebook https://www.facebook.com/primementorfacebook | Instagram https://www.instagram.com/primementordotcom | Threads https://www.threads.net/@primementordotcom",
    "",
  ];
  for (const [heading, match] of LLMS_SECTIONS) {
    const sectionRoutes = routes.filter((route) => match(route.path));
    if (!sectionRoutes.length) continue;
    lines.push(`## ${heading}`, "");
    for (const route of sectionRoutes) {
      const facts = pageFacts.get(route.path);
      const title = (facts?.title || route.path).replace(/\s*\|\s*The Prime Mentor( Shop)?$/, "").replace(/^The Prime Mentor \| /, "Home: ");
      const offers = facts ? offerSummary(facts.jsonLd) : [];
      const detail = [facts?.description, offers.length ? `Prices: ${offers.join("; ")}.` : ""].filter(Boolean).join(" ");
      lines.push(`- [${title}](${SITE_ORIGIN}${route.path === "/" ? "/" : route.path})${detail ? `: ${detail}` : ""}`);
    }
    lines.push("");
  }
  lines.push("## Sitemap", "", `- [sitemap.xml](${SITE_ORIGIN}/sitemap.xml)`, "");
  await writeFile(path.join(dist, "llms.txt"), lines.join("\n"));
  log(`llms.txt: ${pageFacts.size} pages with facts`);
}

function startStaticServer(shellHtml) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const filePath = path.join(dist, decodeURIComponent(url.pathname));
    if (filePath.startsWith(dist) && url.pathname !== "/" && existsSync(filePath) && (await stat(filePath)).isFile()) {
      res.writeHead(200, { "content-type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
      res.end(await readFile(filePath));
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(shellHtml);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function launchBrowser() {
  const { chromium } = await import("playwright-core");
  if (process.env.PRERENDER_CHROMIUM_PATH) {
    return chromium.launch({ executablePath: process.env.PRERENDER_CHROMIUM_PATH, headless: true });
  }
  if (process.platform === "linux") {
    // Vercel / CI build image: bundled serverless Chromium.
    const sparticuz = (await import("@sparticuz/chromium")).default;
    return chromium.launch({ executablePath: await sparticuz.executablePath(), args: sparticuz.args, headless: true });
  }
  // Local dev machines: a Playwright-managed Chromium, else installed Chrome.
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return chromium.launch({ channel: "chrome", headless: true });
  }
}

function routeFile(routePath) {
  if (routePath === "/") return path.join(dist, "index.html");
  return path.join(dist, `${routePath.replace(/^\//, "")}.html`);
}

async function snapshot(context, origin, route) {
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
  await page.goto(origin + route.path, { waitUntil: "load", timeout: 45000 });
  await page.waitForFunction(() => {
    const h1 = document.querySelector("#root h1");
    const loading = [...document.querySelectorAll("#root .dashboard-panel")].some((el) => el.textContent?.trim() === "Loading...");
    return Boolean(h1 && h1.textContent?.trim()) && !loading && document.title !== "The Prime Mentor";
  }, null, { timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  // Scroll through once so in-view animations settle into their visible state.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(900);
  const html = await page.evaluate(() => {
    const doc = document.documentElement.cloneNode(true);
    const head = doc.querySelector("head");
    const root = doc.querySelector("#root");
    // Keep: the built module entry, modulepreload/stylesheet links and JSON-LD.
    doc.querySelectorAll("script").forEach((script) => {
      const keep = script.type === "application/ld+json" || (script.type === "module" && script.getAttribute("src")?.startsWith("/assets/"));
      if (!keep) script.remove();
    });
    doc.querySelectorAll("iframe, [data-clerk-component], #clerk-components, link[href*='clerk'], link[rel='preconnect'][href*='google']").forEach((node) => node.remove());
    doc.querySelectorAll("canvas").forEach((canvas) => canvas.removeAttribute("style"));
    root?.setAttribute("data-prerendered", "");
    head?.querySelector('meta[name="prerender"]')?.remove();
    const marker = document.createElement("meta");
    marker.setAttribute("name", "prerender");
    marker.setAttribute("content", new Date().toISOString());
    head?.appendChild(marker);
    // Body-level portals (modals, toasts) other than #root are client-only.
    doc.querySelectorAll("body > *:not(#root):not(script)").forEach((node) => node.remove());
    return "<!doctype html>\n" + doc.outerHTML;
  });
  const facts = await page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
    jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((node) => { try { return [JSON.parse(node.textContent || "")]; } catch { return []; } }),
  }));
  await page.close();
  return { html, consoleErrors, facts };
}

async function main() {
  if (process.env.PRERENDER === "0") { log("PRERENDER=0, skipping"); return; }
  const indexPath = path.join(dist, "index.html");
  const shellHtml = await readFile(indexPath, "utf8");
  if (shellHtml.includes("data-prerendered")) throw new Error("dist/index.html is already prerendered; run a fresh vite build first");
  await copyFile(indexPath, path.join(dist, "spa.html"));
  log("wrote spa.html (client-only shell)");

  let shopRoutes = [];
  try { shopRoutes = await fetchShopRoutes(apiBase); log(`shop routes from API: ${shopRoutes.length}`); }
  catch (error) { log(`WARN could not list shop products (${error.message}); /shop/:slug pages stay client-rendered`); }
  const routes = [...PUBLIC_ROUTES, ...shopRoutes];
  await writeSitemap(routes);

  let browser;
  try { browser = await launchBrowser(); }
  catch (error) {
    const message = `Chromium unavailable (${error.message.split("\n")[0]}); site ships as a plain SPA (no prerender).`;
    if (strict) throw new Error(message);
    console.warn(`[prerender] WARNING ${message}`);
    await writeLlmsTxt(routes, new Map());
    return;
  }

  const server = await startStaticServer(shellHtml);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const apiOrigin = apiBase ? new URL(apiBase).origin : null;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", userAgent: "ThePrimeMentorPrerender/1.0 (+https://theprimementor.com)" });
  await context.addInitScript(() => { window.__PRERENDER__ = true; });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (request.method() !== "GET" && request.method() !== "OPTIONS") return route.abort();
    if (BLOCKED_HOST.test(url.hostname)) return route.abort();
    if (apiOrigin && url.origin === apiOrigin) {
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": origin, "access-control-allow-headers": "*", "access-control-allow-methods": "GET" } });
      try {
        const upstream = await fetch(url, { headers: { accept: request.headers().accept || "application/json" }, signal: AbortSignal.timeout(20000) });
        const body = Buffer.from(await upstream.arrayBuffer());
        return route.fulfill({ status: upstream.status, body, headers: { "content-type": upstream.headers.get("content-type") || "application/json", "access-control-allow-origin": origin } });
      } catch { return route.abort(); }
    }
    if (["image", "font", "stylesheet", "media"].includes(request.resourceType())) return route.continue();
    return route.abort();
  });

  const failures = [];
  const pageFacts = new Map();
  for (const route of routes) {
    try {
      const { html, consoleErrors, facts } = await snapshot(context, origin, route);
      pageFacts.set(route.path, facts);
      const file = routeFile(route.path);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, html);
      log(`${route.path} -> ${path.relative(dist, file)} (${Math.round(html.length / 1024)} KB)${consoleErrors.length ? ` [${consoleErrors.length} page errors]` : ""}`);
    } catch (error) {
      failures.push(route.path);
      console.warn(`[prerender] WARN ${route.path} not prerendered: ${error.message.split("\n")[0]}`);
    }
  }
  await browser.close();
  server.close();
  // Never ship a prerendered index.html that failed: restore the shell for "/".
  if (failures.includes("/")) await copyFile(path.join(dist, "spa.html"), indexPath);
  await writeLlmsTxt(routes, pageFacts);
  log(`done: ${routes.length - failures.length}/${routes.length} routes prerendered`);
  if (failures.length && strict) throw new Error(`prerender failed for: ${failures.join(", ")}`);
}

main().catch((error) => { console.error("[prerender] FAILED", error); process.exit(1); });
