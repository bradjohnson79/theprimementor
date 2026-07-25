import type { FastifyInstance } from "fastify";
import { getRegenerationOfferStatus } from "@wisdom/utils";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireClerkId, requireDatabase, requireDbUser } from "../routeAssertions.js";
import { createCheckoutSession } from "../services/paymentService.js";
import { getRegenerationOfferPurchaseStatus } from "../services/regenerationOfferService.js";

interface PurchaseStatusQuery {
  checkoutSessionId?: string;
}

export async function regenerationOfferRoutes(app: FastifyInstance) {
  app.get("/regeneration-offer", async () => ok(getRegenerationOfferStatus()));

  app.post<{ Body: { bookingId?: string } }>("/member/regeneration-offer/checkout", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    const clerkId = requireClerkId(request);
    const bookingId = typeof request.body?.bookingId === "string" ? request.body.bookingId.trim() : "";
    const session = await createCheckoutSession(db, {
      type: "regeneration_offer",
      userId: user.id,
      userEmail: user.email,
      clerkId,
      bookingId: bookingId || undefined,
    });

    return ok({
      requiresPayment: true,
      sessionId: session.id,
      url: session.url,
    });
  });

  app.get<{ Querystring: PurchaseStatusQuery }>(
    "/member/regeneration-offer/status",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const user = requireDbUser(request);
      const checkoutSessionId = request.query.checkoutSessionId?.trim();
      if (!checkoutSessionId) {
        return sendApiError(reply, 400, "checkoutSessionId is required");
      }

      const status = await getRegenerationOfferPurchaseStatus(db, {
        userId: user.id,
        checkoutSessionId,
      });

      return ok({
        found: Boolean(status),
        status,
      });
    },
  );
}
