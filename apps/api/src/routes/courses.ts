import type { FastifyInstance } from "fastify";
import { ok } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireClerkId, requireDatabase, requireDbUser } from "../routeAssertions.js";
import {
  hasCourseEntitlement,
  prepareCourseEntitlementForCheckout,
  RESONANT_DOWSING_COURSE_SLUG,
} from "../services/courses/courseEntitlementService.js";
import {
  getResonantDowsingCourseContent,
  getResonantDowsingPublicCourse,
} from "../services/courses/resonantDowsingCourse.js";
import { createHttpError } from "../services/booking/errors.js";
import { createCheckoutSession } from "../services/paymentService.js";

export async function coursesRoutes(app: FastifyInstance) {
  app.get("/courses/resonant-dowsing", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    const isAdmin = user.role === "admin";
    const hasAccess = isAdmin || await hasCourseEntitlement(db, {
      userId: user.id,
      courseSlug: RESONANT_DOWSING_COURSE_SLUG,
    });

    return ok({
      course: {
        ...getResonantDowsingPublicCourse(),
        ...(hasAccess ? { moduleCount: getResonantDowsingCourseContent().moduleCount } : {}),
      },
      hasAccess,
      accessSource: isAdmin ? "admin" : hasAccess ? "entitlement" : "locked",
    });
  });

  app.get("/courses/resonant-dowsing/content", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    const isAdmin = user.role === "admin";
    const hasAccess = isAdmin || await hasCourseEntitlement(db, {
      userId: user.id,
      courseSlug: RESONANT_DOWSING_COURSE_SLUG,
    });
    if (!hasAccess) {
      throw createHttpError(403, "The Resonant Dowsing Course requires purchase before viewing the curriculum.");
    }

    return ok({
      course: getResonantDowsingCourseContent(),
      accessSource: isAdmin ? "admin" : "entitlement",
    });
  });

  app.get("/admin/courses/resonant-dowsing/content", { preHandler: requireAuth }, async (request) => {
    requireDatabase(app.db);
    requireAdmin(request);
    return ok({
      course: getResonantDowsingCourseContent(),
      accessSource: "admin",
    });
  });

  app.post("/courses/resonant-dowsing/checkout", { preHandler: requireAuth }, async (request) => {
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

    const session = await createCheckoutSession(db, {
      type: "course",
      userId: user.id,
      userEmail: user.email,
      clerkId,
      courseEntitlementId: prepared.entitlement.id,
    });

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
