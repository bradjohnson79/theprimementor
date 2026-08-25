import { asc, desc, eq } from "drizzle-orm";
import { formatShopPriceCad } from "@wisdom/utils";
import {
  shopProductFiles,
  shopProductImages,
  shopProducts,
  type Database,
} from "@wisdom/db";
import { createHttpError } from "../booking/errors.js";
import { deleteShopFile, saveShopFile } from "./shopFileStorage.js";
import {
  createReplacementShopStripePrice,
  createShopStripeProductAndPrice,
  getShopStripe,
  retrieveAndVerifyShopPrice,
  retrieveShopPriceProductId,
} from "./shopStripe.js";
import { toYouTubeEmbedUrl } from "./shopYoutube.js";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

export interface ShopAdminProductInput {
  name?: string;
  slug?: string;
  status?: "draft" | "active" | "archived";
  isActive?: boolean;
  featured?: boolean;
  sortOrder?: number;
  priceCents?: number;
  currency?: string;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
  formatLabel?: string;
  subtitle?: string | null;
  quickSummary?: string | null;
  fullDescription?: string | null;
  includedItems?: string | null;
  videoUrl?: string | null;
  videoHeading?: string | null;
  videoIntro?: string | null;
  wellnessNotice?: string | null;
  collection?: string | null;
  fulfillmentType?: string | null;
  fulfillmentDownloadUrl?: string | null;
  fulfillmentDownloadLabel?: string | null;
  fulfillmentEmailEnabled?: boolean;
  fulfillmentInstructions?: string | null;
  associateStripe?: boolean;
  createStripe?: boolean;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function requireName(name: string | undefined) {
  const value = name?.trim();
  if (!value) throw createHttpError(400, "Product name is required.");
  return value;
}

function requireSlug(slug: string | undefined, name: string) {
  const value = (slug?.trim() || slugify(name));
  if (!SLUG_PATTERN.test(value)) {
    throw createHttpError(400, "Slug must be lowercase letters, numbers, and hyphens.");
  }
  return value;
}

function requirePriceCents(priceCents: number | undefined) {
  if (!Number.isInteger(priceCents) || (priceCents ?? 0) <= 0) {
    throw createHttpError(400, "Price must be a positive amount in cents.");
  }
  return priceCents as number;
}

function normalizeFulfillmentType(value?: string | null) {
  const normalized = value?.trim() || "";
  if (!normalized) return null;
  if (normalized === "external_download" || normalized === "none") return normalized;
  throw createHttpError(400, "Fulfillment type must be external_download or none.");
}

function normalizeCurrency(currency?: string) {
  const value = (currency ?? "CAD").trim().toUpperCase();
  if (value !== "CAD") {
    throw createHttpError(400, "Shop products must use CAD.");
  }
  return value;
}

async function serializeAdminProduct(db: Database, product: typeof shopProducts.$inferSelect) {
  const [images, files] = await Promise.all([
    db.select().from(shopProductImages).where(eq(shopProductImages.product_id, product.id)).orderBy(asc(shopProductImages.sort_order)),
    db.select().from(shopProductFiles).where(eq(shopProductFiles.product_id, product.id)).orderBy(asc(shopProductFiles.created_at)),
  ]);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    status: product.status,
    isActive: product.is_active,
    featured: product.featured,
    sortOrder: product.sort_order,
    priceCents: product.price_cents,
    currency: product.currency,
    priceLabel: formatShopPriceCad(product.price_cents, product.currency),
    stripeProductId: product.stripe_product_id,
    stripePriceId: product.stripe_price_id,
    formatLabel: product.format_label,
    subtitle: product.subtitle,
    quickSummary: product.quick_summary,
    fullDescription: product.full_description,
    includedItems: product.included_items,
    videoUrl: product.video_url,
    videoEmbedUrl: toYouTubeEmbedUrl(product.video_url),
    videoHeading: product.video_heading,
    videoIntro: product.video_intro,
    wellnessNotice: product.wellness_notice,
    collection: product.collection,
    fulfillmentType: product.fulfillment_type,
    fulfillmentDownloadUrl: product.fulfillment_download_url,
    fulfillmentDownloadLabel: product.fulfillment_download_label,
    fulfillmentEmailEnabled: product.fulfillment_email_enabled,
    fulfillmentInstructions: product.fulfillment_instructions,
    awaitingAssets: files.length === 0,
    awaitingDeckAssets: !files.some((file) => file.is_available && file.kind === "deck"),
    awaitingBooklet: !files.some((file) => file.is_available && (file.kind === "booklet" || file.kind === "manual")),
    images: images.map((image) => ({
      id: image.id,
      url: `/api/shop/media/${image.id}`,
      altText: image.alt_text,
      isPrimary: image.is_primary,
      mimeType: image.mime_type,
      sizeBytes: image.size_bytes,
    })),
    files: files.map((file) => ({
      id: file.id,
      displayName: file.display_name,
      mimeType: file.mime_type,
      sizeBytes: file.size_bytes,
      kind: file.kind,
      isAvailable: file.is_available,
    })),
    createdAt: product.created_at.toISOString(),
    updatedAt: product.updated_at?.toISOString() ?? null,
  };
}

