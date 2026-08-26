import type { FastifyInstance, FastifyRequest } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireClerkId, requireDatabase, requireDbUser } from "../routeAssertions.js";
import { createHttpError } from "../services/booking/errors.js";
import { createCheckoutSession } from "../services/paymentService.js";
import {
  addShopProductFile,
  addShopProductImage,
  createAdminShopProduct,
  deleteShopProductFile,
  deleteShopProductImage,
  getAdminShopProduct,
  getShopMediaById,
  listAdminShopProducts,
  updateAdminShopProduct,
  type ShopAdminProductInput,
} from "../services/shop/shopAdminService.js";
import { getPublicShopProductBySlug, isFeaturedOnlyQuery, listPublicShopProducts } from "../services/shop/shopCatalog.js";
import {
  buildShopContentDisposition,
  issueShopDownloadToken,
  loadAuthorizedShopDownload,
  loadPublicShopBooklet,
} from "../services/shop/shopDownloadService.js";
import { listMemberShopPurchases, prepareShopEntitlementForCheckout } from "../services/shop/shopEntitlementService.js";
import { getShopOrderSuccessView, resendShopDigitalFulfillmentEmail } from "../services/shop/shopFulfillmentService.js";
import {
  createAdminTestimonial,
  getAdminTestimonial,
  getShopTestimonialSettings,
  listAdminTestimonials,
  removeTestimonialAssociation,
  updateAdminTestimonial,
  updateShopTestimonialSettings,
  type ShopAdminTestimonialInput,
} from "../services/shop/shopTestimonials.js";

function readOptionalAuthUserId(request: { dbUser?: { id: string } | null }) {
  return request.dbUser?.id ?? null;
}

async function readMultipartFile(request: FastifyRequest, maxBytes: number) {
  const data = await request.file({ limits: { fileSize: maxBytes } });
  if (!data) {
    throw createHttpError(400, "No file uploaded.");
  }
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of data.file) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      throw createHttpError(413, "Uploaded file is too large.");
    }
    chunks.push(chunk);
  }
  return {
    buffer: Buffer.concat(chunks),
    mimeType: data.mimetype,
    filename: data.filename,
  };
}

