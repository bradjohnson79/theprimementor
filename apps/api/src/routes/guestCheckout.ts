import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, desc, eq, gt } from "drizzle-orm";
import { bookings, bookingTypes, type Database } from "@wisdom/db";
import { logger } from "@wisdom/utils";
import { ok, sendApiError } from "../apiContract.js";
import { requireDatabase } from "../routeAssertions.js";
import { createHttpError } from "../services/booking/errors.js";
import { createBooking, createDeferredIntakeBooking } from "../services/booking/bookingService.js";
import { createDeferredIntakeReportOrder, createMemberReportOrder } from "../services/reportPurchaseService.js";
import {
  buildGuestIntakeFormUrl,
  buildGuestThankYouUrl,
  issueGuestIntakeToken,
  type GuestIntakeEntityType,
} from "../services/guest/guestIntakeService.js";
import { registerGuestIntakeRoutes } from "./guestIntake.js";
import { prepareShopEntitlementForCheckout } from "../services/shop/shopEntitlementService.js";
import { createCheckoutSession } from "../services/paymentService.js";
import { createRegenerationCheckoutSession } from "../services/regenerationSubscriptionService.js";
import { resolveOrCreateGuestUser, normalizeGuestEmail, findExistingGuestOrRealUser } from "../services/guest/guestIdentity.js";
import { assertGuestSchemaReady } from "../services/guest/guestSchemaGuard.js";
import { issueOrderAccessToken } from "../services/guest/orderAccessTokenService.js";
import { getGuestOrderSummary, summarizeForEmail } from "../services/guest/guestOrderSummaryService.js";
import { sendGuestOrderAccessEmail, sendGuestResendLinksEmail } from "../services/guest/guestNotify.js";
import {
  GUEST_LINK_GENERIC_MESSAGE,
  decideGuestLinkThrottle,
  getRecentGuestLinkIssues,
  handleGuestLinkRequest,
} from "../services/guest/guestLinkRequestService.js";

const GUEST_RATE_LIMIT = { max: 10, timeWindow: "1 minute" } as const;
/** Per-IP limit for link-request endpoints (resend-links, order-access/issue). Per-address limits live in guestLinkRequestService. */
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

async function issueAndSendOrderAccess(db: Database, input: { userId: string; email: string; isResend?: boolean; intakeLink?: { url: string; kind: "services" | "reports" } }) {
  // Per-address throttle (cooldown + hourly cap) so checkout or link endpoints can't be used to
  // flood someone's inbox. A skipped email is harmless: every order-page link shows ALL of the
  // guest's orders, so the most recent email's link already covers this order too.
  const decision = decideGuestLinkThrottle(await getRecentGuestLinkIssues(db, input.email));
  if (!decision.allowed) {
    logger.info("guest_order_access_email_throttled", { userId: input.userId, reason: decision.reason });
    return { sent: false as const };
  }
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
    intakeLink: input.intakeLink,
  });
  return { sent: true as const };
}