export async function listAdminShopProducts(db: Database) {
  const products = await db
    .select()
    .from(shopProducts)
    .orderBy(asc(shopProducts.sort_order), desc(shopProducts.created_at));
  return Promise.all(products.map((product) => serializeAdminProduct(db, product)));
}

export async function getAdminShopProduct(db: Database, productId: string) {
  const [product] = await db.select().from(shopProducts).where(eq(shopProducts.id, productId)).limit(1);
  if (!product) throw createHttpError(404, "Shop product was not found.");
  return serializeAdminProduct(db, product);
}

async function resolveStripeAssociation(
  input: ShopAdminProductInput,
  current?: typeof shopProducts.$inferSelect,
) {
  const priceCents = requirePriceCents(input.priceCents ?? current?.price_cents);
  const currency = normalizeCurrency(input.currency ?? current?.currency);
  const name = requireName(input.name ?? current?.name);
  let stripePriceId = input.stripePriceId?.trim() || current?.stripe_price_id || null;
  let stripeProductId = input.stripeProductId?.trim() || current?.stripe_product_id || null;
  const priceChanged = Boolean(current && current.price_cents !== priceCents);
  const incomingPriceId = input.stripePriceId === undefined ? undefined : (input.stripePriceId?.trim() || null);
  const incomingProductId = input.stripeProductId === undefined ? undefined : (input.stripeProductId?.trim() || null);
  const idsChanged = Boolean(
    (incomingPriceId !== undefined && incomingPriceId !== (current?.stripe_price_id || null))
    || (incomingProductId !== undefined && incomingProductId !== (current?.stripe_product_id || null)),
  );

  if (input.createStripe && !stripePriceId) {
    const created = await createShopStripeProductAndPrice(getShopStripe(), {
      name,
      description: input.quickSummary ?? current?.quick_summary,
      amountCents: priceCents,
      currency,
    });
    stripePriceId = created.priceId;
    stripeProductId = created.productId;
  } else if ((input.associateStripe || idsChanged) && stripePriceId) {
    const verified = await retrieveAndVerifyShopPrice(getShopStripe(), {
      priceId: stripePriceId,
      expectedCents: priceCents,
      expectedCurrency: currency,
    });
    stripePriceId = verified.priceId;
    stripeProductId = verified.productId ?? stripeProductId;
  } else if (input.associateStripe && !stripePriceId) {
    throw createHttpError(400, "A Stripe Price ID is required to associate an existing catalog Price.");
  } else if (priceChanged && current?.stripe_price_id) {
    if (!stripeProductId) {
      stripeProductId = await retrieveShopPriceProductId(getShopStripe(), current.stripe_price_id);
    }
    if (!stripeProductId) {
      throw createHttpError(
        409,
        "This product has no Stripe Product ID. Associate an existing Price before changing the catalog price.",
      );
    }
    const created = await createReplacementShopStripePrice(getShopStripe(), {
      productId: stripeProductId,
      amountCents: priceCents,
      currency,
    });
    stripePriceId = created.priceId;
    stripeProductId = created.productId ?? stripeProductId;
  }

  return { priceCents, currency, stripePriceId, stripeProductId };
}

