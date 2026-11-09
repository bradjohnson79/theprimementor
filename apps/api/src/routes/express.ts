import type { FastifyInstance, FastifyRequest } from "fastify";
import { validateExpressCheckout, type ExpressCheckoutInput } from "@wisdom/utils";
import { ok, sendApiError } from "../apiContract.js";
import { createHttpError } from "../services/booking/errors.js";
import { reviewExpressDeadlines, planExpressReminderEmails, type ExpressOrderRecord, type NotificationRow } from "../services/express/expressFulfillment.js";
import { resolveAdminExpressEmail } from "../services/express/expressEmail.js";
import { createExpressCheckoutSession } from "../services/express/expressStripe.js";
import { createDatabaseRecordingStore, createPostgresExpressRepository } from "../services/express/expressOrderRepository.js";
import { attachExpressRecording, dispatchExpressNotice, dispatchPendingExpressEmails, ensureExpressDemoOrder, loadExpressDownload, queueExpressDelay, queueExpressDelivery, runExpressReminderPass } from "../services/express/expressOrderService.js";
import { sendResendEmail } from "../services/notifications/providers/resendProvider.js";
import { requireAdmin, requireDatabase } from "../routeAssertions.js";

function assertExpressCron(request: FastifyRequest) {
  const configuredSecrets = [
    process.env.EXPRESS_CRON_SECRET?.trim(),
    process.env.CRON_SECRET?.trim(),
    process.env.INTERNAL_API_SECRET?.trim(),
  ].filter((value): value is string => Boolean(value));
  if (configuredSecrets.length === 0) {
    throw createHttpError(503, "Express reminder route secret is not configured");
  }
  const header = request.headers["x-cron-secret"];
  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
  const provided = typeof header === "string" && header.trim() ? header.trim() : bearer;
  if (!provided || !configuredSecrets.includes(provided)) {
    throw createHttpError(401, "Unauthorized");
  }
}

function checkoutDisabled() {
  return process.env.EXPRESS_CHECKOUT_ENABLED !== "true";
}

function recordings(app: FastifyInstance) {
  return createDatabaseRecordingStore(requireDatabase(app.db));
}

async function sendNotice(notice: { recipient: string; subject: string; body: string }) {
  const sent = await sendResendEmail({
    to: [notice.recipient],
    subject: notice.subject,
    text: notice.body,
    html: notice.body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>"),
  });
  return sent.success
    ? { ok: true as const, messageId: sent.messageId ?? undefined }
    : { ok: false as const, error: sent.error };
}

