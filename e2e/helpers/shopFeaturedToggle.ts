import path from "node:path";
import { config as loadEnv } from "dotenv";
import { eq, like } from "drizzle-orm";
import { createDb, shopProducts } from "../../packages/db/src/index.ts";

const repoRoot = process.cwd();
loadEnv({ path: path.join(repoRoot, "apps/api/.env") });

const EPHEMERAL_PREFIX = "shop-test-gallery-";

function assertLocalhostDatabase(databaseUrl: string) {
  const host = new URL(databaseUrl.replace(/^postgresql:/, "http:")).host;
  if (host.includes("ep-weathered-forest-ak5x524w")) {
    throw new Error("Refusing Shop featured toggles against the production Neon branch.");
  }
}

export function getShopLocalhostDb() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;
  assertLocalhostDatabase(databaseUrl);
  return createDb(databaseUrl);
}

export async function setShopProductFeatured(slug: string, featured: boolean) {
  const db = getShopLocalhostDb();
  if (!db) return false;
  const [row] = await db
    .update(shopProducts)
    .set({ featured, updated_at: new Date() })
    .where(eq(shopProducts.slug, slug))
    .returning({ id: shopProducts.id });
  return Boolean(row);
}

export async function insertEphemeralGalleryProduct(input: {
  slug: string;
  name: string;
  featured: boolean;
  isActive: boolean;
  status?: "draft" | "active" | "archived";
}) {
  const db = getShopLocalhostDb();
  if (!db) return null;
  const [row] = await db.insert(shopProducts).values({
    name: input.name,
    slug: `${EPHEMERAL_PREFIX}${input.slug}`,
    status: input.status ?? (input.isActive ? "active" : "draft"),
    is_active: input.isActive,
    featured: input.featured,
    sort_order: 980,
    price_cents: 199,
    currency: "CAD",
    format_label: "Digital Edition",
    quick_summary: "Ephemeral gallery persist product.",
  }).onConflictDoUpdate({
    target: shopProducts.slug,
    set: {
      featured: input.featured,
      is_active: input.isActive,
      status: input.status ?? (input.isActive ? "active" : "draft"),
      updated_at: new Date(),
    },
  }).returning();
  return row;
}

export async function cleanupEphemeralGalleryProducts() {
  const db = getShopLocalhostDb();
  if (!db) return;
  await db.delete(shopProducts).where(like(shopProducts.slug, `${EPHEMERAL_PREFIX}%`));
}
