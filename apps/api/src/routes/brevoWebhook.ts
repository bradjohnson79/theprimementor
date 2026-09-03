import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireDatabase } from "../routeAssertions.js";
import { createDrizzleEmailListStore } from "../services/emailList/emailListStore.js";
import { handleBrevoDeliveryEvent, verifyBrevoWebhookSecret } from "../services/emailList/brevoDeliveryWebhook.js";

export async function brevoWebhookRoutes(app: FastifyInstance) {
  app.post("/webhooks/brevo", { config: { rawBody: true } }, async (request, reply) => {
    const secret = process.env.BREVO_WEBHOOK_SECRET?.trim();
    const rawBody = typeof (request as { rawBody?: unknown }).rawBody === "string"
      ? (request as { rawBody: string }).rawBody
      : "";
    if (!verifyBrevoWebhookSecret(secret, request.headers, request.query as Record<string, unknown>, rawBody)) {
      return sendApiError(reply, 401, "Webhook verification failed");
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    try {
      return ok(await handleBrevoDeliveryEvent(createDrizzleEmailListStore(requireDatabase(request.server.db)), body));
    } catch (error) {
      const status = error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode: number }).statusCode)
        : 500;
      return sendApiError(reply, status || 500, error instanceof Error ? error.message : "Webhook failed");
    }
  });
}