export async function expressRoutes(app: FastifyInstance) {
  app.post("/guest/express-checkout", async (request, reply) => {
    if (checkoutDisabled()) {
      return sendApiError(reply, 503, "Express checkout is waiting for the isolated API");
    }
    const result = validateExpressCheckout(request.body as ExpressCheckoutInput);
    if (!result.ok) return sendApiError(reply, 400, result.errors.join(" "));
    const session = await createExpressCheckoutSession(request.body as ExpressCheckoutInput);
    return ok({ data: { amountCents: result.amountCents, currency: "CAD", requiresPayment: true, sessionId: session.id, url: session.url } });
  });

  app.post("/express/checkout", async (request, reply) => {
    if (checkoutDisabled()) {
      return sendApiError(reply, 503, "Express checkout is waiting for the isolated API");
    }
    const result = validateExpressCheckout(request.body as ExpressCheckoutInput);
    if (!result.ok) return sendApiError(reply, 400, result.errors.join(" "));
    const session = await createExpressCheckoutSession(request.body as ExpressCheckoutInput);
    return ok({ data: { amountCents: result.amountCents, currency: "CAD", requiresPayment: true, sessionId: session.id, url: session.url } });
  });

  app.get("/admin/express/orders", async (request) => {
    requireAdmin(request);
    const repo = createPostgresExpressRepository(requireDatabase(app.db));
    await ensureExpressDemoOrder(repo);
    return ok(await repo.list());
  });

  app.post("/admin/express/orders/:id/recording", async (request, reply) => {
    requireAdmin(request);
    const file = await request.file({ limits: { fileSize: 25 * 1024 * 1024 } });
    if (!file) return sendApiError(reply, 400, "A file is required");
    const kind = (request.query as { kind?: string }).kind === "transcript" ? "transcript" : "mp3";
    const bytes = new Uint8Array(await file.toBuffer());
    const order = await attachExpressRecording({
      repo: createPostgresExpressRepository(requireDatabase(app.db)),
      store: recordings(app),
      orderId: (request.params as { id: string }).id,
      mp3: kind === "mp3" ? bytes : null,
      transcript: kind === "transcript" ? bytes : null,
    });
    return ok(order);
  });

  app.post("/admin/express/orders/:id/deliver", async (request, reply) => {
    requireAdmin(request);
    const repo = createPostgresExpressRepository(requireDatabase(app.db));
    const orderId = (request.params as { id: string }).id;
    try {
      const queued = await queueExpressDelivery({ repo, orderId });
      if (queued.duplicate) return ok({ duplicate: true, order: queued.order });
      const dispatched = await dispatchPendingExpressEmails(repo, orderId, sendNotice);
      const delivery = dispatched.notices.find((notice) => notice.eventType === "express_customer_delivery");
      if (delivery && delivery.status !== "sent") {
        return sendApiError(reply, 502, delivery.lastError || "Resend did not accept the email");
      }
      return ok({ duplicate: false, order: dispatched.order });
    } catch (error) {
      return sendApiError(reply, 400, error instanceof Error ? error.message : "Express delivery failed");
    }
  });

  app.post("/admin/express/orders/:id/delay", async (request, reply) => {
    requireAdmin(request);
    const repo = createPostgresExpressRepository(requireDatabase(app.db));
    const orderId = (request.params as { id: string }).id;
    const message = typeof (request.body as { message?: unknown })?.message === "string"
      ? (request.body as { message: string }).message
      : "";
    try {
      const queued = await queueExpressDelay({ repo, orderId, message });
      if (queued.duplicate) return ok({ duplicate: true, order: queued.order });
      const saved = await dispatchExpressNotice(repo, queued.notice, sendNotice);
      if (saved.status !== "sent") {
        return sendApiError(reply, 502, saved.lastError || "Resend did not accept the delay email");
      }
      return ok({ duplicate: false, order: await repo.get(orderId) });
    } catch (error) {
      return sendApiError(reply, 400, error instanceof Error ? error.message : "Express delay email failed");
    }
  });

  app.get("/express/downloads/:token", async (request, reply) => {
    const loaded = await loadExpressDownload({
      repo: createPostgresExpressRepository(requireDatabase(app.db)),
      store: recordings(app),
      token: (request.params as { token: string }).token,
    });
    if (!loaded) return sendApiError(reply, 404, "This download link is invalid or expired");
    reply.header("content-type", loaded.kind === "mp3" ? "audio/mpeg" : "text/plain; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="${loaded.kind === "mp3" ? "session.mp3" : "transcript.txt"}"`);
    return reply.send(Buffer.from(loaded.bytes));
  });

  app.post("/internal/express/reminders", async (request, reply) => {
    try {
      assertExpressCron(request);
      if (app.db) {
        const result = await runExpressReminderPass(createPostgresExpressRepository(app.db), new Date());
        return ok({ data: result });
      }
      const body = request.body as { orders?: ExpressOrderRecord[]; notices?: NotificationRow[] } | undefined;
      const orders = Array.isArray(body?.orders) ? body.orders : [];
      const notices = Array.isArray(body?.notices) ? body.notices : [];
      const reminders = await planExpressReminderEmails({
        orders,
        now: new Date(),
        notices,
        adminEmail: resolveAdminExpressEmail(),
      });
      return ok({
        data: {
          reminders,
          review: reviewExpressDeadlines(orders, new Date()),
        },
      });
    } catch (error) {
      const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;
      return sendApiError(reply, statusCode, error instanceof Error ? error.message : "Express reminder failed");
    }
  });
}