export async function createAdminShopProduct(db: Database, input: ShopAdminProductInput) {
  const name = requireName(input.name);
  const slug = requireSlug(input.slug, name);
  const existing = await db.select({ id: shopProducts.id }).from(shopProducts).where(eq(shopProducts.slug, slug)).limit(1);
  if (existing[0]) {
    throw createHttpError(409, "A Shop product with this slug already exists.");
  }

  const stripe = await resolveStripeAssociation(input);
  const [created] = await db.insert(shopProducts).values({
    name,
    slug,
    status: input.status ?? (input.isActive ? "active" : "draft"),
    is_active: input.isActive ?? input.status === "active",
    featured: input.featured ?? false,
    sort_order: input.sortOrder ?? 0,
    price_cents: stripe.priceCents,
    currency: stripe.currency,
    stripe_product_id: stripe.stripeProductId,
    stripe_price_id: stripe.stripePriceId,
    format_label: input.formatLabel?.trim() || "Digital Edition",
    subtitle: input.subtitle?.trim() || null,
    quick_summary: input.quickSummary?.trim() || null,
    full_description: input.fullDescription?.trim() || null,
    included_items: input.includedItems?.trim() || null,
    video_url: input.videoUrl?.trim() || null,
    video_heading: input.videoHeading?.trim() || null,
    video_intro: input.videoIntro?.trim() || null,
    wellness_notice: input.wellnessNotice?.trim() || null,
    collection: input.collection?.trim() || null,
    fulfillment_type: normalizeFulfillmentType(input.fulfillmentType),
    fulfillment_download_url: input.fulfillmentDownloadUrl?.trim() || null,
    fulfillment_download_label: input.fulfillmentDownloadLabel?.trim() || null,
    fulfillment_email_enabled: input.fulfillmentEmailEnabled ?? true,
    fulfillment_instructions: input.fulfillmentInstructions?.trim() || null,
  }).returning();

  if (!created) throw createHttpError(500, "Shop product could not be created.");
  return serializeAdminProduct(db, created);
}

export async function updateAdminShopProduct(db: Database, productId: string, input: ShopAdminProductInput) {
  const [current] = await db.select().from(shopProducts).where(eq(shopProducts.id, productId)).limit(1);
  if (!current) throw createHttpError(404, "Shop product was not found.");

  const name = requireName(input.name ?? current.name);
  const slug = requireSlug(input.slug ?? current.slug, name);
  if (slug !== current.slug) {
    const [conflict] = await db.select({ id: shopProducts.id }).from(shopProducts).where(eq(shopProducts.slug, slug)).limit(1);
    if (conflict) throw createHttpError(409, "A Shop product with this slug already exists.");
  }

  const stripe = await resolveStripeAssociation(input, current);
  const [updated] = await db.update(shopProducts).set({
    name,
    slug,
    status: input.status ?? current.status,
    is_active: input.isActive ?? current.is_active,
    featured: input.featured ?? current.featured,
    sort_order: input.sortOrder ?? current.sort_order,
    price_cents: stripe.priceCents,
    currency: stripe.currency,
    stripe_product_id: stripe.stripeProductId,
    stripe_price_id: stripe.stripePriceId,
    format_label: input.formatLabel?.trim() || current.format_label,
    subtitle: input.subtitle === undefined ? current.subtitle : input.subtitle?.trim() || null,
    quick_summary: input.quickSummary === undefined ? current.quick_summary : input.quickSummary?.trim() || null,
    full_description: input.fullDescription === undefined ? current.full_description : input.fullDescription?.trim() || null,
    included_items: input.includedItems === undefined ? current.included_items : input.includedItems?.trim() || null,
    video_url: input.videoUrl === undefined ? current.video_url : input.videoUrl?.trim() || null,
    video_heading: input.videoHeading === undefined ? current.video_heading : input.videoHeading?.trim() || null,
    video_intro: input.videoIntro === undefined ? current.video_intro : input.videoIntro?.trim() || null,
    wellness_notice: input.wellnessNotice === undefined ? current.wellness_notice : input.wellnessNotice?.trim() || null,
    collection: input.collection === undefined ? current.collection : input.collection?.trim() || null,
    fulfillment_type: input.fulfillmentType === undefined ? current.fulfillment_type : normalizeFulfillmentType(input.fulfillmentType),
    fulfillment_download_url: input.fulfillmentDownloadUrl === undefined ? current.fulfillment_download_url : input.fulfillmentDownloadUrl?.trim() || null,
    fulfillment_download_label: input.fulfillmentDownloadLabel === undefined ? current.fulfillment_download_label : input.fulfillmentDownloadLabel?.trim() || null,
    fulfillment_email_enabled: input.fulfillmentEmailEnabled ?? current.fulfillment_email_enabled,
    fulfillment_instructions: input.fulfillmentInstructions === undefined ? current.fulfillment_instructions : input.fulfillmentInstructions?.trim() || null,
    updated_at: new Date(),
  }).where(eq(shopProducts.id, productId)).returning();

  if (!updated) throw createHttpError(500, "Shop product could not be updated.");
  return serializeAdminProduct(db, updated);
}

