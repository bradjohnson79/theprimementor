import type { FastifyInstance, FastifyRequest } from "fastify";
import { validateExpressCheckout, type ExpressCheckoutInput } from "@wisdom/utils";
import { ok, sendApiError } from "../apiContract.js";
import { createHttpError } from "../services/booking/errors.js";
import { reviewExpressDeadlines, planExpressReminderEmails, type ExpressOrderRecord, type NotificationRow } from "../services/express/expressFulfillment.js";
import { resolveAdminExpressEmail } from "../services/express/expressEmail.js";

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
    return ok({ data: { amountCents: result.amountCents, currency: "CAD", checkout: "prepared" } });
  });

  app.post("/express/checkout", async (request, reply) => {
    if (checkoutDisabled()) {
      return sendApiError(reply, 503, "Express checkout is waiting for the isolated API");
    }
    const result = validateExpressCheckout(request.body as ExpressCheckoutInput);
    if (!result.ok) return sendApiError(reply, 400, result.errors.join(" "));
    return ok({ data: { amountCents: result.amountCents, currency: "CAD", checkout: "prepared" } });
  });

  app.post("/internal/express/reminders", async (request, reply) => {
    try {
      assertExpressCron(request);
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
