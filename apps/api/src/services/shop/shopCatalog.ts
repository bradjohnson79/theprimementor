import { and, asc, desc, eq, ne } from "drizzle-orm";
import { formatShopPriceCad } from "@wisdom/utils";
import {
  shopEntitlements,
  shopProductFiles,
  shopProductImages,
  shopProducts,
  type Database,
} from "@wisdom/db";
import { createHttpError } from "../booking/errors.js";
import { isShopInstructionFileKind } from "./shopDownloadService.js";
import { toYouTubeEmbedUrl } from "./shopYoutube.js";
import { listPublicTestimonialsForProduct, type ShopPublicTestimonial, type ShopTestimonialSection } from "./shopTestimonials.js";

export interface ShopPublicImage {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
}

export interface ShopPublicProduct {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  formatLabel: string;
  quickSummary: string | null;
  fullDescription: string | null;
  includedItems: string | null;
  videoUrl: string | null;
  videoEmbedUrl: string | null;
  videoHeading: string | null;
  videoIntro: string | null;
  wellnessNotice: string | null;
  priceCents: number;
  currency: string;
  priceLabel: string;
  featured: boolean;
  sortOrder: number;
  images: ShopPublicImage[];
  hasDownloadFiles: boolean;
  awaitingDeckAssets: boolean;
  awaitingBooklet: boolean;
  hasSecureManual: boolean;
  canPurchase: boolean;
  publicBooklet: { displayName: string; url: string } | null;
  purchased: boolean;
  collection: string | null;
  testimonials?: ShopPublicTestimonial[];
  testimonialSection?: ShopTestimonialSection | null;
  relatedProducts?: ShopRelatedProduct[];
}

export interface ShopRelatedProduct {
  id: string;
  slug: string;
  name: string;
  formatLabel: string;
  quickSummary: string | null;
  priceCents: number;
  currency: string;
  priceLabel: string;
  images: ShopPublicImage[];
}