export async function addShopProductImage(
  db: Database,
  input: { productId: string; buffer: Buffer; mimeType: string; altText?: string | null },
) {
  if (!IMAGE_TYPES.has(input.mimeType.toLowerCase())) {
    throw createHttpError(400, "Please upload a JPEG, PNG, or WebP image.");
  }
  if (input.buffer.byteLength > MAX_IMAGE_BYTES) {
    throw createHttpError(400, "Images must be 5MB or smaller.");
  }
  await getAdminShopProduct(db, input.productId);
  const saved = await saveShopFile("images", input.buffer, input.mimeType);
  const existing = await db.select().from(shopProductImages).where(eq(shopProductImages.product_id, input.productId));
  const [created] = await db.insert(shopProductImages).values({
    product_id: input.productId,
    storage_key: saved.storageKey,
    alt_text: input.altText?.trim() || null,
    mime_type: input.mimeType,
    size_bytes: saved.sizeBytes,
    sort_order: existing.length,
    is_primary: existing.length === 0,
  }).returning();
  return created;
}

export async function deleteShopProductImage(db: Database, imageId: string) {
  const [image] = await db.select().from(shopProductImages).where(eq(shopProductImages.id, imageId)).limit(1);
  if (!image) throw createHttpError(404, "Image was not found.");
  await db.delete(shopProductImages).where(eq(shopProductImages.id, imageId));
  await deleteShopFile("images", image.storage_key);
}

export async function addShopProductFile(
  db: Database,
  input: {
    productId: string;
    buffer: Buffer;
    mimeType: string;
    displayName: string;
    kind?: "deck" | "booklet" | "manual" | "other";
    originalName?: string;
  },
) {
  if (input.buffer.byteLength > MAX_FILE_BYTES) {
    throw createHttpError(400, "Product files must be 50MB or smaller.");
  }
  await getAdminShopProduct(db, input.productId);
  const saved = await saveShopFile("files", input.buffer, input.mimeType, input.originalName);
  const [created] = await db.insert(shopProductFiles).values({
    product_id: input.productId,
    storage_key: saved.storageKey,
    display_name: input.displayName.trim() || input.originalName || "Download",
    mime_type: input.mimeType || null,
    size_bytes: saved.sizeBytes,
    kind: input.kind ?? "other",
    is_available: true,
  }).returning();
  return created;
}

export async function deleteShopProductFile(db: Database, fileId: string) {
  const [file] = await db.select().from(shopProductFiles).where(eq(shopProductFiles.id, fileId)).limit(1);
  if (!file) throw createHttpError(404, "File was not found.");
  await db.delete(shopProductFiles).where(eq(shopProductFiles.id, fileId));
  await deleteShopFile("files", file.storage_key);
}

export async function getShopMediaById(db: Database, imageId: string) {
  const [image] = await db.select().from(shopProductImages).where(eq(shopProductImages.id, imageId)).limit(1);
  if (!image) return null;
  const { readShopFile } = await import("./shopFileStorage.js");
  const buffer = await readShopFile("images", image.storage_key);
  if (!buffer) return null;
  return { buffer, mimeType: image.mime_type || "application/octet-stream" };
}
