import { and, desc, eq, or } from "drizzle-orm";
import { guestClaimAudit, payments, users, type Database } from "@wisdom/db";
import { logger } from "@wisdom/utils";
import { createHttpError } from "../booking/errors.js";
import {
  completeDeferredBookingIntake,
  getDeferredBookingIntakeContext,
  isGuestCheckoutIntake,
  type CompleteDeferredBookingIntakeFields,
} from "../booking/bookingService.js";
import {
  completeDeferredReportIntake,
  getDeferredReportIntakeContext,
  type CreateMemberReportInput,
} from "../reportPurchaseService.js";
import { issueOrderAccessToken, verifyOrderAccessToken } from "./orderAccessTokenService.js";
import type { GuestOrderEmailLinks } from "../notifications/events.js";
export type { GuestOrderEmailLinks };

/**
 * Guest pay-first intake links.
 *
 * A guest pays with only email (+ optional name); right after payment they land on a public
 * thank-you page with a link to the matching intake form, and the post-payment email repeats it.
 * Each link is an "order_intake" token in guest_order_access_tokens: 32 random bytes, only the
 * HMAC is stored, bound to exactly ONE booking or report through metadata, expires in 60 days,
 * and stops accepting submissions once that order's intake is in (the UPDATE is conditional).
 */

export type GuestIntakeKind = "services" | "reports";
export type GuestIntakeEntityType = "session" | "report";

const INVALID_LINK_MESSAGE = "This link has expired or is no longer valid.";

