import type { FastifyInstance, FastifyRequest } from "fastify";
import { validateExpressCheckout, type ExpressCheckoutInput } from "@wisdom/utils";
import { ok, sendApiError } from "../apiContract.js";
import { createHttpError } from "../services/booking/errors.js";
import { reviewExpressDeadlines, planExpressReminderEmails, type ExpressOrderRecord, type NotificationRow } from "../services/express/expressFulfillment.js";
import { resolveAdminExpressEmail } from "../services/express/expressEmail.js";
import { createExpressCheckoutSession } from "../services/express/expressStripe.js";
import { createPostgresExpressRepository } from "../services/express/expressOrderRepository.js";
import { attachExpressRecording, dispatchPendingExpressEmails, loadExpressDownload, queueExpressDelivery, runExpressReminderPass } from "../services/express/expressOrderService.js";
import { createConfiguredRecordingStore } from "../services/express/privateRecordingStore.js";
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
    return ok({ data: await repo.list() });
  });

  app.post("/admin/express/orders/:id/recording", async (request, reply) => {
    requireAdmin(request);
    const store = createConfiguredRecordingStore();
    if (!store) return sendApiError(reply, 503, "Private recording storage is not configured");
    const file = await request.file({ limits: { fileSize: 25 * 1024 * 1024 } });
    if (!file) return sendApiError(reply, 400, "A file is required");
    const kind = (request.query as { kind?: string }).kind === "transcript" ? "transcript" : "mp3";
    const bytes = new Uint8Array(await file.toBuffer());
    const order = await attachExpressRecording({
      repo: createPostgresExpressRepository(requireDatabase(app.db)),
      store,
      orderId: (request.params as { id: string }).id,
      mp3: kind === "mp3" ? bytes : null,
      transcript: kind === "transcript" ? bytes : null,
    });
    return ok({ data: order });
  });

  app.post("/admin/express/orders/:id/deliver", async (request, reply) => {
    requireAdmin(request);
    const repo = createPostgresExpressRepository(requireDatabase(app.db));
    const orderId = (request.params as { id: string }).id;
    try {
      const queued = await queueExpressDelivery({ repo, orderId });
      if (!queued.duplicate) {
        await dispatchPendingExpressEmails(repo, orderId, async (notice) => {
          const sent = await sendResendEmail({
            to: [notice.recipient],
            subject: notice.subject,
            text: notice.body,
            html: notice.body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>"),
          });
          return sent.success
            ? { ok: true, messageId: sent.messageId ?? undefined }
            : { ok: false, error: sent.error };
        });
      }
      return ok({ data: { duplicate: queued.duplicate } });
    } catch (error) {
      return sendApiError(reply, 400, error instanceof Error ? error.message : "Express delivery failed");
    }
  });

  app.get("/express/downloads/:token", async (request, reply) => {
    const store = createConfiguredRecordingStore();
    if (!store) return sendApiError(reply, 503, "Private recording storage is not configured");
    const loaded = await loadExpressDownload({
      repo: createPostgresExpressRepository(requireDatabase(app.db)),
      store,
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