export function publicShopImageUrl(
  slug: string,
  storageKey?: string | null,
  mimeType?: string | null,
) {
  const ext = storageKey?.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase()
    || (mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg");
  return `/shop/${slug}${ext}`;
}

export function publicShopBookletUrl(slug: string) {
  return `/shop/booklets/${slug}.pdf`;
}

function serializeImage(
  slug: string,
  row: { id: string; alt_text: string | null; is_primary: boolean; storage_key?: string | null; mime_type?: string | null },
): ShopPublicImage {
  return {
    id: row.id,
    url: publicShopImageUrl(slug, row.storage_key, row.mime_type),
    altText: row.alt_text,
    isPrimary: row.is_primary,
  };
}

export function isRelatedShopProduct(
  current: { id: string; collection: string | null },
  candidate: { id: string; collection: string | null; is_active: boolean; status: string },
) {
  const collection = current.collection?.trim();
  return Boolean(
    collection
    && candidate.collection === collection
    && candidate.id !== current.id
    && candidate.is_active
    && candidate.status === "active",
  );
}

export function isPurchasableShopProduct(row: {
  is_active: boolean;
  status: string;
  price_cents: number;
  stripe_price_id: string | null;
}) {
  return Boolean(
    row.is_active
    && row.status === "active"
    && row.price_cents > 0
    && row.stripe_price_id?.trim(),
  );
}

export function isFeaturedOnlyQuery(value: unknown): boolean {
  return String(value ?? "").trim().toLowerCase() === "true";
}

export async function listPublicShopProducts(
  db: Database,
  input: { userId?: string | null; featuredOnly?: boolean } = {},
): Promise<ShopPublicProduct[]> {
  const filters = [
    eq(shopProducts.is_active, true),
    eq(shopProducts.status, "active"),
    ...(input.featuredOnly ? [eq(shopProducts.featured, true)] : []),
  ];
  const products = await db
    .select()
    .from(shopProducts)
    .where(and(...filters))
    .orderBy(asc(shopProducts.sort_order), desc(shopProducts.created_at));

  return Promise.all(products.map((product) => serializePublicProduct(db, product, input.userId)));
}

export async function getPublicShopProductBySlug(
  db: Database,
  input: { slug: string; userId?: string | null },
): Promise<ShopPublicProduct> {
  const [product] = await db
    .select()
    .from(shopProducts)
    .where(eq(shopProducts.slug, input.slug.trim()))
    .limit(1);

  if (!product || !product.is_active || product.status !== "active") {
    throw createHttpError(404, "This Shop product is not available.");
  }

  return serializePublicProduct(db, product, input.userId, { includeTestimonials: true, includeRelated: true });
}

export async function getShopProductById(db: Database, productId: string) {
  const [product] = await db
    .select()
    .from(shopProducts)
    .where(eq(shopProducts.id, productId))
    .limit(1);
  return product ?? null;
}

export async function getShopProductBySlug(db: Database, slug: string) {
  const [product] = await db
    .select()
    .from(shopProducts)
    .where(eq(shopProducts.slug, slug))
    .limit(1);
  return product ?? null;
}

async function serializePublicProduct(
  db: Database,
  product: typeof shopProducts.$inferSelect,
  userId?: string | null,
  options: { includeTestimonials?: boolean; includeRelated?: boolean } = {},
): Promise<ShopPublicProduct> {
  const [images, files, entitlement, testimonialData] = await Promise.all([
    db.select().from(shopProductImages).where(eq(shopProductImages.product_id, product.id)).orderBy(asc(shopProductImages.sort_order)),
    db.select({
      id: shopProductFiles.id,
      kind: shopProductFiles.kind,
      display_name: shopProductFiles.display_name,
    }).from(shopProductFiles).where(and(
      eq(shopProductFiles.product_id, product.id),
      eq(shopProductFiles.is_available, true),
    )),
    userId
      ? db.select().from(shopEntitlements).where(and(
        eq(shopEntitlements.user_id, userId),
        eq(shopEntitlements.product_id, product.id),
      )).limit(1)
      : Promise.resolve([]),
    options.includeTestimonials
      ? listPublicTestimonialsForProduct(db, { productId: product.id, productSlug: product.slug })
      : Promise.resolve({ testimonials: [], section: null }),
  ]);

  const owned = Boolean(entitlement[0]?.purchased_at && !entitlement[0]?.revoked_at);
  const booklet = files.find((file) => file.kind === "booklet");
  const secureManual = files.find((file) => file.kind === "manual");

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    subtitle: product.subtitle,
    formatLabel: product.format_label,
    quickSummary: product.quick_summary,
    fullDescription: product.full_description,
    includedItems: product.included_items,
    videoUrl: product.video_url,
    videoEmbedUrl: toYouTubeEmbedUrl(product.video_url),
    videoHeading: product.video_heading,
    videoIntro: product.video_intro,
    wellnessNotice: product.wellness_notice,
    priceCents: product.price_cents,
    currency: product.currency,
    priceLabel: formatShopPriceCad(product.price_cents, product.currency),
    featured: product.featured,
    sortOrder: product.sort_order,
    images: images.map((row) => serializeImage(product.slug, row)),
    hasDownloadFiles: files.length > 0,
    awaitingDeckAssets: !files.some((file) => file.kind === "deck"),
    awaitingBooklet: !files.some((file) => isShopInstructionFileKind(file.kind)),
    hasSecureManual: Boolean(secureManual),
    canPurchase: isPurchasableShopProduct(product),
    publicBooklet: booklet
      ? {
        displayName: booklet.display_name,
        url: publicShopBookletUrl(product.slug),
      }
      : null,
    purchased: owned,
    collection: product.collection,
    ...(options.includeTestimonials ? {
      testimonials: testimonialData.testimonials,
      testimonialSection: testimonialData.section,
    } : {}),
    ...(options.includeRelated ? {
      relatedProducts: await listRelatedPublicProducts(db, product),
    } : {}),
  };
}

async function listRelatedPublicProducts(
  db: Database,
  product: typeof shopProducts.$inferSelect,
): Promise<ShopRelatedProduct[]> {
  const collection = product.collection?.trim();
  if (!collection) return [];

  const related = await db
    .select()
    .from(shopProducts)
    .where(and(
      eq(shopProducts.collection, collection),
      eq(shopProducts.is_active, true),
      eq(shopProducts.status, "active"),
      ne(shopProducts.id, product.id),
    ))
    .orderBy(asc(shopProducts.sort_order), desc(shopProducts.created_at));

  return Promise.all(related.map(async (item) => {
    const images = await db
      .select()
      .from(shopProductImages)
      .where(eq(shopProductImages.product_id, item.id))
      .orderBy(asc(shopProductImages.sort_order));
    return {
      id: item.id,
      slug: item.slug,
      name: item.name,
      formatLabel: item.format_label,
      quickSummary: item.quick_summary,
      priceCents: item.price_cents,
      currency: item.currency,
      priceLabel: formatShopPriceCad(item.price_cents, item.currency),
      images: images.map((row) => serializeImage(item.slug, row)),
    };
  }));
}
