import { and, desc, eq, ne, sql } from "drizzle-orm";
import { reports, reportTierOutputs, users, type Database } from "@wisdom/db";
import {
  DIVIN8_REPORT_PRICE_CENTS_BY_TIER,
  REPORT_PRODUCTS,
  formatZodIssues,
  getSystemsForReportType,
  isPremiumReportProduct,
  parseReportIntake,
  resolveReportProductKey,
  type AnnualReportIntake,
  type CompatibilityReportIntake,
  type PremiumReportIntake,
  type ReportProductKey,
} from "@wisdom/utils";
import { createHttpError } from "./booking/errors.js";
import { assertValidTimeZone } from "./booking/timezoneService.js";
import { resolveFullMarkdown } from "./reportFormat.js";
import { normalizeStructuredBirthplace } from "./intake/placeSelection.js";
import {
  createPaymentRecordForEntity,
  getReusablePaymentForEntity,
} from "./payments/paymentsService.js";

export interface MemberReportSummary {
  id: string;
  interpretation_tier: ReportProductKey;
  member_status: "pending_payment" | "paid" | "fulfilled";
  status: string;
  display_title: string;
  created_at: string;
  updated_at: string | null;
  viewable: boolean;
}

export interface MemberReportsList {
  pending: MemberReportSummary[];
  completed: MemberReportSummary[];
  counts: {
    total: number;
    pending: number;
    completed: number;
  };
}

export interface MemberReportDetail extends MemberReportSummary {
  full_markdown: string;
}

export interface CreateMemberReportInput {
  userId: string;
  tier?: unknown;
  reportType?: unknown;
  fullName?: unknown;
  email?: unknown;
  phone?: unknown;
  birthDate?: unknown;
  birthTime?: unknown;
  birthPlaceName?: unknown;
  birthLat?: unknown;
  birthLng?: unknown;
  birthTimezone?: unknown;
  timezoneSource?: unknown;
  primaryFocus?: unknown;
  consentGiven?: unknown;
  notes?: unknown;
  currentLocation?: unknown;
  question1?: unknown;
  question2?: unknown;
  question3?: unknown;
  personA?: unknown;
  personB?: unknown;
  relationshipType?: unknown;
  relationshipQuestion?: unknown;
  relationshipStatus?: unknown;
  desiredFocus?: unknown;
  currentLifeFocus?: unknown;
  areasOfInterest?: unknown;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value: unknown): string | null {
  const email = normalizeText(value)?.toLowerCase() ?? null;
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createHttpError(400, "A valid email address is required");
  }
  return email;
}

function normalizeReportType(input: CreateMemberReportInput): ReportProductKey {
  const reportType =
    resolveReportProductKey(input.reportType) ?? resolveReportProductKey(input.tier);
  if (!reportType) {
    throw createHttpError(
      400,
      "reportType must be one of: three_questions, compatibility, annual_12_month, intro, deep_dive, initiate",
    );
  }
  return reportType;
}

function getDisplayTitle(
  reportType: ReportProductKey,
  rawTitle: string | null | undefined,
): string {
  return rawTitle?.trim() || REPORT_PRODUCTS[reportType].displayName;
}

function getReportAmountCents(reportType: ReportProductKey) {
  const product = REPORT_PRODUCTS[reportType];
  return isPremiumReportProduct(product) ? DIVIN8_REPORT_PRICE_CENTS_BY_TIER[product.tier] : 0;
}

function buildRawIntake(input: CreateMemberReportInput) {
  return {
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    birthDate: input.birthDate,
    birthTime: input.birthTime,
    birthPlaceName: input.birthPlaceName,
    birthLat: input.birthLat,
    birthLng: input.birthLng,
    birthTimezone: input.birthTimezone,
    timezoneSource: input.timezoneSource,
    primaryFocus: input.primaryFocus,
    consentGiven: input.consentGiven,
    notes: input.notes,
    currentLocation: input.currentLocation,
    question1: input.question1,
    question2: input.question2,
    question3: input.question3,
    personA: input.personA,
    personB: input.personB,
    relationshipType: input.relationshipType,
    relationshipQuestion: input.relationshipQuestion,
    relationshipStatus: input.relationshipStatus,
    desiredFocus: input.desiredFocus,
    currentLifeFocus: input.currentLifeFocus,
    areasOfInterest: input.areasOfInterest,
  };
}

