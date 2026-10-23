import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, desc, eq, gt } from "drizzle-orm";
import { bookings, bookingTypes, type Database } from "@wisdom/db";
import { logger } from "@wisdom/utils";
import { ok, sendApiError } from "../apiContract.js";
import { requireDatabase } from "../routeAssertions.js";
import { createHttpError } from "../services/booking/errors.js";
import { createBooking } from "../services/booking/bookingService.js";
import { createMemberReportOrder } from "../services/reportPurchaseService.js";
import { prepareShopEntitlementForCheckout } from "../services/shop/shopEntitlementService.js";
import { createCheckoutSession } from "../services/paymentService.js";
import { createRegenerationCheckoutSession } from "../services/regenerationSubscriptionService.js";
import { resolveOrCreateGuestUser, normalizeGuestEmail, findExistingGuestOrRealUser } from "../services/guest/guestIdentity.js";
import { assertGuestSchemaReady } from "../services/guest/guestSchemaGuard.js";
import { issueOrderAccessToken } from "../services/guest/orderAccessTokenService.js";
import { getGuestOrderSummary, summarizeForEmail } from "../services/guest/guestOrderSummaryService.js";
import { sendGuestOrderAccessEmail, sendGuestResendLinksEmail } from "../services/guest/guestNotify.js";

const GUEST_RATE_LIMIT = { max: 10, timeWindow: "1 minute" } as const;
const GUEST_RESEND_RATE_LIMIT = { max: 5, timeWindow: "10 minutes" } as const;

