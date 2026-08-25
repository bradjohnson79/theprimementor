import { and, asc, eq, or } from "drizzle-orm";
import {
  shopProductTestimonials,
  shopProducts,
  shopSettings,
  shopTestimonials,
  type Database,
} from "@wisdom/db";
import { createHttpError } from "../booking/errors.js";

export const SHOP_TESTIMONIAL_HEADING_KEY = "shop.testimonials.heading";
export const SHOP_TESTIMONIAL_SUBTITLE_KEY = "shop.testimonials.subtitle";
export const SHOP_TESTIMONIAL_DISCLAIMER_KEY = "shop.testimonials.disclaimer";

export const DEFAULT_TESTIMONIAL_HEADING = "What Customers Are Saying";
export const DEFAULT_TESTIMONIAL_SUBTITLE =
  "Experiences shared by people who have worked with the Healing Code Cards.";
export const DEFAULT_TESTIMONIAL_DISCLAIMER =
  "Customer testimonials reflect individual personal experiences and are provided for informational purposes only. Individual experiences vary, and testimonials do not constitute medical claims or guarantees of results. Healing Code Cards are intended as a spiritual and alternative wellness practice and are not a substitute for professional healthcare.";

export interface ShopPublicTestimonial {
  id: string;
  customerName: string;
  location: string | null;
  title: string | null;
  testimonialText: string;
  contextLabel: string | null;
  sortOrder: number;
}

export interface ShopTestimonialSection {
  heading: string;
  subtitle: string | null;
  disclaimer: string;
}

export interface ShopAdminTestimonialInput {
  customerName?: string;
  location?: string | null;
  title?: string | null;
  testimonialText?: string;
  sourceLabel?: string | null;
  contextLabel?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  productIds?: string[];
  productSlugs?: string[];
}

export function serializePublicTestimonial(row: typeof shopTestimonials.$inferSelect): ShopPublicTestimonial {
  return {
    id: row.id,
    customerName: row.customer_name,
    location: row.location,
    title: row.title,
    testimonialText: row.testimonial_text,
    contextLabel: row.context_label,
    sortOrder: row.sort_order,
  };
}

export function filterActiveTestimonials<T extends { is_active: boolean }>(rows: T[]) {
  return rows.filter((row) => row.is_active);
}

export function sortTestimonials<T extends { sort_order: number; created_at?: Date }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    const aCreated = a.created_at?.getTime() ?? 0;
    const bCreated = b.created_at?.getTime() ?? 0;
    return aCreated - bCreated;
  });
}

export function normalizeProductSlugs(input: { productIds?: string[]; productSlugs?: string[] }, known: Array<{ id: string; slug: string }>) {
  const slugs = new Set<string>();
  for (const slug of input.productSlugs ?? []) {
    const trimmed = slug.trim();
    if (trimmed) slugs.add(trimmed);
  }
  for (const productId of input.productIds ?? []) {
    const match = known.find((product) => product.id === productId);
    if (match) slugs.add(match.slug);
  }
  return [...slugs];
}

export async function getShopTestimonialSettings(db: Database): Promise<ShopTestimonialSection> {
  const rows = await db.select().from(shopSettings);
  const heading = rows.find((row) => row.key === SHOP_TESTIMONIAL_HEADING_KEY)?.value?.trim();
  const subtitle = rows.find((row) => row.key === SHOP_TESTIMONIAL_SUBTITLE_KEY)?.value?.trim();
  const disclaimer = rows.find((row) => row.key === SHOP_TESTIMONIAL_DISCLAIMER_KEY)?.value?.trim();
  return {
    heading: heading || DEFAULT_TESTIMONIAL_HEADING,
    subtitle: subtitle || DEFAULT_TESTIMONIAL_SUBTITLE,
    disclaimer: disclaimer || DEFAULT_TESTIMONIAL_DISCLAIMER,
  };
}

export async function updateShopTestimonialSettings(
  db: Database,
  input: { heading?: string; subtitle?: string; disclaimer?: string },
): Promise<ShopTestimonialSection> {
  if (input.heading !== undefined) {
    await upsertSetting(db, SHOP_TESTIMONIAL_HEADING_KEY, input.heading.trim() || DEFAULT_TESTIMONIAL_HEADING);
  }
  if (input.subtitle !== undefined) {
    await upsertSetting(db, SHOP_TESTIMONIAL_SUBTITLE_KEY, input.subtitle.trim() || DEFAULT_TESTIMONIAL_SUBTITLE);
  }
  if (input.disclaimer !== undefined) {
    await upsertSetting(db, SHOP_TESTIMONIAL_DISCLAIMER_KEY, input.disclaimer.trim() || DEFAULT_TESTIMONIAL_DISCLAIMER);
  }
  return getShopTestimonialSettings(db);
}

async function upsertSetting(db: Database, key: string, value: string) {
  const [existing] = await db.select().from(shopSettings).where(eq(shopSettings.key, key)).limit(1);
  if (existing) {
    await db.update(shopSettings).set({ value, updated_at: new Date() }).where(eq(shopSettings.key, key));
    return;
  }
  await db.insert(shopSettings).values({ key, value });
}

export async function listPublicTestimonialsForProduct(
  db: Database,
  input: { productId: string; productSlug: string },
): Promise<{ testimonials: ShopPublicTestimonial[]; section: ShopTestimonialSection | null }> {
  const associations = await db
    .select({
      testimonial: shopTestimonials,
    })
    .from(shopProductTestimonials)
    .innerJoin(shopTestimonials, eq(shopProductTestimonials.testimonial_id, shopTestimonials.id))
    .where(and(
      eq(shopTestimonials.is_active, true),
      or(
        eq(shopProductTestimonials.product_id, input.productId),
        eq(shopProductTestimonials.product_slug, input.productSlug),
      ),
    ));

  const unique = new Map<string, typeof shopTestimonials.$inferSelect>();
  for (const row of associations) {
    unique.set(row.testimonial.id, row.testimonial);
  }
  const testimonials = sortTestimonials([...unique.values()]).map(serializePublicTestimonial);
  if (testimonials.length === 0) {
    return { testimonials: [], section: null };
  }
  return {
    testimonials,
    section: await getShopTestimonialSettings(db),
  };
}