function parseIntakeOrThrow(reportType: ReportProductKey, input: CreateMemberReportInput) {
  try {
    return parseReportIntake(reportType, buildRawIntake(input));
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
    ) {
      throw createHttpError(400, formatZodIssues(error as Parameters<typeof formatZodIssues>[0]));
    }
    throw error;
  }
}

function getPrimaryBirthplace(
  reportType: ReportProductKey,
  intake: ReturnType<typeof parseIntakeOrThrow>,
) {
  function normalizeOrFallback(input: {
    birthPlaceName?: unknown;
    birthLat?: unknown;
    birthLng?: unknown;
    birthTimezone?: unknown;
  }) {
    try {
      return normalizeStructuredBirthplace(input);
    } catch (error) {
      const name = normalizeText(input.birthPlaceName);
      if (!name) {
        throw error;
      }
      return {
        name,
        lat: null,
        lng: null,
        timezone: normalizeText(input.birthTimezone),
      };
    }
  }

  if (reportType === "compatibility") {
    const compatibility = intake as CompatibilityReportIntake;
    return normalizeOrFallback({
      birthPlaceName: compatibility.personA.birthPlaceName,
      birthLat: compatibility.personA.birthLat,
      birthLng: compatibility.personA.birthLng,
      birthTimezone: compatibility.personA.birthTimezone,
    });
  }

  const single = intake as PremiumReportIntake | AnnualReportIntake;
  return normalizeOrFallback({
    birthPlaceName: single.birthPlaceName,
    birthLat: single.birthLat,
    birthLng: single.birthLng,
    birthTimezone: single.birthTimezone,
  });
}

