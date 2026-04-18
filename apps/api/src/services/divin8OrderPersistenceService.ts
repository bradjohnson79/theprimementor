import { clients, reports, reportTierOutputs, type Database } from "@wisdom/db";
import { desc, eq } from "drizzle-orm";
import { getReportTierDefinition, type ReportTierId } from "@wisdom/utils";
import type { AdminOrder } from "./ordersService.js";
import type { Divin8ExecutionResult } from "./divin8EngineService.js";
import { persistableInterpretationPayload } from "./reportFormat.js";
import { buildReportStructuredData } from "./reportStructuredData.js";

export type OrderExecutionState = "idle" | "generating" | "awaiting_input" | "completed" | "failed";

type ReportRow = typeof reports.$inferSelect;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function reportMetaValue(report: ReportRow | null | undefined): Record<string, unknown> {
  return isRecord(report?.meta) ? report.meta : {};
}

function getExecutionVersion(report: ReportRow | null | undefined, force: boolean) {
  const meta = reportMetaValue(report);
  const current = typeof meta.output_version === "number" ? meta.output_version : 0;
  if (force && current > 0) {
    return current + 1;
  }
  return current > 0 ? current : 1;
}

function buildPurchaseIntake(order: AdminOrder) {
  return {
    fullName: order.client_name || null,
    email: order.email || null,
    birthDate: order.metadata.intake.birth_date ?? order.metadata.birth_date ?? null,
    birthTime: order.metadata.intake.birth_time ?? order.metadata.birth_time ?? null,
    birthplace: {
      name: order.metadata.intake.location ?? order.metadata.birth_location ?? null,
    },
    primaryFocus: order.metadata.intake.submitted_questions[0] ?? null,
    questions: order.metadata.intake.submitted_questions,
    notes: order.metadata.intake.notes ?? null,
    sessionType: order.metadata.session_type ?? null,
    reportType: order.metadata.report_type_id ?? order.metadata.report_type ?? null,
  };
}

async function getLatestClientIdForUser(db: Database, userId: string) {
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.user_id, userId))
    .orderBy(desc(clients.created_at))
    .limit(1);
  return client?.id ?? null;
}

export async function getOrderExecutionReport(db: Database, order: AdminOrder): Promise<ReportRow | null> {
  if (order.type === "report") {
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, order.source_id))
      .limit(1);
    return report ?? null;
  }

  if (order.type !== "session") {
    return null;
  }

  const rows = await db
    .select()
    .from(reports)
    .where(eq(reports.user_id, order.user_id))
    .orderBy(desc(reports.created_at));

  return rows.find((row) => {
    const meta = reportMetaValue(row);
    return meta.orderId === order.id || meta.orderSourceId === order.source_id;
  }) ?? null;
}

