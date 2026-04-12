import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireClerkId, requireDatabase, requireDbUser } from "../routeAssertions.js";
import { createCheckoutSession, type CreateCheckoutSessionInput } from "../services/paymentService.js";
import {
  createAdminInvoicePaymentLink,
  regenerateAdminInvoicePaymentLink,
  type CreateInvoicePaymentLinkInput,
} from "../services/payments/invoiceService.js";
import { processStripeWebhookEvent } from "../services/payments/stripeWebhookService.js";

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
        userId: user.id,
        userEmail: user.email,
        clerkId,
      });
      return ok({ sessionId: session.id, url: session.url });
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
