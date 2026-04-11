import { and, desc, eq, sql } from "drizzle-orm";
import { reports, reportTierOutputs, users, type Database } from "@wisdom/db";
import {
  DIVIN8_REPORT_PRICE_CENTS_BY_TIER,
  getReportTierDefinition,
  isReportTierId,
  type ReportTierId,
} from "@wisdom/utils";
import { createHttpError } from "./booking/errors.js";
import { assertValidTimeZone } from "./booking/timezoneService.js";
import { resolveFullMarkdown } from "./reportFormat.js";
import { normalizeStructuredBirthplace } from "./intake/placeSelection.js";
import { createPaymentRecordForEntity, getReusablePaymentForEntity } from "./payments/paymentsService.js";

export interface MemberReportSummary {
  id: string;
  interpretation_tier: ReportTierId;
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

interface CreateMemberReportInput {
  userId: string;
  tier: unknown;
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

function normalizeBirthDate(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw createHttpError(400, "birthDate must use YYYY-MM-DD");
  }
  return normalized;
}

function normalizeBirthTime(value: unknown): string {
  const normalized = normalizeText(value);
  if (!normalized) return "00:00";
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(normalized)) {
    throw createHttpError(400, "birthTime must use HH:MM");
  }
  return normalized.slice(0, 5);
}

function normalizeTier(value: unknown): ReportTierId {
  if (!isReportTierId(value)) {
    throw createHttpError(400, "tier must be one of: intro, deep_dive, initiate");
  }
  return value;
}

function getDisplayTitle(
  tier: ReportTierId,
  rawTitle: string | null | undefined,
): string {
  return rawTitle?.trim() || `Divin8 ${getReportTierDefinition(tier).label} Report`;
}

export async function createMemberReportOrder(
  db: Database,
  input: CreateMemberReportInput,
): Promise<MemberReportSummary> {
  const tier = normalizeTier(input.tier);
  const fullName = normalizeText(input.fullName);
  const email = normalizeEmail(input.email);
  const phone = normalizeText(input.phone);
  const birthDate = normalizeBirthDate(input.birthDate);
  const birthTime = normalizeBirthTime(input.birthTime);
  const primaryFocus = normalizeText(input.primaryFocus);
  const consentGiven = input.consentGiven === true;
  const notes = normalizeText(input.notes);
  const timezoneSource = input.timezoneSource === "suggested" || input.timezoneSource === "fallback"
    ? input.timezoneSource
    : "user";
  const birthplace = normalizeStructuredBirthplace({
    birthPlaceName: input.birthPlaceName,
    birthLat: input.birthLat,
    birthLng: input.birthLng,
    birthTimezone: input.birthTimezone,
  });

  const [dbUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!dbUser) {
    throw createHttpError(404, "User not found");
  }

  if (!fullName) throw createHttpError(400, "fullName is required");
  if (!email) throw createHttpError(400, "email is required");
  if (!phone) throw createHttpError(400, "phone is required");
  if (!birthDate) throw createHttpError(400, "birthDate is required");
  if (!input.birthTimezone || typeof input.birthTimezone !== "string" || !input.birthTimezone.trim()) {
    throw createHttpError(400, "birthTimezone is required");
  }
  assertValidTimeZone(input.birthTimezone.trim());
  if (!consentGiven) throw createHttpError(400, "consentGiven must be true");
  if (email !== dbUser.email.toLowerCase()) {
    throw createHttpError(400, "email must match the authenticated account");
  }

  const title = getDisplayTitle(tier, null);
  const purchaseIntake = {
    fullName,
    email,
    phone,
    birthDate,
    birthTime,
    primaryFocus,
    consentGiven,
    notes,
    birthplace,
    timezoneSource,
  };
  const purchaseSnapshotJson = JSON.stringify(purchaseIntake);

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
      eq(reports.interpretation_tier, tier),
      eq(reports.member_status, "pending_payment"),
      sql`${reports.purchase_intake} = ${purchaseSnapshotJson}::jsonb`,
    ))
    .orderBy(desc(reports.created_at))
    .limit(1);

  const amountCents = DIVIN8_REPORT_PRICE_CENTS_BY_TIER[tier];
  const currency = "CAD";

  if (reusable) {
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
          tier,
        },
      });
    }

    return {
      id: reusable.id,
      interpretation_tier: reusable.interpretation_tier as ReportTierId,
      member_status: reusable.member_status,
      status: reusable.status,
      display_title: getDisplayTitle(reusable.interpretation_tier as ReportTierId, reusable.display_title),
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
        interpretation_tier: tier,
        display_title: title,
        systems_used: getReportTierDefinition(tier).includeSystems,
        purchase_intake: purchaseIntake,
        birth_place_name: birthplace.name,
        birth_lat: birthplace.lat,
        birth_lng: birthplace.lng,
        birth_timezone: birthplace.timezone,
        meta: {
          createdFrom: "member_purchase",
          timezone_source: timezoneSource,
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
        tier,
      },
    });

    return inserted;
  });

  return {
    id: created.id,
    interpretation_tier: created.interpretation_tier as ReportTierId,
    member_status: created.member_status,
    status: created.status,
    display_title: getDisplayTitle(created.interpretation_tier as ReportTierId, created.display_title),
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
    .where(eq(reports.user_id, userId))
    .orderBy(desc(reports.created_at));

  const summaries = rows.map((row) => {
    const tier = isReportTierId(row.interpretation_tier) ? row.interpretation_tier : "intro";
    const memberStatus = row.member_status === "fulfilled" ? "fulfilled" : row.member_status;
    return {
      id: row.id,
      interpretation_tier: tier,
      member_status: memberStatus,
      status: row.status,
      display_title: getDisplayTitle(tier, row.display_title),
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

  const requestedTier = isReportTierId(report.interpretation_tier) ? report.interpretation_tier : "intro";
  const activeTierOutput = tierRows.find((row) => row.tier === requestedTier) ?? tierRows[0] ?? null;
  const markdown = resolveFullMarkdown(
    activeTierOutput?.full_markdown ?? report.full_markdown,
    activeTierOutput?.generated_report ?? report.generated_report,
  ).trim();

  if (!markdown) {
    throw createHttpError(404, "Completed report content is not available yet");
  }

  return {
    id: report.id,
    interpretation_tier: requestedTier,
    member_status: "fulfilled",
    status: report.status,
    display_title: getDisplayTitle(requestedTier, report.display_title),
    created_at: report.created_at.toISOString(),
    updated_at: report.updated_at?.toISOString() ?? null,
    viewable: true,
    full_markdown: markdown,
  };
}
