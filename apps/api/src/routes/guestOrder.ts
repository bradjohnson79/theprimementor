import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase, requireDbUser } from "../routeAssertions.js";
import { verifyOrderAccessToken } from "../services/guest/orderAccessTokenService.js";
import { getGuestOrderSummary } from "../services/guest/guestOrderSummaryService.js";
import { assertGuestSchemaReady } from "../services/guest/guestSchemaGuard.js";
import { createGuestBillingPortalSession } from "../services/guest/guestBillingPortalService.js";
import { requestLinkPurchaseByEmail, confirmLinkPurchaseByEmail } from "../services/guest/guestMergeService.js";

export async function guestOrderRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request) => {
    if (request.url.startsWith("/api/order/") || request.url.startsWith("/api/account/link-purchase")) {
      const db = requireDatabase(app.db);
      await assertGuestSchemaReady(db);
    }
  });

  app.get<{ Params: { token: string } }>(
    "/order/:token",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      try {
        const verified = await verifyOrderAccessToken(db, request.params.token, "order_page");
        const summary = await getGuestOrderSummary(db, verified.userId);
        return ok({
          email: summary.email,
          isGuest: summary.isGuest,
          items: summary.items,
          createAccountUrl: `/sign-up?email=${encodeURIComponent(summary.email)}`,
        });
      } catch (error) {
        return sendApiError(reply, (error as { statusCode?: number })?.statusCode ?? 404, error instanceof Error ? error.message : "Order link is invalid.");
      }
    },
  );

  app.post<{ Params: { token: string } }>(
    "/order/:token/billing-portal",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const verified = await verifyOrderAccessToken(db, request.params.token, "order_page");
      try {
        const session = await createGuestBillingPortalSession(db, {
          userId: verified.userId,
          email: verified.email,
          orderPageToken: request.params.token,
        });
        return ok({ url: session.url });
      } catch (error) {
        return sendApiError(reply, (error as { statusCode?: number })?.statusCode ?? 502, error instanceof Error ? error.message : "Could not open billing portal.");
      }
    },
  );

  // ---- Cross-account merge: a signed-in user claims a guest purchase made under a different email ----
  app.post<{ Body: { claimEmail?: string } }>(
    "/account/link-purchase/request",
    { preHandler: requireAuth, config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } },
    async (request) => {
      const db = requireDatabase(app.db);
      const user = requireDbUser(request);
      const claimEmail = request.body?.claimEmail;
      if (claimEmail) {
        await requestLinkPurchaseByEmail(db, { targetUserId: user.id, claimEmail }).catch(() => undefined);
      }
      // Always the same response — never reveal whether that email has anything on file.
      return ok({ success: true, message: "If that email has a guest order on file, we've sent a confirmation link to it." });
    },
  );

  app.post<{ Body: { token?: string } }>(
    "/account/link-purchase/confirm",
    { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const token = request.body?.token;
      if (!token) {
        return sendApiError(reply, 400, "token is required.");
      }
      try {
        const result = await confirmLinkPurchaseByEmail(db, token);
        return ok({ success: true, alreadyMerged: result.alreadyMerged });
      } catch (error) {
        return sendApiError(reply, (error as { statusCode?: number })?.statusCode ?? 400, error instanceof Error ? error.message : "This link is invalid or has expired.");
      }
    },
  );
}
