import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireClerkId, requireDatabase, requireDbUser } from "../routeAssertions.js";
import {
  RESONANT_DOWSING_CHECKOUT_UNAVAILABLE_MESSAGE,
  diagnoseResonantDowsingStripePrice,
  isResonantDowsingStripePriceConfigError,
} from "../config/courseBilling.js";
import { createHttpError } from "../services/booking/errors.js";
import {
  prepareCourseEntitlementForCheckout,
  RESONANT_DOWSING_COURSE_SLUG,
} from "../services/courses/courseEntitlementService.js";
import {
  getResonantDowsingAccessState,
  getResonantDowsingLessonDetail,
  getResonantDowsingProgressOutline,
  markResonantDowsingLessonComplete,
} from "../services/courses/courseProgressService.js";
import { createCheckoutSession } from "../services/paymentService.js";

export async function coursesRoutes(app: FastifyInstance) {
  app.get("/courses/resonant-dowsing", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    return ok(await getResonantDowsingAccessState(db, {
      userId: user.id,
      role: user.role,
    }));
  });

  app.get("/courses/resonant-dowsing/content", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    return ok(await getResonantDowsingProgressOutline(db, {
      userId: user.id,
      role: user.role,
    }));
  });

  app.get<{ Params: { lessonId: string } }>("/courses/resonant-dowsing/lessons/:lessonId", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    return ok(await getResonantDowsingLessonDetail(db, {
      userId: user.id,
      role: user.role,
      lessonId: request.params.lessonId,
    }));
  });

  app.post<{ Params: { lessonId: string } }>("/courses/resonant-dowsing/lessons/:lessonId/complete", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    return ok(await markResonantDowsingLessonComplete(db, {
      userId: user.id,
      role: user.role,
      lessonId: request.params.lessonId,
    }));
  });

  app.get("/admin/courses/resonant-dowsing/content", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    const user = requireAdmin(request);
    return ok(await getResonantDowsingProgressOutline(db, {
      userId: user.id,
      role: user.role,
    }));
  });

  app.get("/admin/courses/resonant-dowsing/price-diagnostics", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    const apiKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!apiKey) {
      throw createHttpError(503, "STRIPE_SECRET_KEY is not configured.");
    }
    const stripe = new Stripe(apiKey);
    return ok(await diagnoseResonantDowsingStripePrice(stripe));
  });

  app.post("/courses/resonant-dowsing/checkout", { preHandler: requireAuth }, async (request, reply) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    const clerkId = requireClerkId(request);
    const prepared = await prepareCourseEntitlementForCheckout(db, {
      userId: user.id,
      courseSlug: RESONANT_DOWSING_COURSE_SLUG,
    });

    if (prepared.kind === "already_paid") {
      return ok({
        alreadyPaid: true,
        requiresPayment: false,
        courseSlug: RESONANT_DOWSING_COURSE_SLUG,
        courseEntitlementId: prepared.entitlement.id,
        url: null,
      });
    }

    let session: Awaited<ReturnType<typeof createCheckoutSession>>;
    try {
      session = await createCheckoutSession(db, {
        type: "course",
        userId: user.id,
        userEmail: user.email,
        clerkId,
        courseEntitlementId: prepared.entitlement.id,
      });
    } catch (error) {
      if (isResonantDowsingStripePriceConfigError(error)) {
        app.log.error({
          checkoutType: "course",
          courseSlug: RESONANT_DOWSING_COURSE_SLUG,
          courseEntitlementId: prepared.entitlement.id,
          diagnostics: error.diagnostics,
        }, "resonant_dowsing_checkout_unavailable");
        return sendApiError(reply, 503, RESONANT_DOWSING_CHECKOUT_UNAVAILABLE_MESSAGE);
      }
      throw error;
    }

    return ok({
      alreadyPaid: false,
      requiresPayment: true,
      courseSlug: RESONANT_DOWSING_COURSE_SLUG,
      courseEntitlementId: prepared.entitlement.id,
      sessionId: session.id,
      url: session.url,
    });
  });
}
