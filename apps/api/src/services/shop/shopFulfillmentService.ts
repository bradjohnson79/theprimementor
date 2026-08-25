import { asc, eq } from "drizzle-orm";
import Stripe from "stripe";
import { orders, shopProductImages, shopProducts, users, type Database } from "@wisdom/db";
import { createHttpError } from "../booking/errors.js";
import { sendNotification } from "../notifications/notificationService.js";
import { getShopProductById, publicShopImageUrl } from "./shopCatalog.js";
import {
  retrieveShopCheckoutSession,
  type ShopCheckoutSessionOwner,
} from "./shopCheckoutSessionRetrieve.js";
import {
  getShopEntitlementByCheckoutSessionId,
  getShopEntitlementById,
  hasActiveShopEntitlement,
} from "./shopEntitlementService.js";

export type ShopCheckoutSessionRetriever = (
  sessionId: string,
  owner?: ShopCheckoutSessionOwner,
) => Promise<Stripe.Checkout.Session>;

export const DEFAULT_SHOP_DOWNLOAD_LABEL = "Download Your Product";

export type ShopFulfillmentState =
  | "ready"
  | "processing"
  | "invalid"
  | "unpaid"
  | "canceled"
  | "missing_fulfillment"
  | "email_failed";

export type ShopFulfillmentEmailStatus = "sent" | "failed" | "pending" | "skipped" | null;

export interface ShopOrderSuccessView {
  state: ShopFulfillmentState;
  productName: string | null;
  formatLabel: string | null;
  productImage: { url: string; altText: string | null } | null;
  orderReference: string | null;
  downloadLabel: string | null;
  downloadUrl: string | null;
  instructions: string | null;
  maskedEmail: string | null;
  emailStatus: ShopFulfillmentEmailStatus;
  message: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function maskEmail(email: string | null | undefined) {
  const value = email?.trim().toLowerCase();
  if (!value || !value.includes("@")) return null;
  const [local, domain] = value.split("@");
  if (!local || !domain) return null;
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

export function shopCheckoutSessionBelongsToUser(input: {
  session: Stripe.Checkout.Session;
  userId: string;
  userEmail: string;
  clerkId: string;
}) {
  const metadata = input.session.metadata ?? {};
  const metadataUserId = typeof metadata.userId === "string" ? metadata.userId.trim() : "";
  const metadataUserEmail = typeof metadata.userEmail === "string" ? metadata.userEmail.trim().toLowerCase() : "";
  const metadataClerkId = typeof metadata.clerkId === "string" ? metadata.clerkId.trim() : "";

  return metadataUserId === input.userId
    || metadataClerkId === input.clerkId
    || (metadataUserEmail.length > 0 && metadataUserEmail === input.userEmail.toLowerCase());
}

export function firstNameFromDisplayName(name: string | null | undefined) {
  const first = name?.trim().split(/\s+/)[0];
  return first && first.length >= 2 ? first : null;
}

function emptySuccess(state: ShopFulfillmentState, message: string): ShopOrderSuccessView {
  return {
    state,
    productName: null,
    formatLabel: null,
    productImage: null,
    orderReference: null,
    downloadLabel: null,
    downloadUrl: null,
    instructions: null,
    maskedEmail: null,
    emailStatus: null,
    message,
  };
}

export function readShopFulfillmentRecord(product: typeof shopProducts.$inferSelect) {
  const downloadUrl = product.fulfillment_download_url?.trim() || null;
  const fulfillmentType = product.fulfillment_type?.trim() || (downloadUrl ? "external_download" : null);
  return {
    fulfillmentType,
    downloadUrl: fulfillmentType === "external_download" ? downloadUrl : null,
    downloadLabel: product.fulfillment_download_label?.trim() || DEFAULT_SHOP_DOWNLOAD_LABEL,
    emailEnabled: product.fulfillment_email_enabled !== false,
    instructions: product.fulfillment_instructions?.trim() || null,
  };
}

function readOrderEmailStatus(metadata: unknown): ShopFulfillmentEmailStatus {
  const status = readString(asRecord(metadata).fulfillmentEmailStatus);
  if (status === "sent" || status === "failed" || status === "pending" || status === "skipped") {
    return status;
  }
  return null;
}

async function persistOrderFulfillmentMetadata(
  db: Database,
  orderId: string,
  patch: Record<string, unknown>,
) {
  const [current] = await db.select({ metadata: orders.metadata }).from(orders).where(eq(orders.id, orderId)).limit(1);
  await db.update(orders).set({
    metadata: {
      ...asRecord(current?.metadata),
      ...patch,
    },
    updated_at: new Date(),
  }).where(eq(orders.id, orderId));
}

export async function sendShopDigitalFulfillmentEmail(
  db: Database,
  input: {
    orderId: string;
    userId: string;
    productId: string;
    recipientEmail?: string | null;
    firstName?: string | null;
    notificationEntityId?: string;
  },
) {
  const product = await getShopProductById(db, input.productId);
  if (!product) {
    throw createHttpError(404, "Shop product was not found.");
  }
  const fulfillment = readShopFulfillmentRecord(product);
  if (!fulfillment.emailEnabled) {
    await persistOrderFulfillmentMetadata(db, input.orderId, {
      fulfillmentType: fulfillment.fulfillmentType,
      fulfillmentEmailStatus: "skipped",
      fulfillmentEmailError: null,
    });
    return { sent: false, skipped: true, reason: "disabled" as const };
  }
  if (!fulfillment.downloadUrl) {
    console.error("shop_fulfillment_email_missing_url", { orderId: input.orderId, productId: product.id, slug: product.slug });
    await persistOrderFulfillmentMetadata(db, input.orderId, {
      fulfillmentType: fulfillment.fulfillmentType,
      fulfillmentEmailStatus: "failed",
      fulfillmentEmailError: "Fulfillment download URL is not configured.",
    });
    return { sent: false, skipped: false, reason: "missing_url" as const };
  }

  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, input.userId)).limit(1);
  const recipient = input.recipientEmail?.trim() || user?.email?.trim() || null;
  if (!recipient) {
    await persistOrderFulfillmentMetadata(db, input.orderId, {
      fulfillmentType: fulfillment.fulfillmentType,
      fulfillmentEmailStatus: "failed",
      fulfillmentEmailError: "No trusted fulfillment email was available.",
    });
    return { sent: false, skipped: false, reason: "missing_recipient" as const };
  }

