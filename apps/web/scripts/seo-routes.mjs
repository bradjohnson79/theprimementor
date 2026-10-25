/**
 * Public, indexable routes: prerendered to static HTML and listed in sitemap.xml.
 * Keep in sync with App.tsx public routes. Private/client-only routes are NOT
 * listed here; they are served by the spa.html fallback and carry an
 * X-Robots-Tag: noindex header from vercel.json.
 *
 * Not listed on purpose:
 * - redirect-only routes (/subscriptions, /sessions/regeneration, /sessions/focus,
 *   /mentoring-circle, /events/mentoring-circle, /webinars/adronis-star-family-communion)
 * - /webinars/adronis-disclosure-to-contact (past live event; checkout sends
 *   visitors to sign-in)
 */
export const SITE_ORIGIN = "https://theprimementor.com";

export const PUBLIC_ROUTES = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/start-here", priority: "0.9", changefreq: "monthly" },
  { path: "/about", priority: "0.9", changefreq: "monthly" },
  { path: "/media", priority: "0.6", changefreq: "monthly" },
  { path: "/contact", priority: "0.5", changefreq: "yearly" },
  { path: "/reports", priority: "0.9", changefreq: "monthly" },
  { path: "/reports/introductory", priority: "0.8", changefreq: "monthly" },
  { path: "/reports/compatibility", priority: "0.8", changefreq: "monthly" },
  { path: "/sessions/qa", priority: "0.9", changefreq: "monthly" },
  { path: "/sessions/mentoring", priority: "0.9", changefreq: "monthly" },
  { path: "/sessions/manifestation", priority: "0.8", changefreq: "monthly" },
  { path: "/sessions/prime-body-healing", priority: "0.8", changefreq: "monthly" },
  { path: "/sessions/email-session", priority: "0.8", changefreq: "monthly" },
  { path: "/sessions/past-life-akashic-reading", priority: "0.8", changefreq: "monthly" },
  { path: "/regeneration-offer", priority: "0.7", changefreq: "monthly" },
  { path: "/membership-signup", priority: "0.7", changefreq: "monthly" },
  { path: "/subscriptions/seeker", priority: "0.6", changefreq: "monthly" },
  { path: "/subscriptions/initiate", priority: "0.6", changefreq: "monthly" },
  { path: "/webinars/prime-alchemy-teachings", priority: "0.8", changefreq: "weekly" },
  { path: "/webinars/adronis-disclosure-to-contact/on-demand", priority: "0.7", changefreq: "monthly" },
  { path: "/webinars/adronis-star-family-communion/on-demand", priority: "0.7", changefreq: "monthly" },
  { path: "/shop", priority: "0.7", changefreq: "weekly" },
  { path: "/privacy", priority: "0.2", changefreq: "yearly" },
  { path: "/terms", priority: "0.2", changefreq: "yearly" },
];

/** /shop/:slug pages are discovered from the public API at build time. */
export async function fetchShopRoutes(apiBase) {
  if (!apiBase) return [];
  const response = await fetch(`${apiBase.replace(/\/$/, "")}/shop/products`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`shop products HTTP ${response.status}`);
  const products = await response.json();
  return (Array.isArray(products) ? products : [])
    .filter((product) => typeof product?.slug === "string" && /^[a-z0-9-]+$/.test(product.slug))
    .map((product) => ({ path: `/shop/${product.slug}`, priority: "0.6", changefreq: "monthly" }));
}