export async function createMemberReportOrder(
  db: Database,
  input: CreateMemberReportInput,
): Promise<MemberReportSummary> {
  const reportType = normalizeReportType(input);
  const product = REPORT_PRODUCTS[reportType];
  const parsedIntake = parseIntakeOrThrow(reportType, input);
  const email = normalizeEmail((parsedIntake as { email?: unknown }).email);
  const timezoneSource =
    (parsedIntake as { timezoneSource?: unknown }).timezoneSource === "suggested" ||
    (parsedIntake as { timezoneSource?: unknown }).timezoneSource === "fallback"
      ? (parsedIntake as { timezoneSource: "suggested" | "fallback" }).timezoneSource
      : "user";
  const birthplace = getPrimaryBirthplace(reportType, parsedIntake);

  const [dbUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!dbUser) {
    throw createHttpError(404, "User not found");
  }

  if (!email) throw createHttpError(400, "email is required");
  if (birthplace.timezone) {
    assertValidTimeZone(birthplace.timezone);
  }
  if (email !== dbUser.email.toLowerCase()) {
    throw createHttpError(400, "email must match the authenticated account");
  }

  const title = getDisplayTitle(reportType, null);
  const purchaseIntake = {
    ...parsedIntake,
    email,
    timezoneSource,
    reportType,
    productId: product.id,
  };

  const [reusable] = await db
    .select({
      id: reports.id,
      interpretation_tier: reports.interpretation_tier,
      member_status: reports.member_status,
      status: reports.status,
      display_title: reports.display_title,
      created_at: reports.created_at,
      updated_at: reports.updated_at,
    })
    .from(reports)
    .where(
      and(
        eq(reports.user_id, input.userId),
        eq(reports.interpretation_tier, reportType),
        eq(reports.member_status, "pending_payment"),
        eq(reports.archived, false),
      ),
    )
    .orderBy(desc(reports.created_at))
    .limit(1);

  const amountCents = getReportAmountCents(reportType);
  const currency = "CAD";

  if (reusable) {
    await db
      .update(reports)
      .set({
        purchase_intake: purchaseIntake,
        birth_place_name: birthplace.name,
        birth_lat: birthplace.lat,
        birth_lng: birthplace.lng,
        birth_timezone: birthplace.timezone,
        meta: {
          createdFrom: "member_purchase",
          timezone_source: timezoneSource,
          report_type: reportType,
          product_id: product.id,
          product_category: product.type,
        },
        updated_at: new Date(),
      })
      .where(eq(reports.id, reusable.id));

    await db
      .update(reports)
      .set({
        archived: true,
        archived_at: new Date(),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(reports.user_id, input.userId),
          eq(reports.interpretation_tier, reportType),
          eq(reports.member_status, "pending_payment"),
          eq(reports.archived, false),
          ne(reports.id, reusable.id),
        ),
      );

    const existingPayment = await getReusablePaymentForEntity(db, {
      entityType: "report",
      entityId: reusable.id,
    });
    if (!existingPayment) {
      await createPaymentRecordForEntity(db, {
        userId: input.userId,
        entityType: "report",
        entityId: reusable.id,
        amountCents,
        currency,
        status: "pending",
        metadata: {
          source: "report_reuse",
          reportId: reusable.id,
          reportType,
          tier: isPremiumReportProduct(product) ? product.tier : reportType,
        },
      });
    }

    return {
      id: reusable.id,
      interpretation_tier: resolveReportProductKey(reusable.interpretation_tier) ?? "intro",
      member_status: reusable.member_status,
      status: reusable.status,
      display_title: getDisplayTitle(
        resolveReportProductKey(reusable.interpretation_tier) ?? "intro",
        reusable.display_title,
      ),
      created_at: reusable.created_at.toISOString(),
      updated_at: reusable.updated_at?.toISOString() ?? null,
      viewable: false,
    };
  }

  const created = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(reports)
      .values({
        user_id: input.userId,
        status: "draft",
        member_status: "pending_payment",
        interpretation_tier: reportType,
        display_title: title,
        systems_used: getSystemsForReportType(reportType),
        purchase_intake: purchaseIntake,
        birth_place_name: birthplace.name,
        birth_lat: birthplace.lat,
        birth_lng: birthplace.lng,
        birth_timezone: birthplace.timezone,
        meta: {
          createdFrom: "member_purchase",
          timezone_source: timezoneSource,
          report_type: reportType,
          product_id: product.id,
          product_category: product.type,
        },
      })
      .returning({
        id: reports.id,
        interpretation_tier: reports.interpretation_tier,
        member_status: reports.member_status,
        status: reports.status,
        display_title: reports.display_title,
        created_at: reports.created_at,
        updated_at: reports.updated_at,
      });

    await createPaymentRecordForEntity(tx, {
      userId: input.userId,
      entityType: "report",
      entityId: inserted.id,
      amountCents,
      currency,
      status: "pending",
      metadata: {
        source: "report_create",
        reportId: inserted.id,
        reportType,
        tier: isPremiumReportProduct(product) ? product.tier : reportType,
      },
    });

    return inserted;
  });

  return {
    id: created.id,
    interpretation_tier: resolveReportProductKey(created.interpretation_tier) ?? "intro",
    member_status: created.member_status,
    status: created.status,
    display_title: getDisplayTitle(
      resolveReportProductKey(created.interpretation_tier) ?? "intro",
      created.display_title,
    ),
    created_at: created.created_at.toISOString(),
    updated_at: created.updated_at?.toISOString() ?? null,
    viewable: false,
  };
}

