import { and, eq } from "drizzle-orm";
import { courseEntitlements, type Database } from "@wisdom/db";
import { createHttpError } from "../booking/errors.js";

export const RESONANT_DOWSING_COURSE_SLUG = "resonant-dowsing";

export interface CourseEntitlementSummary {
  id: string;
  userId: string;
  courseSlug: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  orderId: string | null;
  purchasedAt: Date | null;
  revokedAt: Date | null;
}

function serializeCourseEntitlement(row: {
  id: string;
  user_id: string;
  course_slug: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  order_id: string | null;
  purchased_at: Date | null;
  revoked_at: Date | null;
}): CourseEntitlementSummary {
  return {
    id: row.id,
    userId: row.user_id,
    courseSlug: row.course_slug,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    orderId: row.order_id,
    purchasedAt: row.purchased_at,
    revokedAt: row.revoked_at,
  };
}

export async function getCourseEntitlement(
  db: Database,
  input: { userId: string; courseSlug: string },
) {
  const [row] = await db
    .select()
    .from(courseEntitlements)
    .where(and(
      eq(courseEntitlements.user_id, input.userId),
      eq(courseEntitlements.course_slug, input.courseSlug),
    ))
    .limit(1);

  return row ? serializeCourseEntitlement(row) : null;
}

export async function hasCourseEntitlement(
  db: Database,
  input: { userId: string; courseSlug: string },
) {
  const entitlement = await getCourseEntitlement(db, input);
  return Boolean(entitlement?.purchasedAt && !entitlement.revokedAt);
}

export function canAccessCourseContent(input: {
  role?: string | null;
  entitlement?: Pick<CourseEntitlementSummary, "purchasedAt" | "revokedAt"> | null;
}) {
  if (input.role === "admin") {
    return true;
  }
  return Boolean(input.entitlement?.purchasedAt && !input.entitlement.revokedAt);
}

export async function prepareCourseEntitlementForCheckout(
  db: Database,
  input: { userId: string; courseSlug: string },
): Promise<
  | { kind: "already_paid"; entitlement: CourseEntitlementSummary }
  | { kind: "pending_payment"; entitlement: CourseEntitlementSummary }
> {
  const existing = await getCourseEntitlement(db, input);
  if (existing?.purchasedAt && !existing.revokedAt) {
    return { kind: "already_paid", entitlement: existing };
  }
  if (existing) {
    return { kind: "pending_payment", entitlement: existing };
  }

  const [created] = await db
    .insert(courseEntitlements)
    .values({
      user_id: input.userId,
      course_slug: input.courseSlug,
    })
    .onConflictDoUpdate({
      target: [courseEntitlements.user_id, courseEntitlements.course_slug],
      set: {
        updated_at: new Date(),
      },
    })
    .returning();

  if (!created) {
    throw createHttpError(500, "Course entitlement could not be prepared.");
  }

  return { kind: "pending_payment", entitlement: serializeCourseEntitlement(created) };
}

export async function markCourseEntitlementPurchased(
  db: Database,
  input: {
    entitlementId: string;
    userId: string;
    courseSlug: string;
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    purchasedAt?: Date;
  },
) {
  const purchasedAt = input.purchasedAt ?? new Date();
  const [updated] = await db
    .update(courseEntitlements)
    .set({
      stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
      stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
      purchased_at: purchasedAt,
      revoked_at: null,
      updated_at: purchasedAt,
    })
    .where(and(
      eq(courseEntitlements.id, input.entitlementId),
      eq(courseEntitlements.user_id, input.userId),
      eq(courseEntitlements.course_slug, input.courseSlug),
    ))
    .returning();

  if (!updated) {
    const [createdOrUpdated] = await db
      .insert(courseEntitlements)
      .values({
        id: input.entitlementId,
        user_id: input.userId,
        course_slug: input.courseSlug,
        stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
        stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
        purchased_at: purchasedAt,
        revoked_at: null,
      })
      .onConflictDoUpdate({
        target: [courseEntitlements.user_id, courseEntitlements.course_slug],
        set: {
          stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
          stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
          purchased_at: purchasedAt,
          revoked_at: null,
          updated_at: purchasedAt,
        },
      })
      .returning();

    if (!createdOrUpdated) {
      throw createHttpError(500, "Course entitlement could not be fulfilled.");
    }
    return serializeCourseEntitlement(createdOrUpdated);
  }

  return serializeCourseEntitlement(updated);
}
