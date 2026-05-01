import { and, desc, eq, notInArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { payments } from "@wisdom/db";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireClerkId, requireDatabase, requireDbUser } from "../routeAssertions.js";
import { createCheckoutSession, type CreateCheckoutSessionInput } from "../services/paymentService.js";
import {
  createAdminInvoicePaymentLink,
  regenerateAdminInvoicePaymentLink,
  type CreateInvoicePaymentLinkInput,
} from "../services/payments/invoiceService.js";
import { processStripeWebhookEvent, syncCheckoutSessionCompleted } from "../services/payments/stripeWebhookService.js";

type CheckoutSyncEntityType = "session" | "report" | "mentoring_circle" | "mentor_training" | "subscription";

interface CheckoutSessionSyncBody {
  checkoutSessionId?: string;
  entityType?: CheckoutSyncEntityType;
  entityId?: string;
}

function readCheckoutSessionIdFromMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const sessionId = (value as Record<string, unknown>).stripeCheckoutSessionId;
  return typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : null;
}

function sessionBelongsToUser(input: {
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

export async function stripeRoutes(app: FastifyInstance) {
  app.post<{ Body: Omit<CreateCheckoutSessionInput, "userId" | "userEmail" | "clerkId"> }>(
    "/create-checkout-session",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const user = requireDbUser(request);
      const clerkId = requireClerkId(request);

      const session = await createCheckoutSession(db, {
        type: request.body?.type,
        tier: request.body?.tier,
        bookingId: request.body?.bookingId,
        reportId: request.body?.reportId,
        membershipId: request.body?.membershipId,
        trainingOrderId: request.body?.trainingOrderId,
        eventId: request.body?.eventId,
        promoCode: request.body?.promoCode,
        userId: user.id,
        userEmail: user.email,
        clerkId,
      });
      return ok({ sessionId: session.id, url: session.url });
    },
  );

  app.post<{ Body: CheckoutSessionSyncBody }>(
    "/checkout-session/sync",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const user = requireDbUser(request);
      const clerkId = requireClerkId(request);
      const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();

      if (!stripeKey) {
        return sendApiError(reply, 503, "Stripe checkout sync is not configured");
      }

      let checkoutSessionId = typeof request.body?.checkoutSessionId === "string"
        ? request.body.checkoutSessionId.trim()
        : "";

      if (!checkoutSessionId) {
        const entityType = typeof request.body?.entityType === "string"
          ? request.body.entityType.trim() as CheckoutSyncEntityType
          : "";
        const entityId = typeof request.body?.entityId === "string" ? request.body.entityId.trim() : "";

        if (!entityType || !entityId) {
          return sendApiError(reply, 400, "checkoutSessionId or entityType/entityId is required");
        }

        const [payment] = await db
          .select({
            metadata: payments.metadata,
          })
          .from(payments)
          .where(and(
            eq(payments.user_id, user.id),
            eq(payments.entity_type, entityType),
            eq(payments.entity_id, entityId),
            notInArray(payments.status, ["failed", "refunded"]),
          ))
          .orderBy(desc(payments.created_at))
          .limit(1);

        checkoutSessionId = readCheckoutSessionIdFromMetadata(payment?.metadata) ?? "";
        if (!checkoutSessionId) {
          return ok({
            synchronized: false,
            reason: "missing_checkout_session",
          });
        }
      }

      const stripe = new Stripe(stripeKey);
      const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);

      if (!sessionBelongsToUser({
        session,
        userId: user.id,
        userEmail: user.email,
        clerkId,
      })) {
        return sendApiError(reply, 403, "Checkout session does not belong to the authenticated user");
      }

      const result = await syncCheckoutSessionCompleted(db, session, {
        info: (payload, message) => app.log.info(payload, message),
        warn: (payload, message) => app.log.warn(payload, message),
        error: (payload, message) => app.log.error(payload, message),
      });

      return ok(result);
    },
  );

  app.post<{ Body: CreateInvoicePaymentLinkInput }>(
    "/admin/invoices",
    { preHandler: requireAuth },
    async (request) => {
      const db = requireDatabase(app.db);
      requireAdmin(request);

      const invoice = await createAdminInvoicePaymentLink(db, request.body, {
        info: (payload, message) => app.log.info(payload, message),
        warn: (payload, message) => app.log.warn(payload, message),
        error: (payload, message) => app.log.error(payload, message),
      });

      return ok({ data: invoice });
    },
  );

  app.post<{ Params: { invoiceId: string } }>(
    "/admin/invoices/:invoiceId/regenerate",
    { preHandler: requireAuth },
    async (request) => {
      const db = requireDatabase(app.db);
      requireAdmin(request);

      const invoice = await regenerateAdminInvoicePaymentLink(db, request.params.invoiceId, {
        info: (payload, message) => app.log.info(payload, message),
        warn: (payload, message) => app.log.warn(payload, message),
        error: (payload, message) => app.log.error(payload, message),
      });

      return ok({ data: invoice });
    },
  );

  const handleWebhook = async (
    request: { headers: Record<string, unknown>; rawBody?: string | Buffer },
    reply: { status: (code: number) => { send: (payload: unknown) => unknown }; send: (payload: unknown) => unknown },
  ) => {
    const db = requireDatabase(app.db);

    const signature = typeof request.headers["stripe-signature"] === "string"
      ? request.headers["stripe-signature"]
      : "";
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();

    if (!signature || !request.rawBody) {
      return sendApiError(reply, 400, "Missing Stripe signature or raw body");
    }
    if (!webhookSecret || !stripeKey) {
      app.log.error("Stripe webhook is not configured");
      return sendApiError(reply, 503, "Stripe webhook is not configured");
    }

    try {
      // Stripe signs the exact request bytes. Parsing JSON before verification mutates the
      // payload and breaks signature validation, so raw body capture must be route-scoped.
      const stripe = new Stripe(stripeKey);
      const event = stripe.webhooks.constructEvent(request.rawBody, signature, webhookSecret);
      const result = await processStripeWebhookEvent(db, event, {
        info: (payload, message) => app.log.info(payload, message),
        warn: (payload, message) => app.log.warn(payload, message),
        error: (payload, message) => app.log.error(payload, message),
      });

      return ok({ received: true, duplicate: result.duplicate });
    } catch (error) {
      app.log.error(error, "Stripe webhook processing failed");
      return sendApiError(reply, 400, "Stripe webhook processing failed");
    }
  };

  app.post("/stripe/webhook", { config: { rawBody: true } }, handleWebhook);
  app.post("/webhook/stripe", { config: { rawBody: true } }, handleWebhook);
}