export async function listMemberReports(db: Database, userId: string): Promise<MemberReportsList> {
  const rows = await db
    .select({
      id: reports.id,
      interpretation_tier: reports.interpretation_tier,
      member_status: reports.member_status,
      status: reports.status,
      display_title: reports.display_title,
      created_at: reports.created_at,
      updated_at: reports.updated_at,
    })
    .from(reports)
    .where(and(eq(reports.user_id, userId), eq(reports.archived, false)))
    .orderBy(desc(reports.created_at));

  const summaries = rows.map((row) => {
    const reportType = resolveReportProductKey(row.interpretation_tier) ?? "intro";
    const memberStatus = row.member_status === "fulfilled" ? "fulfilled" : row.member_status;
    return {
      id: row.id,
      interpretation_tier: reportType,
      member_status: memberStatus,
      status: row.status,
      display_title: getDisplayTitle(reportType, row.display_title),
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at?.toISOString() ?? null,
      viewable: memberStatus === "fulfilled",
    } satisfies MemberReportSummary;
  });

  return {
    pending: summaries.filter((row) => row.member_status !== "fulfilled"),
    completed: summaries.filter((row) => row.member_status === "fulfilled"),
    counts: {
      total: summaries.length,
      pending: summaries.filter((row) => row.member_status !== "fulfilled").length,
      completed: summaries.filter((row) => row.member_status === "fulfilled").length,
    },
  };
}

export async function getMemberReportDetail(
  db: Database,
  userId: string,
  reportId: string,
): Promise<MemberReportDetail> {
  const [report] = await db
    .select({
      id: reports.id,
      user_id: reports.user_id,
      interpretation_tier: reports.interpretation_tier,
      member_status: reports.member_status,
      status: reports.status,
      display_title: reports.display_title,
      full_markdown: reports.full_markdown,
      generated_report: reports.generated_report,
      created_at: reports.created_at,
      updated_at: reports.updated_at,
    })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!report || report.user_id !== userId) {
    throw createHttpError(404, "Report not found");
  }
  if (report.member_status !== "fulfilled") {
    throw createHttpError(403, "Report is not ready yet");
  }

  const tierRows = await db
    .select({
      tier: reportTierOutputs.tier,
      full_markdown: reportTierOutputs.full_markdown,
      generated_report: reportTierOutputs.generated_report,
      updated_at: reportTierOutputs.updated_at,
      created_at: reportTierOutputs.created_at,
    })
    .from(reportTierOutputs)
    .where(eq(reportTierOutputs.report_id, report.id))
    .orderBy(desc(reportTierOutputs.updated_at), desc(reportTierOutputs.created_at));

  const requestedReportType = resolveReportProductKey(report.interpretation_tier) ?? "intro";
  const activeTierOutput =
    tierRows.find((row) => row.tier === requestedReportType) ?? tierRows[0] ?? null;
  const markdown = resolveFullMarkdown(
    activeTierOutput?.full_markdown ?? report.full_markdown,
    activeTierOutput?.generated_report ?? report.generated_report,
  ).trim();

  if (!markdown) {
    throw createHttpError(404, "Completed report content is not available yet");
  }

  return {
    id: report.id,
    interpretation_tier: requestedReportType,
    member_status: "fulfilled",
    status: report.status,
    display_title: getDisplayTitle(requestedReportType, report.display_title),
    created_at: report.created_at.toISOString(),
    updated_at: report.updated_at?.toISOString() ?? null,
    viewable: true,
    full_markdown: markdown,
  };
}

// ---------------------------------------------------------------------------------------------
// Guest pay-first checkout: deferred report intake.
// The guest pays with only an email; the birth/intake details arrive afterwards through a
// per-order token link. Generation (Divin8 dispatcher) is skipped while intakePending is true.
// ---------------------------------------------------------------------------------------------

export const GUEST_REPORT_INTAKE_SOURCE = "guest_checkout";

export function isDeferredReportIntake(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (value as Record<string, unknown>).intakePending === true;
}