export async function ensureOrderExecutionReport(
  db: Database,
  order: AdminOrder,
  tier: ReportTierId,
): Promise<ReportRow> {
  const existing = await getOrderExecutionReport(db, order);
  if (existing) {
    return existing;
  }

  if (order.type !== "session") {
    const error = new Error("Order execution report was not found.") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  const clientId = await getLatestClientIdForUser(db, order.user_id);
  const [created] = await db
    .insert(reports)
    .values({
      client_id: clientId,
      user_id: order.user_id,
      status: "idle",
        member_status: "paid",
      purchase_intake: buildPurchaseIntake(order),
      birth_place_name: order.metadata.birth_location ?? order.metadata.intake.location ?? null,
      interpretation_tier: tier,
      systems_used: [],
      meta: {
        orderId: order.id,
        orderSourceId: order.source_id,
        orderSourceType: order.type,
        execution_state: "idle",
      },
    })
    .returning();

  return created;
}

async function upsertTierOutput(
  db: Database,
  reportId: string,
  tier: ReportTierId,
  values: Partial<typeof reportTierOutputs.$inferInsert>,
) {
  const tierDefinition = getReportTierDefinition(tier);
  const [row] = await db
    .insert(reportTierOutputs)
    .values({
      report_id: reportId,
      tier,
      systems_config: tierDefinition.systems,
      model_name: tierDefinition.model,
      reasoning_effort: tierDefinition.reasoning,
      ...values,
    })
    .onConflictDoUpdate({
      target: [reportTierOutputs.report_id, reportTierOutputs.tier],
      set: {
        systems_config: tierDefinition.systems,
        model_name: tierDefinition.model,
        reasoning_effort: tierDefinition.reasoning,
        ...values,
      },
    })
    .returning();
  return row;
}

export async function markOrderExecutionState(
  db: Database,
  order: AdminOrder,
  tier: ReportTierId,
  state: OrderExecutionState,
  options?: {
    errorMessage?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    durationMs?: number | null;
    lastAttemptAt?: string | null;
  },
): Promise<ReportRow> {
  const report = await ensureOrderExecutionReport(db, order, tier);
  const meta = reportMetaValue(report);
  const nextMeta = {
    ...meta,
    orderId: order.id,
    orderSourceId: order.source_id,
    orderSourceType: order.type,
    execution_state: state,
    last_generation_error: options?.errorMessage ?? (state === "completed" ? null : meta.last_generation_error ?? null),
    last_generation_attempt_at: options?.lastAttemptAt ?? new Date().toISOString(),
    generation_started_at: options?.startedAt ?? (state === "generating" ? new Date().toISOString() : meta.generation_started_at ?? null),
    generation_completed_at: options?.completedAt ?? (state === "completed" ? new Date().toISOString() : meta.generation_completed_at ?? null),
    duration_ms: options?.durationMs ?? meta.duration_ms ?? null,
  };

  const [updated] = await db
    .update(reports)
    .set({
      status: state,
      meta: nextMeta,
      updated_at: new Date(),
    })
    .where(eq(reports.id, report.id))
    .returning();

  await upsertTierOutput(db, report.id, tier, {
    status: state,
    error_message: options?.errorMessage ?? null,
  });

  return updated;
}

export async function persistOrderExecutionResult(
  db: Database,
  order: AdminOrder,
  execution: Divin8ExecutionResult,
  options?: { force?: boolean },
): Promise<ReportRow> {
  const report = await ensureOrderExecutionReport(db, order, execution.tier);
  const meta = reportMetaValue(report);
  const version = getExecutionVersion(report, Boolean(options?.force));
  const completedAt = execution.output.generated_at;
  const structuredData = buildReportStructuredData({
    blueprint: execution.blueprint,
    reportDate: completedAt,
    purchaseIntake: report.purchase_intake ?? buildPurchaseIntake(order),
    birthPlaceName:
      order.metadata.birth_location
      ?? order.metadata.intake.location
      ?? report.birth_place_name
      ?? execution.blueprint.core.birthData.birthLocation,
    birthTimezone: report.birth_timezone,
  });
  const payload = persistableInterpretationPayload(
    execution.interpretation,
    execution.tier,
    order.client_name || "Client",
    structuredData,
  );
  const startedAt = typeof meta.generation_started_at === "string"
    ? meta.generation_started_at
    : new Date(new Date(completedAt).getTime()).toISOString();

  const nextMeta = {
    ...meta,
    orderId: order.id,
    orderSourceId: order.source_id,
    orderSourceType: order.type,
    execution_state: "completed",
    last_generation_error: null,
    last_generation_attempt_at: completedAt,
    generation_started_at: startedAt,
    generation_completed_at: completedAt,
    duration_ms: Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime()),
    output_version: version,
    generated_at: completedAt,
    generated_output: execution.output,
    generated_from_mode: execution.input.mode,
    questions: execution.input.questions ?? [],
    notes: execution.input.notes ?? null,
  };

  const [updated] = await db
    .update(reports)
    .set({
      status: "completed",
      member_status: order.type === "report" ? "fulfilled" : report.member_status,
      purchase_intake: report.purchase_intake ?? buildPurchaseIntake(order),
      birth_place_name: order.metadata.birth_location ?? order.metadata.intake.location ?? report.birth_place_name,
      birth_timezone: report.birth_timezone,
      blueprint_data: execution.blueprint,
      generated_report: payload.generated_report,
      full_markdown: payload.full_markdown,
      interpretation_tier: execution.tier,
      display_title: payload.display_title,
      systems_used: execution.includeSystems,
      meta: nextMeta,
      updated_at: new Date(),
    })
    .where(eq(reports.id, report.id))
    .returning();

  await upsertTierOutput(db, report.id, execution.tier, {
    status: "completed",
    generated_report: payload.generated_report,
    full_markdown: payload.full_markdown,
    display_title: payload.display_title,
    error_message: null,
  });

  return updated;
}