export async function shopRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { featured?: string } }>("/shop/products", async (request) => {
    const db = requireDatabase(app.db);
    const featuredOnly = isFeaturedOnlyQuery(request.query.featured);
    return ok(await listPublicShopProducts(db, {
      userId: readOptionalAuthUserId(request),
      featuredOnly,
    }));
  });

  app.get<{ Params: { slug: string } }>("/shop/products/:slug/booklet", async (request, reply) => {
    const db = requireDatabase(app.db);
    const file = await loadPublicShopBooklet(db, request.params.slug);
    reply.header("Content-Type", file.mimeType);
    reply.header("Content-Disposition", buildShopContentDisposition(file.displayName, ".pdf"));
    reply.header("Cache-Control", "private, max-age=300");
    return reply.send(file.buffer);
  });

  app.get<{ Params: { slug: string } }>("/shop/products/:slug", async (request) => {
    const db = requireDatabase(app.db);
    return ok(await getPublicShopProductBySlug(db, {
      slug: request.params.slug,
      userId: readOptionalAuthUserId(request),
    }));
  });

  app.get<{ Params: { imageId: string } }>("/shop/media/:imageId", async (request, reply) => {
    const db = requireDatabase(app.db);
    const media = await getShopMediaById(db, request.params.imageId);
    if (!media) {
      return sendApiError(reply, 404, "Image not found");
    }
    reply.header("Content-Type", media.mimeType);
    reply.header("Cache-Control", "public, max-age=300");
    return reply.send(media.buffer);
  });

  app.get<{ Querystring: { session_id?: string; sessionId?: string; checkoutSessionId?: string } }>("/shop/order/success", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    const clerkId = requireClerkId(request);
    return ok(await getShopOrderSuccessView(db, {
      sessionId: request.query.session_id || request.query.sessionId || request.query.checkoutSessionId,
      userId: user.id,
      userEmail: user.email,
      clerkId,
    }));
  });

  app.post<{ Params: { orderId: string } }>("/admin/shop/orders/:orderId/resend-fulfillment-email", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    return ok(await resendShopDigitalFulfillmentEmail(db, request.params.orderId));
  });

  app.get("/shop/purchases", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    return ok(await listMemberShopPurchases(db, user.id));
  });

  app.post<{ Body: { productId?: string; promoCode?: string } }>("/shop/checkout", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    const clerkId = requireClerkId(request);
    const productId = request.body?.productId?.trim();
    if (!productId) {
      throw createHttpError(400, "productId is required.");
    }

    const prepared = await prepareShopEntitlementForCheckout(db, {
      userId: user.id,
      productId,
    });

    if (prepared.kind === "already_paid") {
      return ok({
        alreadyPaid: true,
        requiresPayment: false,
        productId,
        shopEntitlementId: prepared.entitlement.id,
        url: null,
      });
    }

    const session = await createCheckoutSession(db, {
      type: "shop",
      shopEntitlementId: prepared.entitlement.id,
      userId: user.id,
      userEmail: user.email,
      clerkId,
      promoCode: request.body?.promoCode,
    });

    return ok({
      alreadyPaid: false,
      requiresPayment: true,
      productId,
      shopEntitlementId: prepared.entitlement.id,
      sessionId: session.id,
      url: session.url,
    });
  });

  app.post<{ Params: { fileId: string } }>("/shop/downloads/:fileId/token", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    return ok(await issueShopDownloadToken(db, {
      userId: user.id,
      fileId: request.params.fileId,
    }));
  });

  app.get<{ Params: { fileId: string }; Querystring: { token?: string } }>("/shop/downloads/:fileId", { preHandler: requireAuth }, async (request, reply) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    const token = request.query.token?.trim();
    if (!token) {
      return sendApiError(reply, 400, "A download token is required.");
    }
    const file = await loadAuthorizedShopDownload(db, { token, userId: user.id });
    reply.header("Content-Type", file.mimeType);
    reply.header("Content-Disposition", buildShopContentDisposition(file.displayName));
    return reply.send(file.buffer);
  });

  app.get("/admin/shop/products", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    return ok(await listAdminShopProducts(db));
  });

  app.post<{ Body: ShopAdminProductInput }>("/admin/shop/products", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    return ok(await createAdminShopProduct(db, request.body ?? {}));
  });

  app.get<{ Params: { productId: string } }>("/admin/shop/products/:productId", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    return ok(await getAdminShopProduct(db, request.params.productId));
  });

  app.patch<{ Params: { productId: string }; Body: ShopAdminProductInput }>("/admin/shop/products/:productId", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    return ok(await updateAdminShopProduct(db, request.params.productId, request.body ?? {}));
  });

  app.post<{ Params: { productId: string } }>("/admin/shop/products/:productId/images", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    const uploaded = await readMultipartFile(request, 5 * 1024 * 1024);
    const image = await addShopProductImage(db, {
      productId: request.params.productId,
      buffer: uploaded.buffer,
      mimeType: uploaded.mimeType,
      altText: typeof request.query === "object" && request.query && "altText" in request.query
        ? String((request.query as { altText?: string }).altText ?? "")
        : null,
    });
    return ok(image);
  });

  app.delete<{ Params: { imageId: string } }>("/admin/shop/images/:imageId", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    await deleteShopProductImage(db, request.params.imageId);
    return ok({ deleted: true });
  });

  app.post<{ Params: { productId: string }; Querystring: { kind?: string } }>("/admin/shop/products/:productId/files", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    const uploaded = await readMultipartFile(request, 50 * 1024 * 1024);
    const kind = request.query.kind === "deck" || request.query.kind === "booklet" || request.query.kind === "manual" || request.query.kind === "other"
      ? request.query.kind
      : "other";
    const file = await addShopProductFile(db, {
      productId: request.params.productId,
      buffer: uploaded.buffer,
      mimeType: uploaded.mimeType,
      displayName: uploaded.filename,
      originalName: uploaded.filename,
      kind,
    });
    return ok(file);
  });

  app.delete<{ Params: { fileId: string } }>("/admin/shop/files/:fileId", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    await deleteShopProductFile(db, request.params.fileId);
    return ok({ deleted: true });
  });

  app.get("/admin/shop/testimonials", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    return ok(await listAdminTestimonials(db));
  });

  app.get("/admin/shop/testimonial-settings", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    return ok(await getShopTestimonialSettings(db));
  });

  app.patch<{ Body: { heading?: string; subtitle?: string; disclaimer?: string } }>("/admin/shop/testimonial-settings", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    return ok(await updateShopTestimonialSettings(db, request.body ?? {}));
  });

  app.post<{ Body: ShopAdminTestimonialInput }>("/admin/shop/testimonials", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    return ok(await createAdminTestimonial(db, request.body ?? {}));
  });

  app.get<{ Params: { testimonialId: string } }>("/admin/shop/testimonials/:testimonialId", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    return ok(await getAdminTestimonial(db, request.params.testimonialId));
  });

  app.patch<{ Params: { testimonialId: string }; Body: ShopAdminTestimonialInput }>("/admin/shop/testimonials/:testimonialId", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    return ok(await updateAdminTestimonial(db, request.params.testimonialId, request.body ?? {}));
  });

  app.delete<{ Params: { testimonialId: string; associationId: string } }>("/admin/shop/testimonials/:testimonialId/associations/:associationId", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    return ok(await removeTestimonialAssociation(db, request.params.testimonialId, request.params.associationId));
  });
}