export async function createDeferredIntakeReportOrder(
  db: Database,
  input: { userId: string; reportType?: unknown; tier?: unknown; fullName?: string | null },
): Promise<MemberReportSummary> {
  const reportType = normalizeReportType({ userId: input.userId, reportType: input.reportType, tier: input.tier } as CreateMemberReportInput);
  const product = REPORT_PRODUCTS[reportType];
  const [dbUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!dbUser) {
    throw createHttpError(404, "User not found");
  }
  const email = dbUser.email.toLowerCase();
  const fullName = typeof input.fullName === "string" && input.fullName.trim() ? input.fullName.trim().slice(0, 200) : null;
  const purchaseIntake = {
    email,
    ...(fullName ? { fullName } : {}),
    reportType,
    productId: product.id,
    intakePending: true,
    intakeSource: GUEST_REPORT_INTAKE_SOURCE,
  };
  const meta = {
    createdFrom: "guest_purchase",
    report_type: reportType,
    product_id: product.id,
    product_category: product.type,
  };
  const amountCents = getReportAmountCents(reportType);
  const currency = "CAD";
  const paymentMetadata = {
    source: "guest_report_create",
    reportType,
    tier: isPremiumReportProduct(product) ? product.tier : reportType,
  };

  // Only reuse an unpaid *guest placeholder* of the same tier — never a signed-in draft.
  const [reusable] = await db
    .select({
      id: reports.id,
      interpretation_tier: reports.interpretation_tier,
      member_status: reports.member_status,
      status: reports.status,
      display_title: reports.display_title,
      created_at: reports.created_at,
      updated_at: reports.updated_at,
    })
    .from(reports)
    .where(and(
      eq(reports.user_id, input.userId),
      eq(reports.interpretation_tier, reportType),
      eq(reports.member_status, "pending_payment"),
      eq(reports.archived, false),
      sql`(${reports.purchase_intake} ->> 'intakePending') = 'true'`,
    ))
    .orderBy(desc(reports.created_at))
    .limit(1);

  const row = reusable ?? await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(reports)
      .values({
        user_id: input.userId,
        status: "draft",
        member_status: "pending_payment",
        interpretation_tier: reportType,
        display_title: getDisplayTitle(reportType, null),
        systems_used: getSystemsForReportType(reportType),
        purchase_intake: purchaseIntake,
        meta,
      })
      .returning({
        id: reports.id,
        interpretation_tier: reports.interpretation_tier,
        member_status: reports.member_status,
        status: reports.status,
        display_title: reports.display_title,
        created_at: reports.created_at,
        updated_at: reports.updated_at,
      });
    await createPaymentRecordForEntity(tx, {
      userId: input.userId,
      entityType: "report",
      entityId: inserted.id,
      amountCents,
      currency,
      status: "pending",
      metadata: { ...paymentMetadata, reportId: inserted.id },
    });
    return inserted;
  });

  if (reusable) {
    const existingPayment = await getReusablePaymentForEntity(db, { entityType: "report", entityId: reusable.id });
    if (!existingPayment) {
      await createPaymentRecordForEntity(db, {
        userId: input.userId,
        entityType: "report",
        entityId: reusable.id,
        amountCents,
        currency,
        status: "pending",
        metadata: { ...paymentMetadata, source: "guest_report_reuse", reportId: reusable.id },
      });
    }
  }

  const key = resolveReportProductKey(row.interpretation_tier) ?? "intro";
  return {
    id: row.id,
    interpretation_tier: key,
    member_status: row.member_status,
    status: row.status,
    display_title: getDisplayTitle(key, row.display_title),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at?.toISOString() ?? null,
    viewable: false,
  };
}

export interface DeferredReportIntakeContext {
  id: string;
  userId: string;
  reportType: ReportProductKey;
  displayTitle: string;
  memberStatus: string;
  email: string | null;
  fullName: string | null;
  intakePending: boolean;
  guestCheckout: boolean;
}