function getFrontendUrl(): string {
  return (process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:3000").trim().replace(/\/$/, "");
}

export function intakeKindForEntity(entityType: GuestIntakeEntityType): GuestIntakeKind {
  return entityType === "report" ? "reports" : "services";
}

export function buildGuestIntakeFormUrl(token: string, kind: GuestIntakeKind): string {
  return `${getFrontendUrl()}/intake/${kind}/${encodeURIComponent(token)}`;
}

/** Stripe success_url for guest pay-first orders. {CHECKOUT_SESSION_ID} is filled in by Stripe. */
export function buildGuestThankYouUrl(input: { token: string; kind: GuestIntakeKind; product?: string | null }): string {
  const params = new URLSearchParams({ kind: input.kind });
  if (input.product) params.set("product", input.product);
  params.set("intake", input.token);
  return `${getFrontendUrl()}/order/thank-you?${params.toString()}&checkoutSessionId={CHECKOUT_SESSION_ID}`;
}

export async function issueGuestIntakeToken(
  db: Database,
  input: { userId: string; email: string; entityType: GuestIntakeEntityType; entityId: string },
) {
  return issueOrderAccessToken(db, {
    userId: input.userId,
    email: input.email,
    purpose: "order_intake",
    metadata: { entityType: input.entityType, entityId: input.entityId },
  });
}

/** The entity still belongs to the token's user, or was moved to an account via a verified merge. */
async function ownsEntity(db: Database, tokenUserId: string, entityUserId: string): Promise<boolean> {
  if (tokenUserId === entityUserId) return true;
  const [merged] = await db
    .select({ id: guestClaimAudit.id })
    .from(guestClaimAudit)
    .where(and(eq(guestClaimAudit.guest_user_id, tokenUserId), eq(guestClaimAudit.target_user_id, entityUserId)))
    .limit(1);
  return Boolean(merged);
}

type ResolvedIntake =
  | { entityType: "session"; booking: NonNullable<Awaited<ReturnType<typeof getDeferredBookingIntakeContext>>> }
  | { entityType: "report"; report: NonNullable<Awaited<ReturnType<typeof getDeferredReportIntakeContext>>> };

async function resolveIntakeToken(db: Database, rawToken: string): Promise<ResolvedIntake> {
  const verified = await verifyOrderAccessToken(db, rawToken, "order_intake");
  const entityType = verified.metadata?.entityType;
  const entityId = typeof verified.metadata?.entityId === "string" ? verified.metadata.entityId : null;
  if (!entityId || (entityType !== "session" && entityType !== "report")) {
    throw createHttpError(404, INVALID_LINK_MESSAGE);
  }
  if (entityType === "session") {
    const booking = await getDeferredBookingIntakeContext(db, entityId);
    if (!booking || !(await ownsEntity(db, verified.userId, booking.userId))) {
      throw createHttpError(404, INVALID_LINK_MESSAGE);
    }
    return { entityType, booking };
  }
  const report = await getDeferredReportIntakeContext(db, entityId);
  if (!report || !(await ownsEntity(db, verified.userId, report.userId))) {
    throw createHttpError(404, INVALID_LINK_MESSAGE);
  }
  return { entityType, report };
}

async function isEntityPaid(db: Database, resolved: ResolvedIntake): Promise<boolean> {
  if (resolved.entityType === "report") {
    if (resolved.report.memberStatus === "paid" || resolved.report.memberStatus === "fulfilled") return true;
    const [payment] = await db
      .select({ status: payments.status })
      .from(payments)
      .where(and(eq(payments.entity_type, "report"), eq(payments.entity_id, resolved.report.id)))
      .orderBy(desc(payments.created_at))
      .limit(1);
    return payment?.status === "paid";
  }
  if (["paid", "scheduled", "completed"].includes(resolved.booking.status)) return true;
  const [payment] = await db
    .select({ status: payments.status })
    .from(payments)
    .where(or(
      eq(payments.booking_id, resolved.booking.id),
      and(eq(payments.entity_type, "session"), eq(payments.entity_id, resolved.booking.id)),
    ))
    .orderBy(desc(payments.created_at))
    .limit(1);
  return payment?.status === "paid";
}

export interface GuestIntakeView {
  kind: GuestIntakeKind;
  productLabel: string;
  paymentStatus: "paid" | "processing";
  intakeStatus: "pending" | "submitted";
  email: string | null;
  fullName: string | null;
  session?: {
    bookingTypeId: string;
    sessionType: string;
    durationMinutes: number;
    requiresAvailability: boolean;
    requiresPhone: boolean;
  };
  report?: {
    reportType: string;
  };
}

/** Minimal, order-scoped context for the public form. No account data beyond the order email. */
export async function getGuestIntakeView(db: Database, rawToken: string): Promise<GuestIntakeView> {
  const resolved = await resolveIntakeToken(db, rawToken);
  const paid = await isEntityPaid(db, resolved);
  if (resolved.entityType === "session") {
    const b = resolved.booking;
    return {
      kind: "services",
      productLabel: b.bookingTypeName,
      paymentStatus: paid ? "paid" : "processing",
      intakeStatus: b.intakePending ? "pending" : "submitted",
      email: b.email,
      fullName: b.fullName,
      session: {
        bookingTypeId: b.bookingTypeId,
        sessionType: b.sessionType,
        durationMinutes: b.durationMinutes,
        requiresAvailability: b.requiresAvailability,
        requiresPhone: b.requiresPhone,
      },
    };
  }
  const r = resolved.report;
  return {
    kind: "reports",
    productLabel: r.displayTitle,
    paymentStatus: paid ? "paid" : "processing",
    intakeStatus: r.intakePending ? "pending" : "submitted",
    email: r.email,
    fullName: r.fullName,
    report: { reportType: r.reportType },
  };
}

/** For the photo upload: which user the image row belongs to (claimed on submit). */
export async function resolveGuestIntakeUploadOwner(db: Database, rawToken: string): Promise<string> {
  const resolved = await resolveIntakeToken(db, rawToken);
  if (resolved.entityType !== "session") {
    throw createHttpError(400, "Photos are collected on the Services Intake Form.");
  }
  if (!resolved.booking.intakePending) {
    throw createHttpError(409, "Your intake form has already been received. Contact us if anything needs to change.");
  }
  return resolved.booking.userId;
}

export async function submitGuestIntake(
  db: Database,
  rawToken: string,
  body: Record<string, unknown>,
  options: {
    onReportReady?: (reportId: string) => void;
  } = {},
): Promise<{ kind: GuestIntakeKind; productLabel: string; intakeStatus: "submitted" }> {
  const resolved = await resolveIntakeToken(db, rawToken);
  const expectedKind = intakeKindForEntity(resolved.entityType);
  if (body.kind !== undefined && body.kind !== expectedKind) {
    throw createHttpError(
      400,
      expectedKind === "reports"
        ? "This link is for the Divin8 Reports Intake Form."
        : "This link is for the Services Intake Form.",
    );
  }

  if (resolved.entityType === "session") {
    const fields = pickBookingFields(body);
    await completeDeferredBookingIntake(db, { bookingId: resolved.booking.id, fields });
    logger.info("guest_intake_submitted", { kind: "services", bookingId: resolved.booking.id });
    return { kind: "services", productLabel: resolved.booking.bookingTypeName, intakeStatus: "submitted" };
  }

  const fields = pickReportFields(body);
  const result = await completeDeferredReportIntake(db, { reportId: resolved.report.id, fields });
  logger.info("guest_intake_submitted", { kind: "reports", reportId: result.id, paid: result.paid });
  if (result.paid) {
    options.onReportReady?.(result.id);
  }
  return { kind: "reports", productLabel: resolved.report.displayTitle, intakeStatus: "submitted" };
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function pickBookingFields(body: Record<string, unknown>): CompleteDeferredBookingIntakeFields {
  const timezoneSource = body.timezoneSource === "suggested" || body.timezoneSource === "fallback" ? body.timezoneSource : "user";
  return {
    availability: body.availability,
    timezone: str(body.timezone),
    fullName: str(body.fullName),
    phone: str(body.phone),
    gender: str(body.gender),
    birthDate: str(body.birthDate),
    birthTime: str(body.birthTime),
    birthPlace: str(body.birthPlace),
    birthPlaceName: str(body.birthPlaceName),
    birthLat: num(body.birthLat),
    birthLng: num(body.birthLng),
    birthTimezone: str(body.birthTimezone),
    timezoneSource,
    consentGiven: body.consentGiven === true,
    intake: body.intake,
    notes: str(body.notes),
  };
}

const REPORT_FIELD_KEYS = [
  "fullName", "phone", "birthDate", "birthTime", "birthPlaceName", "birthLat", "birthLng", "birthTimezone",
  "timezoneSource", "primaryFocus", "consentGiven", "notes", "currentLocation", "question1", "question2", "question3",
  "personA", "personB", "relationshipType", "relationshipQuestion", "relationshipStatus", "desiredFocus",
  "currentLifeFocus", "areasOfInterest",
] as const;

function pickReportFields(body: Record<string, unknown>): Omit<CreateMemberReportInput, "userId" | "reportType" | "tier" | "email"> {
  const out: Record<string, unknown> = {};
  for (const key of REPORT_FIELD_KEYS) {
    if (key in body) out[key] = body[key];
  }
  return out as Omit<CreateMemberReportInput, "userId" | "reportType" | "tier" | "email">;
}

// --------------------------------------------------------------------------------------------
// Email links. Called from sendNotification for post-payment emails; the links are only used to
// render the email and are never written into notification_events.payload.
// --------------------------------------------------------------------------------------------

async function resolveGuestEntityFromPayload(
  db: Database,
  event: string,
  payload: Record<string, unknown>,
): Promise<{ entityType: GuestIntakeEntityType; entityId: string } | null> {
  if (event === "booking.created") {
    if (payload.purchaseConfirmed !== true) return null;
    return typeof payload.bookingId === "string" ? { entityType: "session", entityId: payload.bookingId } : null;
  }
  if (event === "payment.succeeded") {
    const paymentId = typeof payload.paymentId === "string" ? payload.paymentId : null;
    if (!paymentId) return null;
    const [payment] = await db
      .select({ bookingId: payments.booking_id, entityType: payments.entity_type, entityId: payments.entity_id })
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);
    if (!payment) return null;
    if (payment.entityType === "report" && payment.entityId) return { entityType: "report", entityId: payment.entityId };
    if (payment.bookingId) return { entityType: "session", entityId: payment.bookingId };
    if (payment.entityType === "session" && payment.entityId) return { entityType: "session", entityId: payment.entityId };
    return null;
  }
  return null;
}

export async function buildGuestOrderEmailLinks(
  db: Database,
  input: { event: string; payload: Record<string, unknown>; userId?: string | null },
): Promise<GuestOrderEmailLinks | null> {
  if (input.event !== "payment.succeeded" && input.event !== "booking.created") return null;
  if (!process.env.GUEST_ORDER_TOKEN_SECRET?.trim()) return null;

  const entity = await resolveGuestEntityFromPayload(db, input.event, input.payload);
  if (!entity) return null;

  let ownerId: string;
  let productLabel: string;
  let pending: boolean;
  if (entity.entityType === "session") {
    const booking = await getDeferredBookingIntakeContext(db, entity.entityId);
    if (!booking || !booking.guestCheckout) return null;
    ownerId = booking.userId;
    productLabel = booking.bookingTypeName;
    pending = booking.intakePending;
  } else {
    const report = await getDeferredReportIntakeContext(db, entity.entityId);
    if (!report || !report.guestCheckout) return null;
    ownerId = report.userId;
    productLabel = report.displayTitle;
    pending = report.intakePending;
  }

  const [owner] = await db
    .select({ id: users.id, email: users.email, isGuest: users.is_guest })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);
  if (!owner) return null;

  const kind = intakeKindForEntity(entity.entityType);
  let intakeUrl: string | null = null;
  if (pending) {
    const { token } = await issueGuestIntakeToken(db, {
      userId: owner.id,
      email: owner.email,
      entityType: entity.entityType,
      entityId: entity.entityId,
    });
    intakeUrl = buildGuestIntakeFormUrl(token, kind);
  }

  let orderPageUrl: string | null = null;
  let dashboardUrl: string | null = null;
  if (owner.isGuest) {
    const { token } = await issueOrderAccessToken(db, { userId: owner.id, email: owner.email, purpose: "order_page" });
    orderPageUrl = `${getFrontendUrl()}/order/${encodeURIComponent(token)}`;
  } else {
    dashboardUrl = `${getFrontendUrl()}/${entity.entityType === "report" ? "reports" : "dashboard"}`;
  }

  return { intakeUrl, intakeKind: pending ? kind : null, productLabel, orderPageUrl, dashboardUrl };
}

export { isGuestCheckoutIntake };