/** Same-site path the guest came from (for Stripe's cancel_url). Anything else falls back to the default. */
function sanitizeReturnPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.length > 160) return null;
  if (!/^\/[A-Za-z0-9\-_/]*$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Guest pay-first: mint the per-order intake token and point Stripe's success_url at the public
 * thank-you page (instead of a signed-in page the guest can't open). The raw token only ever
 * lives in that redirect URL and in the post-payment email.
 */
async function buildGuestIntakeRedirects(
  db: Database,
  input: {
    userId: string;
    email: string;
    entityType: GuestIntakeEntityType;
    entityId: string;
    product: string | null;
    returnPath: unknown;
  },
) {
  const { token } = await issueGuestIntakeToken(db, {
    userId: input.userId,
    email: input.email,
    entityType: input.entityType,
    entityId: input.entityId,
  });
  const returnPath = sanitizeReturnPath(input.returnPath);
  return {
    successUrlOverride: buildGuestThankYouUrl({
      token,
      kind: input.entityType === "report" ? "reports" : "services",
      product: input.product,
    }),
    cancelUrlOverride: returnPath ? `${getFrontendUrl()}${returnPath}?checkout=canceled` : undefined,
    intakeLink: {
      url: buildGuestIntakeFormUrl(token, input.entityType === "report" ? "reports" : "services"),
      kind: input.entityType === "report" ? ("reports" as const) : ("services" as const),
    },
  };
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
      // New pay-first flow: only email/name now, the intake comes after payment via the
      // thank-you page / email link. Its placeholder reuse is handled inside
      // createDeferredIntakeBooking (guest placeholders only — never an account's own draft).
      const deferIntake = body.deferIntake === true;
      if (deferIntake && !bookingTypeId) {
        return sendApiError(reply, 400, "bookingTypeId is required");
      }
      const existing = bookingTypeId && !deferIntake
        ? await findRecentReusableBooking(db, { userId: guest.user.id, bookingTypeId })
        : null;
      if (deferIntake) {
        booking = await createDeferredIntakeBooking(db, {
          userId: guest.user.id,
          bookingTypeId: bookingTypeId as string,
          fullName: typeof body.fullName === "string" ? body.fullName : null,
          timezone: body.timezone,
        });
      } else if (existing) {
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

      const { intakeLink, ...redirects } = await buildGuestIntakeRedirects(db, {
        userId: guest.user.id,
        email: guest.user.email,
        entityType: "session",
        entityId: booking.id,
        product: bookingTypeId ?? sessionType ?? null,
        returnPath: body.returnPath,
      });
      const session = await createCheckoutSession(db, {
        type: "session",
        bookingId: booking.id,
        userId: guest.user.id,
        userEmail: guest.user.email,
        clerkId: guest.user.clerk_id,
        promoCode: typeof body.promoCode === "string" ? body.promoCode : undefined,
        ...redirects,
      });

      if (!guest.attachedToExistingAccount) {
        await issueAndSendOrderAccess(db, { userId: guest.user.id, email: guest.user.email, intakeLink: deferIntake ? intakeLink : undefined });
      }

      return ok({
        success: true,
        requiresPayment: true,
        bookingId: booking.id,
        sessionId: session.id,
        url: session.url,
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

      const report = body.deferIntake === true
        ? await createDeferredIntakeReportOrder(db, {
          userId: guest.user.id,
          tier: body.tier,
          reportType: body.reportType,
          fullName: typeof body.fullName === "string" ? body.fullName : null,
        })
        : await createMemberReportOrder(db, {
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

      const { intakeLink, ...redirects } = await buildGuestIntakeRedirects(db, {
        userId: guest.user.id,
        email: guest.user.email,
        entityType: "report",
        entityId: report.id,
        product: report.interpretation_tier,
        returnPath: body.returnPath,
      });
      const session = await createCheckoutSession(db, {
        type: "report",
        reportId: report.id,
        userId: guest.user.id,
        userEmail: guest.user.email,
        clerkId: guest.user.clerk_id,
        promoCode: typeof body.promoCode === "string" ? body.promoCode : undefined,
        ...redirects,
      });

      if (!guest.attachedToExistingAccount) {
        await issueAndSendOrderAccess(db, { userId: guest.user.id, email: guest.user.email, intakeLink: body.deferIntake === true ? intakeLink : undefined });
      }

      return ok({
        success: true,
        requiresPayment: true,
        reportId: report.id,
        sessionId: session.id,
        url: session.url,
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

      if (!guest.attachedToExistingAccount) {
        await issueAndSendOrderAccess(db, { userId: guest.user.id, email: guest.user.email });
      }

      return ok({
        alreadyPaid: false,
        requiresPayment: true,
        productId,
        shopEntitlementId: prepared.entitlement.id,
        sessionId: session.id,
        url: session.url,
      });
    },
  );

  // ---- Manifestation Monthly (Regeneration) subscription ----
  app.post<{ Body: { email?: string; fullName?: string; website?: string; timezone?: string; returnPath?: string } }>(
    "/guest/regeneration-subscription/checkout",
    { config: { rateLimit: GUEST_RATE_LIMIT } },
    async (request) => {
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

      // Pay-first: a placeholder regeneration booking carries the intake (intention, feeling,
      // assumptions, birth details, availability) which the guest fills in after payment.
      const booking = await createDeferredIntakeBooking(db, {
        userId: guest.user.id,
        bookingTypeId: "regeneration-session",
        fullName: typeof body.fullName === "string" ? body.fullName : null,
        timezone: typeof body.timezone === "string" ? body.timezone : null,
        deferPaymentRecord: true,
      });
      const { intakeLink, ...redirects } = await buildGuestIntakeRedirects(db, {
        userId: guest.user.id,
        email: guest.user.email,
        entityType: "session",
        entityId: booking.id,
        product: "regeneration-session",
        returnPath: body.returnPath,
      });
      const session = await createRegenerationCheckoutSession(db, {
        userId: guest.user.id,
        clerkId: guest.user.clerk_id,
        bookingId: booking.id,
        ...redirects,
      });

      if (!guest.attachedToExistingAccount) {
        await issueAndSendOrderAccess(db, { userId: guest.user.id, email: guest.user.email, intakeLink: intakeLink });
      }

      return ok({
        success: true,
        requiresPayment: true,
        sessionId: session.sessionId,
        url: session.url,
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

      if (!guest.attachedToExistingAccount) {
        await issueAndSendOrderAccess(db, { userId: guest.user.id, email: guest.user.email });
      }

      return ok({
        success: true,
        requiresPayment: true,
        sessionId: session.id,
        url: session.url,
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
      if (!guest.attachedToExistingAccount) {
        await issueAndSendOrderAccess(db, { userId: guest.user.id, email: guest.user.email });
      }
      return ok({
        success: true,
        requiresPayment: true,
        sessionId: session.id,
        url: session.url,
      });
    },
  );

  // ---- Link requests: "resend my links" and the legacy order-access/issue endpoint ----
  // Both behave identically: the same response for every outcome (unknown email, real account,
  // no orders, throttled, honeypot, error), never create a guest row, never mint a link into a
  // real account, and respect per-IP (route rate limit) + per-address (cooldown/hourly cap) limits.
  async function respondToGuestLinkRequest(body: Record<string, unknown>, source: "resend" | "issue") {
    const db = requireDatabase(app.db);
    const outcome = await handleGuestLinkRequest({
      normalizeEmail: normalizeGuestEmail,
      findUser: async (email) => {
        const found = await findExistingGuestOrRealUser(db, { email });
        return found ? { userId: found.user.id, isRealAccount: found.attachedToExistingAccount } : null;
      },
      hasOrders: async (userId) => (await getGuestOrderSummary(db, userId)).items.length > 0,
      recentIssues: (email) => getRecentGuestLinkIssues(db, email),
      send: async (userId, email) => {
        await issueAndSendOrderAccess(db, { userId, email, isResend: true });
      },
    }, { email: body.email, honeypotTripped: isHoneypotTripped(body) });
    logger.info("guest_link_request", { source, outcome });
    return ok({ success: true, message: GUEST_LINK_GENERIC_MESSAGE });
  }

  app.post<{ Body: { email?: string; website?: string } }>(
    "/guest/resend-links",
    { config: { rateLimit: GUEST_RESEND_RATE_LIMIT } },
    async (request) => respondToGuestLinkRequest((request.body ?? {}) as Record<string, unknown>, "resend"),
  );

  // Kept for backwards compatibility (no frontend caller). Previously it created a guest row for
  // any email, emailed it a link, and returned hasAccount:true for real accounts (account
  // enumeration). It is now just an alias of resend-links.
  app.post<{ Body: { email?: string; website?: string } }>(
    "/guest/order-access/issue",
    { config: { rateLimit: GUEST_RESEND_RATE_LIMIT } },
    async (request) => respondToGuestLinkRequest((request.body ?? {}) as Record<string, unknown>, "issue"),
  );

  registerGuestIntakeRoutes(app);
}