export async function getDeferredReportIntakeContext(
  db: Database,
  reportId: string,
): Promise<DeferredReportIntakeContext | null> {
  const [row] = await db
    .select({
      id: reports.id,
      userId: reports.user_id,
      tier: reports.interpretation_tier,
      title: reports.display_title,
      memberStatus: reports.member_status,
      purchaseIntake: reports.purchase_intake,
      archived: reports.archived,
    })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);
  if (!row || row.archived || !row.userId) return null;
  const reportType = resolveReportProductKey(row.tier) ?? "intro";
  const intake = row.purchaseIntake && typeof row.purchaseIntake === "object" && !Array.isArray(row.purchaseIntake)
    ? row.purchaseIntake as Record<string, unknown>
    : {};
  return {
    id: row.id,
    userId: row.userId,
    reportType,
    displayTitle: getDisplayTitle(reportType, row.title),
    memberStatus: row.memberStatus ?? "pending_payment",
    email: typeof intake.email === "string" ? intake.email : null,
    fullName: typeof intake.fullName === "string" ? intake.fullName : null,
    intakePending: isDeferredReportIntake(row.purchaseIntake),
    guestCheckout: intake.intakeSource === GUEST_REPORT_INTAKE_SOURCE,
  };
}

/**
 * Fills a guest pay-first report with its intake, using the same report intake schema as the
 * signed-in ReportOrder form. Single use (conditional UPDATE on intakePending). Returns whether
 * the report is already paid so the caller can kick off generation.
 */
export async function completeDeferredReportIntake(
  db: Database,
  input: { reportId: string; fields: Omit<CreateMemberReportInput, "userId" | "reportType" | "tier" | "email"> },
): Promise<{ id: string; reportType: ReportProductKey; paid: boolean }> {
  const context = await getDeferredReportIntakeContext(db, input.reportId);
  if (!context) {
    throw createHttpError(404, "This link has expired or is no longer valid.");
  }
  if (!context.intakePending) {
    throw createHttpError(409, "Your intake form has already been received. Contact us if anything needs to change.");
  }
  const reportType = context.reportType;
  const product = REPORT_PRODUCTS[reportType];
  const [dbUser] = await db.select({ email: users.email }).from(users).where(eq(users.id, context.userId)).limit(1);
  const lockedEmail = (context.email ?? dbUser?.email ?? "").toLowerCase();
  const parsedIntake = parseIntakeOrThrow(reportType, {
    ...input.fields,
    userId: context.userId,
    reportType,
    email: lockedEmail,
  } as CreateMemberReportInput);
  const timezoneSource =
    (parsedIntake as { timezoneSource?: unknown }).timezoneSource === "suggested" ||
    (parsedIntake as { timezoneSource?: unknown }).timezoneSource === "fallback"
      ? (parsedIntake as { timezoneSource: "suggested" | "fallback" }).timezoneSource
      : "user";
  const birthplace = getPrimaryBirthplace(reportType, parsedIntake);
  if (birthplace.timezone) {
    assertValidTimeZone(birthplace.timezone);
  }
  const purchaseIntake = {
    ...parsedIntake,
    email: lockedEmail,
    timezoneSource,
    reportType,
    productId: product.id,
    intakeSource: GUEST_REPORT_INTAKE_SOURCE,
    intakeSubmittedAt: new Date().toISOString(),
  };

  const updated = await db
    .update(reports)
    .set({
      purchase_intake: purchaseIntake,
      birth_place_name: birthplace.name,
      birth_lat: birthplace.lat,
      birth_lng: birthplace.lng,
      birth_timezone: birthplace.timezone,
      meta: {
        createdFrom: "guest_purchase",
        timezone_source: timezoneSource,
        report_type: reportType,
        product_id: product.id,
        product_category: product.type,
      },
      updated_at: new Date(),
    })
    .where(and(
      eq(reports.id, context.id),
      sql`(${reports.purchase_intake} ->> 'intakePending') = 'true'`,
    ))
    .returning({ id: reports.id, memberStatus: reports.member_status });
  if (updated.length === 0) {
    throw createHttpError(409, "Your intake form has already been received. Contact us if anything needs to change.");
  }
  const memberStatus = updated[0]?.memberStatus ?? context.memberStatus;
  return { id: context.id, reportType, paid: memberStatus === "paid" || memberStatus === "fulfilled" };
}