function serializeAdminTestimonial(
  row: typeof shopTestimonials.$inferSelect,
  associations: Array<{ id: string; product_id: string | null; product_slug: string }>,
) {
  return {
    id: row.id,
    customerName: row.customer_name,
    location: row.location,
    title: row.title,
    testimonialText: row.testimonial_text,
    sourceLabel: row.source_label,
    contextLabel: row.context_label,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    productIds: associations.map((item) => item.product_id).filter((id): id is string => Boolean(id)),
    productSlugs: associations.map((item) => item.product_slug),
    associations: associations.map((item) => ({
      id: item.id,
      productId: item.product_id,
      productSlug: item.product_slug,
    })),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at?.toISOString() ?? null,
  };
}

async function loadAssociations(db: Database, testimonialId: string) {
  return db
    .select({
      id: shopProductTestimonials.id,
      product_id: shopProductTestimonials.product_id,
      product_slug: shopProductTestimonials.product_slug,
    })
    .from(shopProductTestimonials)
    .where(eq(shopProductTestimonials.testimonial_id, testimonialId));
}

export async function listAdminTestimonials(db: Database) {
  const rows = await db.select().from(shopTestimonials).orderBy(asc(shopTestimonials.sort_order), asc(shopTestimonials.created_at));
  return Promise.all(rows.map(async (row) => serializeAdminTestimonial(row, await loadAssociations(db, row.id))));
}

export async function getAdminTestimonial(db: Database, testimonialId: string) {
  const [row] = await db.select().from(shopTestimonials).where(eq(shopTestimonials.id, testimonialId)).limit(1);
  if (!row) {
    throw createHttpError(404, "Testimonial not found.");
  }
  return serializeAdminTestimonial(row, await loadAssociations(db, row.id));
}

export async function createAdminTestimonial(db: Database, input: ShopAdminTestimonialInput) {
  const customerName = input.customerName?.trim();
  const testimonialText = input.testimonialText?.trim();
  if (!customerName) {
    throw createHttpError(400, "Customer name is required.");
  }
  if (!testimonialText) {
    throw createHttpError(400, "Testimonial text is required.");
  }
  const [created] = await db.insert(shopTestimonials).values({
    customer_name: customerName,
    location: input.location?.trim() || null,
    title: input.title?.trim() || null,
    testimonial_text: testimonialText,
    source_label: input.sourceLabel?.trim() || null,
    context_label: input.contextLabel?.trim() || null,
    is_active: input.isActive ?? true,
    sort_order: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
  }).returning();
  if (!created) {
    throw createHttpError(500, "Testimonial could not be created.");
  }
  await replaceAssociations(db, created.id, input);
  return getAdminTestimonial(db, created.id);
}

export async function updateAdminTestimonial(db: Database, testimonialId: string, input: ShopAdminTestimonialInput) {
  const current = await getAdminTestimonial(db, testimonialId);
  const values: Partial<typeof shopTestimonials.$inferInsert> = {
    updated_at: new Date(),
  };
  if (input.customerName !== undefined) {
    const customerName = input.customerName.trim();
    if (!customerName) throw createHttpError(400, "Customer name is required.");
    values.customer_name = customerName;
  }
  if (input.testimonialText !== undefined) {
    const testimonialText = input.testimonialText.trim();
    if (!testimonialText) throw createHttpError(400, "Testimonial text is required.");
    values.testimonial_text = testimonialText;
  }
  if (input.location !== undefined) values.location = input.location?.trim() || null;
  if (input.title !== undefined) values.title = input.title?.trim() || null;
  if (input.sourceLabel !== undefined) values.source_label = input.sourceLabel?.trim() || null;
  if (input.contextLabel !== undefined) values.context_label = input.contextLabel?.trim() || null;
  if (input.isActive !== undefined) values.is_active = Boolean(input.isActive);
  if (input.sortOrder !== undefined) values.sort_order = Number(input.sortOrder) || 0;

  await db.update(shopTestimonials).set(values).where(eq(shopTestimonials.id, current.id));
  if (input.productIds !== undefined || input.productSlugs !== undefined) {
    await replaceAssociations(db, current.id, input);
  }
  return getAdminTestimonial(db, current.id);
}

export async function removeTestimonialAssociation(db: Database, testimonialId: string, associationId: string) {
  await getAdminTestimonial(db, testimonialId);
  await db.delete(shopProductTestimonials).where(and(
    eq(shopProductTestimonials.id, associationId),
    eq(shopProductTestimonials.testimonial_id, testimonialId),
  ));
  return getAdminTestimonial(db, testimonialId);
}

async function replaceAssociations(db: Database, testimonialId: string, input: ShopAdminTestimonialInput) {
  const products = await db.select({ id: shopProducts.id, slug: shopProducts.slug }).from(shopProducts);
  const slugs = normalizeProductSlugs(input, products);
  await db.delete(shopProductTestimonials).where(eq(shopProductTestimonials.testimonial_id, testimonialId));
  if (slugs.length === 0) return;
  await db.insert(shopProductTestimonials).values(slugs.map((slug) => ({
    testimonial_id: testimonialId,
    product_slug: slug,
    product_id: products.find((product) => product.slug === slug)?.id ?? null,
  })));
}