function getFrontendUrl(): string {
  return (process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:3000").trim().replace(/\/$/, "");
}

function buildOrderPageUrl(token: string): string {
  return `${getFrontendUrl()}/order/${encodeURIComponent(token)}`;
}

/** Honeypot: a hidden field real users never fill in. If present, pretend success and no-op. */
function isHoneypotTripped(body: Record<string, unknown> | undefined): boolean {
  const value = body?.website ?? body?.company ?? body?.hp_field;
  return typeof value === "string" && value.trim().length > 0;
}

interface GuestContactFields {
  email?: string;
  fullName?: string;
  name?: string;
  honeypot?: boolean;
}

async function resolveGuestActor(db: Database, body: Record<string, unknown> | undefined) {
  if (isHoneypotTripped(body)) {
    // Return a value that will cause callers to no-op successfully without doing real work.
    throw createHttpError(202, "Thanks — check your email for confirmation.");
  }
  const email = normalizeGuestEmail((body as GuestContactFields)?.email);
  const name = typeof (body as GuestContactFields)?.fullName === "string"
    ? (body as GuestContactFields).fullName
    : typeof (body as GuestContactFields)?.name === "string"
      ? (body as GuestContactFields).name
      : null;
  return resolveOrCreateGuestUser(db, { email, name });
}

async function issueAndSendOrderAccess(db: Database, input: { userId: string; email: string; isResend?: boolean }) {
  const { token } = await issueOrderAccessToken(db, {
    userId: input.userId,
    email: input.email,
    purpose: "order_page",
  });
  const summary = await getGuestOrderSummary(db, input.userId);
  const lines = summarizeForEmail(summary);
  const orderPageUrl = buildOrderPageUrl(token);
  await sendGuestOrderAccessEmail({
    to: input.email,
    orderPageUrl,
    summaryLines: lines.length > 0 ? lines : ["Your order"],
    isResend: input.isResend,
  });
  return { token, orderPageUrl };
}

/** Prevents duplicate-submission/double-click bookings for non-event-keyed session types. */
async function findRecentReusableBooking(db: Database, input: { userId: string; bookingTypeId: string }) {
  const windowStart = new Date(Date.now() - 10 * 60 * 1000);
  const [row] = await db
    .select({ id: bookings.id, status: bookings.status })
    .from(bookings)
    .where(and(
      eq(bookings.user_id, input.userId),
      eq(bookings.booking_type_id, input.bookingTypeId),
      eq(bookings.status, "pending_payment"),
      gt(bookings.created_at, windowStart),
    ))
    .orderBy(desc(bookings.created_at))
    .limit(1);
  return row ?? null;
}

export async function guestCheckoutRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request) => {
    if (request.url.startsWith("/api/guest/")) {
      const db = requireDatabase(app.db);
      await assertGuestSchemaReady(db);
    }
  });

  // ---- Session booking (Q&A, Mentoring, Email Session, Past Life, Prime Body Healing) ----
  app.post<{ Body: Record<string, unknown> }>(
    "/guest/bookings",
    { config: { rateLimit: GUEST_RATE_LIMIT } },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const body = request.body ?? {};
      let guest;
      try {
        guest = await resolveGuestActor(db, body);
      } catch (error) {
        if ((error as { statusCode?: number })?.statusCode === 202) {
          return ok({ success: true, requiresPayment: false });
        }
        throw error;
      }

      const bookingTypeId = typeof body.bookingTypeId === "string" ? body.bookingTypeId : undefined;
      const sessionType = typeof body.sessionType === "string" ? body.sessionType : undefined;
      if (!bookingTypeId && !sessionType) {
        return sendApiError(reply, 400, "bookingTypeId or sessionType is required");
      }
      if (!body.timezone || typeof body.timezone !== "string") {
        return sendApiError(reply, 400, "timezone is required");
      }

      let booking;
      const existing = bookingTypeId
        ? await findRecentReusableBooking(db, { userId: guest.user.id, bookingTypeId })
        : null;
      if (existing) {
        booking = existing;
        logger.info("guest_booking_deduped", { bookingId: existing.id, userId: guest.user.id });
      } else {
        booking = await createBooking(db, {
          actorUserId: guest.user.id,
          actorRole: "client",
          bookingTypeId,
          sessionType,
          availability: body.availability as Record<string, unknown> | null | undefined,
          timezone: body.timezone,
          fullName: typeof body.fullName === "string" ? body.fullName : undefined,
          email: guest.user.email,
          phone: typeof body.phone === "string" ? body.phone : undefined,
          gender: typeof body.gender === "string" ? body.gender : undefined,
          birthDate: typeof body.birthDate === "string" ? body.birthDate : undefined,
          birthTime: typeof body.birthTime === "string" ? body.birthTime : undefined,
          birthPlace: typeof body.birthPlace === "string" ? body.birthPlace : undefined,
          birthPlaceName: typeof body.birthPlaceName === "string" ? body.birthPlaceName : undefined,
          birthLat: typeof body.birthLat === "number" ? body.birthLat : undefined,
          birthLng: typeof body.birthLng === "number" ? body.birthLng : undefined,
          birthTimezone: typeof body.birthTimezone === "string" ? body.birthTimezone : undefined,
          timezoneSource: body.timezoneSource as "user" | "suggested" | "fallback" | undefined,
          consentGiven: typeof body.consentGiven === "boolean" ? body.consentGiven : undefined,
          intake: body.intake as Record<string, unknown> | null | undefined,
          notes: typeof body.notes === "string" ? body.notes : undefined,
        });
      }

      const session = await createCheckoutSession(db, {
        type: "session",
        bookingId: booking.id,
        userId: guest.user.id,
        userEmail: guest.user.email,
        clerkId: guest.user.clerk_id,
        promoCode: typeof body.promoCode === "string" ? body.promoCode : undefined,
      });

      const orderAccess = guest.attachedToExistingAccount
        ? null
        : await issueAndSendOrderAccess(db, { userId: guest.user.id, email: guest.user.email });

      return ok({
        success: true,
        requiresPayment: true,
        bookingId: booking.id,
        sessionId: session.id,
        url: session.url,
        orderPageUrl: orderAccess?.orderPageUrl ?? null,
      });
    },
  );

  // ---- Reports (guest order with birth-data intake) ----
  app.post<{ Body: Record<string, unknown> }>(
    "/guest/reports",
    { config: { rateLimit: GUEST_RATE_LIMIT } },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const body = request.body ?? {};
      let guest;
      try {
        guest = await resolveGuestActor(db, body);
      } catch (error) {
        if ((error as { statusCode?: number })?.statusCode === 202) {
          return ok({ success: true, requiresPayment: false });
        }
        throw error;
      }

      const report = await createMemberReportOrder(db, {
        userId: guest.user.id,
        tier: body.tier,
        reportType: body.reportType,
        fullName: body.fullName,
        email: guest.user.email,
        phone: body.phone,
        birthDate: body.birthDate,
        birthTime: body.birthTime,
        birthPlaceName: body.birthPlaceName,
        birthLat: body.birthLat,
        birthLng: body.birthLng,
        birthTimezone: body.birthTimezone,
        timezoneSource: body.timezoneSource,
        primaryFocus: body.primaryFocus,
        consentGiven: body.consentGiven,
        notes: body.notes,
        currentLocation: body.currentLocation,
        question1: body.question1,
        question2: body.question2,
        question3: body.question3,
        personA: body.personA,
        personB: body.personB,
        relationshipType: body.relationshipType,
        relationshipQuestion: body.relationshipQuestion,
        relationshipStatus: body.relationshipStatus,
        desiredFocus: body.desiredFocus,
        currentLifeFocus: body.currentLifeFocus,
        areasOfInterest: body.areasOfInterest,
      });

      const session = await createCheckoutSession(db, {
        type: "report",
        reportId: report.id,
        userId: guest.user.id,
        userEmail: guest.user.email,
        clerkId: guest.user.clerk_id,
        promoCode: typeof body.promoCode === "string" ? body.promoCode : undefined,
      });

      const orderAccess = guest.attachedToExistingAccount
        ? null
        : await issueAndSendOrderAccess(db, { userId: guest.user.id, email: guest.user.email });

      return ok({
        success: true,
        requiresPayment: true,
        reportId: report.id,
        sessionId: session.id,
        url: session.url,
        orderPageUrl: orderAccess?.orderPageUrl ?? null,
      });
    },
  );

  // ---- Shop digital products ----
  app.post<{ Body: { email?: string; fullName?: string; productId?: string; promoCode?: string; website?: string } }>(
    "/guest/shop/checkout",
    { config: { rateLimit: GUEST_RATE_LIMIT } },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const body = request.body ?? {};
      let guest;
      try {
        guest = await resolveGuestActor(db, body);
      } catch (error) {
        if ((error as { statusCode?: number })?.statusCode === 202) {
          return ok({ success: true, requiresPayment: false });
        }
        throw error;
      }

      const productId = body.productId?.trim();
      if (!productId) {
        return sendApiError(reply, 400, "productId is required.");
      }

      const prepared = await prepareShopEntitlementForCheckout(db, { userId: guest.user.id, productId });
      if (prepared.kind === "already_paid") {
        return ok({ alreadyPaid: true, requiresPayment: false, productId, shopEntitlementId: prepared.entitlement.id, url: null });
      }

      const session = await createCheckoutSession(db, {
        type: "shop",
        shopEntitlementId: prepared.entitlement.id,
        userId: guest.user.id,
        userEmail: guest.user.email,
        clerkId: guest.user.clerk_id,
        promoCode: body.promoCode,
      });

      const orderAccess = guest.attachedToExistingAccount
        ? null
        : await issueAndSendOrderAccess(db, { userId: guest.user.id, email: guest.user.email });

      return ok({
        alreadyPaid: false,
        requiresPayment: true,
        productId,
        shopEntitlementId: prepared.entitlement.id,
        sessionId: session.id,
        url: session.url,
        orderPageUrl: orderAccess?.orderPageUrl ?? null,
      });
    },
  );

  // ---- Manifestation Monthly (Regeneration) subscription ----
  app.post<{ Body: { email?: string; fullName?: string; website?: string } }>(
    "/guest/regeneration-subscription/checkout",
    { config: { rateLimit: GUEST_RATE_LIMIT } },
    async (request) => {
      const db = requireDatabase(app.db);
      const body = request.body ?? {};
      const guest = await resolveGuestActor(db, body);

      const session = await createRegenerationCheckoutSession(db, {
        userId: guest.user.id,
        clerkId: guest.user.clerk_id,
      });

      const orderAccess = guest.attachedToExistingAccount
        ? null
        : await issueAndSendOrderAccess(db, { userId: guest.user.id, email: guest.user.email });

      return ok({
        success: true,
        requiresPayment: true,
        sessionId: session.sessionId,
        url: session.url,
        orderPageUrl: orderAccess?.orderPageUrl ?? null,
      });
    },
  );

  // ---- Webinar / Mentoring Circle ticket checkout (e.g. Prime Alchemy Teachings Nov 1) ----
  app.post<{ Body: { email?: string; fullName?: string; eventId?: string; webinarId?: string; website?: string } }>(
    "/guest/webinar-checkout",
    { config: { rateLimit: GUEST_RATE_LIMIT } },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const body = request.body ?? {};
      let guest;
      try {
        guest = await resolveGuestActor(db, body);
      } catch (error) {
        if ((error as { statusCode?: number })?.statusCode === 202) {
          return ok({ success: true, requiresPayment: false });
        }
        throw error;
      }

      if (!body.eventId) {
        return sendApiError(reply, 400, "eventId is required.");
      }

      const session = await createCheckoutSession(db, {
        type: "webinar",
        eventId: body.eventId,
        userId: guest.user.id,
        userEmail: guest.user.email,
        clerkId: guest.user.clerk_id,
      });

      const orderAccess = guest.attachedToExistingAccount
        ? null
        : await issueAndSendOrderAccess(db, { userId: guest.user.id, email: guest.user.email });

      return ok({
        success: true,
        requiresPayment: true,
        sessionId: session.id,
        url: session.url,
        orderPageUrl: orderAccess?.orderPageUrl ?? null,
      });
    },
  );

  // ---- On-demand webinars (recorded) ----
  app.post<{ Body: { email?: string; fullName?: string; webinarId?: string; website?: string } }>(
    "/guest/on-demand-webinar-checkout",
    { config: { rateLimit: GUEST_RATE_LIMIT } },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const body = request.body ?? {};
      let guest;
      try {
        guest = await resolveGuestActor(db, body);
      } catch (error) {
        if ((error as { statusCode?: number })?.statusCode === 202) {
          return ok({ success: true, requiresPayment: false });
        }
        throw error;
      }
      if (!body.webinarId) {
        return sendApiError(reply, 400, "webinarId is required.");
      }
      const session = await createCheckoutSession(db, {
        type: "on_demand_webinar",
        webinarId: body.webinarId,
        userId: guest.user.id,
        userEmail: guest.user.email,
        clerkId: guest.user.clerk_id,
      });
      const orderAccess = guest.attachedToExistingAccount
        ? null
        : await issueAndSendOrderAccess(db, { userId: guest.user.id, email: guest.user.email });
      return ok({
        success: true,
        requiresPayment: true,
        sessionId: session.id,
        url: session.url,
        orderPageUrl: orderAccess?.orderPageUrl ?? null,
      });
    },
  );

  // ---- Resend my links (always the same response regardless of whether anything is found) ----
  app.post<{ Body: { email?: string; website?: string } }>(
    "/guest/resend-links",
    { config: { rateLimit: GUEST_RESEND_RATE_LIMIT } },
    async (request) => {
      const SAME_RESPONSE = ok({ success: true, message: "If we found an order for that email, a fresh link is on its way." });
      try {
        const db = requireDatabase(app.db);
        const body = request.body ?? {};
        if (isHoneypotTripped(body)) {
          return SAME_RESPONSE;
        }
        const email = normalizeGuestEmail(body.email);
        const result = await findExistingGuestOrRealUser(db, { email });
        if (!result) {
          // Nothing on file yet for this email — never create a guest row from a resend
          // request, and never reveal whether anything exists either way.
          return SAME_RESPONSE;
        }
        if (result.attachedToExistingAccount) {
          // This email belongs to a real account — never issue a passwordless magic link into
          // a real account's order history. Same outward response either way; only the
          // (non-guest-checkout) sign-in flow can grant access to a real account.
          return SAME_RESPONSE;
        }
        const summary = await getGuestOrderSummary(db, result.user.id);
        if (summary.items.length === 0) {
          return SAME_RESPONSE;
        }
        const { orderPageUrl } = await issueAndSendOrderAccess(db, { userId: result.user.id, email, isResend: true });
        logger.info("guest_resend_links_sent", { userId: result.user.id, orderPageUrl });
      } catch (error) {
        logger.error("guest_resend_links_failed", { error: error instanceof Error ? error.message : String(error) });
      }
      return SAME_RESPONSE;
    },
  );

  // ---- Generic order-access issuance, used right after a guest checkout starts so the
  // frontend can show "we emailed you a link" even before Stripe redirects back. ----
  app.post<{ Body: { email?: string } }>(
    "/guest/order-access/issue",
    { config: { rateLimit: GUEST_RATE_LIMIT } },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const email = normalizeGuestEmail(request.body?.email);
      const result = await resolveOrCreateGuestUser(db, { email });
      if (result.attachedToExistingAccount) {
        // Never reveal that a real account exists — tell them to check email + sign in.
        return ok({ success: true, hasAccount: true });
      }
      await issueAndSendOrderAccess(db, { userId: result.user.id, email });
      return ok({ success: true, hasAccount: false });
    },
  );
}