  const result = await sendNotification(db, {
    event: "shop.digital_fulfillment",
    userId: input.userId,
    forceRecipients: [recipient],
    payload: {
      entityId: input.notificationEntityId ?? input.orderId,
      orderId: input.orderId,
      productName: product.name,
      downloadUrl: fulfillment.downloadUrl,
      downloadLabel: fulfillment.downloadLabel,
      firstName: input.firstName ?? null,
      instructions: fulfillment.instructions,
    },
  });

  if (!result.success) {
    await persistOrderFulfillmentMetadata(db, input.orderId, {
      fulfillmentType: fulfillment.fulfillmentType,
      fulfillmentEmailStatus: "failed",
      fulfillmentEmailError: "Fulfillment email delivery failed.",
    });
    return { sent: false, skipped: false, reason: "send_failed" as const };
  }

  if (result.skipped) {
    await persistOrderFulfillmentMetadata(db, input.orderId, {
      fulfillmentType: fulfillment.fulfillmentType,
      fulfillmentEmailStatus: "sent",
      fulfillmentEmailError: null,
    });
    return { sent: false, skipped: true, reason: "duplicate" as const };
  }

  await persistOrderFulfillmentMetadata(db, input.orderId, {
    fulfillmentType: fulfillment.fulfillmentType,
    fulfillmentEmailStatus: "sent",
    fulfillmentEmailSentAt: new Date().toISOString(),
    fulfillmentEmailMessageId: null,
    fulfillmentEmailError: null,
  });
  return { sent: true, skipped: false, reason: "sent" as const };
}

export async function resendShopDigitalFulfillmentEmail(db: Database, orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.type !== "shop") {
    throw createHttpError(404, "Shop order was not found.");
  }
  const metadata = asRecord(order.metadata);
  const productId = readString(metadata.productId);
  if (!productId) {
    throw createHttpError(409, "This Shop order is missing its catalog product.");
  }
  return sendShopDigitalFulfillmentEmail(db, {
    orderId: order.id,
    userId: order.user_id,
    productId,
    notificationEntityId: `${order.id}:admin-resend:${Date.now()}`,
  });
}

