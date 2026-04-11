import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { requireAuth } from "../middleware/auth.js";
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
      if (!app.db) {
        return reply.status(503).send({ error: "Database not available" });
      }
      if (!request.dbUser || !request.clerkId) {
        return reply.status(401).send({ error: "Authenticated user context is required" });
      }

      const session = await createCheckoutSession(app.db, {
        type: request.body?.type,
        tier: request.body?.tier,
        bookingId: request.body?.bookingId,
        reportId: request.body?.reportId,
        membershipId: request.body?.membershipId,
        userId: request.dbUser.id,
        userEmail: request.dbUser.email,
        clerkId: request.clerkId,
      });
    return reply.send({ sessionId: session.id, url: session.url });
    },
  );

  app.post<{ Body: CreateInvoicePaymentLinkInput }>(
    "/admin/invoices",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!app.db) {
        return reply.status(503).send({ error: "Database not available" });
      }
      if (request.dbUser?.role !== "admin") {
        return reply.status(403).send({ error: "Admin access required" });
      }

      const invoice = await createAdminInvoicePaymentLink(app.db, request.body, {
        info: (payload, message) => app.log.info(payload, message),
        warn: (payload, message) => app.log.warn(payload, message),
        error: (payload, message) => app.log.error(payload, message),
      });

      return reply.send({ data: invoice });
    },
  );

  app.post<{ Params: { invoiceId: string } }>(
    "/admin/invoices/:invoiceId/regenerate",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!app.db) {
        return reply.status(503).send({ error: "Database not available" });
      }
      if (request.dbUser?.role !== "admin") {
        return reply.status(403).send({ error: "Admin access required" });
      }

      const invoice = await regenerateAdminInvoicePaymentLink(app.db, request.params.invoiceId, {
        info: (payload, message) => app.log.info(payload, message),
        warn: (payload, message) => app.log.warn(payload, message),
        error: (payload, message) => app.log.error(payload, message),
      });

      return reply.send({ data: invoice });
    },
  );

  const handleWebhook = async (
    request: { headers: Record<string, unknown>; rawBody?: string | Buffer },
    reply: { status: (code: number) => { send: (payload: unknown) => unknown }; send: (payload: unknown) => unknown },
  ) => {
    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    const signature = typeof request.headers["stripe-signature"] === "string"
      ? request.headers["stripe-signature"]
      : "";
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();

    if (!signature || !request.rawBody) {
      return reply.status(400).send({ error: "Missing Stripe signature or raw body" });
    }
    if (!webhookSecret || !stripeKey) {
      app.log.error("Stripe webhook is not configured");
      return reply.status(503).send({ error: "Stripe webhook is not configured" });
    }

    try {
      // Stripe signs the exact request bytes. Parsing JSON before verification mutates the
      // payload and breaks signature validation, so raw body capture must be route-scoped.
      const stripe = new Stripe(stripeKey);
      const event = stripe.webhooks.constructEvent(request.rawBody, signature, webhookSecret);
      const result = await processStripeWebhookEvent(app.db, event, {
        info: (payload, message) => app.log.info(payload, message),
        warn: (payload, message) => app.log.warn(payload, message),
        error: (payload, message) => app.log.error(payload, message),
      });

      return reply.send({ received: true, duplicate: result.duplicate });
    } catch (error) {
      app.log.error(error, "Stripe webhook processing failed");
      return reply.status(400).send({ error: "Stripe webhook processing failed" });
    }
  };

  app.post("/stripe/webhook", { config: { rawBody: true } }, handleWebhook);
  app.post("/webhook/stripe", { config: { rawBody: true } }, handleWebhook);
}
