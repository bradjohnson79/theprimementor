import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const entryDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(entryDir, "../../.env"), override: true });

process.env.PORT = "3011";
process.env.SHOP_TEST_FULFILLMENT = "1";
process.env.NODE_ENV = process.env.NODE_ENV === "production" ? "development" : (process.env.NODE_ENV || "test");
process.env.FRONTEND_URL = process.env.SHOP_TEST_FRONTEND_URL?.trim() || "http://127.0.0.1:3002";
process.env.SKIP_SCHEMA_VERIFY = process.env.SKIP_SCHEMA_VERIFY || "true";

for (const key of [
  "STRIPE_PRICE_REGENERATION_OFFER",
  "STRIPE_LIVE_PRICE_REGENERATION_OFFER",
]) {
  if (!process.env[key]?.trim()) {
    process.env[key] = "price_unused_shop_fulfillment_test";
  }
}

const { main } = await import("../server.js");

void main().catch((error) => {
  console.error("SHOP FULFILLMENT TEST API FAILED:", error);
  process.exit(1);
});