export async function getShopOrderSuccessView(
  db: Database,
  input: {
    sessionId?: string | null;
    userId: string;
    userEmail: string;
    clerkId: string;
  },
  retrieve: ShopCheckoutSessionRetriever = retrieveShopCheckoutSession,
): Promise<ShopOrderSuccessView> {
  const sessionId = input.sessionId?.trim();
  if (!sessionId) {
    return emptySuccess("invalid", "This checkout session could not be verified.");
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await retrieve(sessionId, {
      userId: input.userId,
      userEmail: input.userEmail,
      clerkId: input.clerkId,
    });
  } catch {
    return emptySuccess("invalid", "This checkout session could not be verified.");
  }

  const metadata = session.metadata ?? {};
  if (metadata.type !== "shop") {
    return emptySuccess("invalid", "This checkout session is not a Shop purchase.");
  }

  if (!shopCheckoutSessionBelongsToUser({
    session,
    userId: input.userId,
    userEmail: input.userEmail,
    clerkId: input.clerkId,
  })) {
    throw createHttpError(403, "Checkout session does not belong to the authenticated user");
  }

  if (session.status === "expired" || session.status === "canceled" || session.payment_status === "unpaid") {
    const canceled = session.status === "expired" || session.status === "canceled";
    return emptySuccess(
      canceled ? "canceled" : "unpaid",
      canceled
        ? "This payment was canceled. No download is available."
        : "Payment has not been completed, so the download is not available.",
    );
  }

  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return emptySuccess("unpaid", "Payment has not been completed, so the download is not available.");
  }

  const entitlement = await getShopEntitlementByCheckoutSessionId(db, session.id)
    ?? (session.client_reference_id ? await getShopEntitlementById(db, session.client_reference_id) : null);

  if (!entitlement || entitlement.userId !== input.userId) {
    return emptySuccess("processing", "Your payment was successful. We're preparing your download now. This normally takes only a moment.");
  }
  if (!hasActiveShopEntitlement(entitlement)) {
    return emptySuccess("processing", "Your payment was successful. We're preparing your download now. This normally takes only a moment.");
  }

  const product = await getShopProductById(db, entitlement.productId);
  if (!product) {
    return emptySuccess("missing_fulfillment", "Your purchase is complete. Please contact support so we can finish delivery.");
  }

  const [image] = await db
    .select()
    .from(shopProductImages)
    .where(eq(shopProductImages.product_id, product.id))
    .orderBy(asc(shopProductImages.sort_order))
    .limit(1);
  const [order] = entitlement.orderId
    ? await db.select().from(orders).where(eq(orders.id, entitlement.orderId)).limit(1)
    : [];
  const fulfillment = readShopFulfillmentRecord(product);
  const emailStatus = readOrderEmailStatus(order?.metadata);
  const trustedEmail = readString(metadata.userEmail) || input.userEmail;
  const base = {
    productName: product.name,
    formatLabel: product.format_label,
    productImage: image
      ? { url: publicShopImageUrl(product.slug, image.storage_key, image.mime_type), altText: image.alt_text || product.name }
      : null,
    orderReference: order?.id?.slice(0, 8) ?? entitlement.id.slice(0, 8),
    instructions: fulfillment.instructions,
    maskedEmail: maskEmail(trustedEmail),
    emailStatus,
  };

  if (!fulfillment.downloadUrl) {
    console.error("shop_fulfillment_missing_url", { productId: product.id, slug: product.slug, sessionId: session.id });
    return {
      ...emptySuccess("missing_fulfillment", "Your purchase is complete. Please contact support so we can finish delivery."),
      ...base,
      downloadLabel: null,
      downloadUrl: null,
    };
  }

  return {
    state: emailStatus === "failed" ? "email_failed" : "ready",
    ...base,
    downloadLabel: fulfillment.downloadLabel,
    downloadUrl: fulfillment.downloadUrl,
    message: emailStatus === "failed"
      ? "Your purchase is complete and your download is ready. We could not confirm that the fulfillment email was delivered."
      : "Your digital product is ready. Use the button below to access your download. We've also sent the download information to your email address for safekeeping.",
  };
}
