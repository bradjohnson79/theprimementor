import type { FastifyInstance } from "fastify";
import { and, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { clients, reports, reportTierOutputs } from "@wisdom/db";
import {
  getReportTierDefinition,
  isReportTierId,
  logger,
  slugForFilename,
  type ReportTierId,
} from "@wisdom/utils";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../routeAssertions.js";
import { interpretBlueprint } from "../services/blueprint/index.js";
import type { BlueprintData } from "../services/blueprint/types.js";
import type { InterpretationReport } from "../services/blueprint/types.js";
import {
  deletePhysiognomyImage,
} from "../services/physiognomyImageStorage.js";
import {
  parseInterpretTier,
  persistableInterpretationPayload,
  getStructuredDataFromStoredReport,
  resolveFullMarkdown,
} from "../services/reportFormat.js";
import { exportDocxFromMarkdown, exportPdfFromMarkdown } from "../services/reportExport.js";
import { generateBlueprintFromRequest } from "../services/divin8/generateService.js";
import { buildReportStructuredData } from "../services/reportStructuredData.js";

interface TierOutputSummary {
  id: string;
  tier: ReportTierId;
  status: string;
  display_title: string | null;
  full_markdown: string | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  error_message: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function reportMetaValue(report: typeof reports.$inferSelect): Record<string, unknown> {
  return isRecord(report.meta) ? report.meta : {};
}

function reportPurchaseIntakeValue(report: typeof reports.$inferSelect): Record<string, unknown> | null {
  return isRecord(report.purchase_intake) ? report.purchase_intake : null;
}

function reportSystemsUsedValue(report: typeof reports.$inferSelect): string[] {
  if (Array.isArray(report.systems_used)) {
    return report.systems_used.filter((value): value is string => typeof value === "string");
  }
  const bp = report.blueprint_data as BlueprintData | null;
  return Array.isArray(bp?.meta?.systemsIncluded) ? bp.meta.systemsIncluded : [];
}

function isoDateString(value: string | Date | null | undefined): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

function clarityGlyphCountForTier(tier: string | null | undefined): number {
  if (tier === "initiate") return 2;
  if (tier === "deep_dive") return 1;
  return 0;
}

function isLockedReportStatus(status: string | null | undefined): boolean {
  return status === "final" || status === "finalized";
}

function subjectFullName(
  report: { client_id: string | null; blueprint_data: unknown; purchase_intake?: unknown },
  clientName: string | null,
): string {
  if (clientName?.trim()) return clientName.trim();
  const intake = report.purchase_intake;
  if (isRecord(intake) && typeof intake.fullName === "string" && intake.fullName.trim()) {
    return intake.fullName.trim();
  }
  const bp = report.blueprint_data as BlueprintData | null;
  return bp?.core?.birthData?.fullBirthName?.trim() || bp?.client?.fullBirthName?.trim() || "Guest";
}

/** Keyset cursor for GET /reports — tuple (created_at DESC, id DESC); never use offset pagination. */
function decodeReportsListCursor(raw: string | undefined): { created_at: string; id: string } | null {
  if (!raw?.trim()) return null;
  try {
    const json = JSON.parse(Buffer.from(raw.trim(), "base64url").toString("utf8")) as unknown;
    if (!json || typeof json !== "object") return null;
    const o = json as Record<string, unknown>;
    if (typeof o.created_at !== "string" || typeof o.id !== "string") return null;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(o.id)) return null;
    return { created_at: o.created_at, id: o.id };
  } catch {
    return null;
  }
}

function blueprintWithoutPhysiognomyAssetId(blueprint: BlueprintData): BlueprintData {
  const b = JSON.parse(JSON.stringify(blueprint)) as BlueprintData;
  if (b.meta && "physiognomyImageAssetId" in b.meta) {
    delete b.meta.physiognomyImageAssetId;
  }
  return b;
}

function assertNoUndefinedDeep(value: unknown, path = "payload"): void {
  if (value === undefined) {
    throw new Error(`Undefined value detected at ${path}`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoUndefinedDeep(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      assertNoUndefinedDeep(nested, `${path}.${key}`);
    }
  }
}

function mapTierOutput(row: typeof reportTierOutputs.$inferSelect): TierOutputSummary {
  return {
    id: row.id,
    tier: row.tier as ReportTierId,
    status: row.status,
    display_title: row.display_title,
    full_markdown: row.full_markdown,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    error_message: row.error_message ?? null,
  };
}

async function upsertTierOutput(
  app: FastifyInstance,
  reportId: string,
  tier: ReportTierId,
  values: Partial<typeof reportTierOutputs.$inferInsert>,
) {
  const tierDefinition = getReportTierDefinition(tier);
  const [row] = await app.db
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

async function finalizeInterpretation(
  app: FastifyInstance,
  report: typeof reports.$inferSelect,
  tier: ReportTierId,
): Promise<{
  reportId: string;
  status: string;
  report: InterpretationReport;
  full_markdown: string;
  display_title: string;
  interpretation_tier: string;
  created_at: string | Date;
  updated_at: string | Date;
}> {
  const bp = report.blueprint_data as BlueprintData;

  const [clientRow] = report.client_id
    ? await app.db
        .select({ full_birth_name: clients.full_birth_name })
        .from(clients)
        .where(eq(clients.id, report.client_id))
        .limit(1)
    : [null];

  const fullName = subjectFullName(report, clientRow?.full_birth_name ?? null);

  // 1) Await full interpretation (all GPT calls) before any cleanup.
  const interpretation = await interpretBlueprint(bp, tier);
  const reportDate = new Date().toISOString();
  const structuredData = buildReportStructuredData({
    blueprint: bp,
    reportDate,
    purchaseIntake: report.purchase_intake,
    birthPlaceName: report.birth_place_name,
    birthTimezone: report.birth_timezone,
  });
  const payload = persistableInterpretationPayload(interpretation, tier, fullName, structuredData);
  assertNoUndefinedDeep(payload, "interpretationPayload");

  const physiognomyAssetId = bp.meta?.physiognomyImageAssetId;
  const blueprintClean = blueprintWithoutPhysiognomyAssetId(bp);
  assertNoUndefinedDeep(blueprintClean, "blueprintClean");

  await upsertTierOutput(app, report.id, tier, {
    status: "interpreted",
    generated_report: payload.generated_report,
    full_markdown: payload.full_markdown,
    display_title: payload.display_title,
    error_message: null,
  });

  const [updated] = await app.db
    .update(reports)
    .set({
      generated_report: payload.generated_report,
      full_markdown: payload.full_markdown,
      display_title: payload.display_title,
      interpretation_tier: payload.interpretation_tier,
      status: "interpreted",
      blueprint_data: blueprintClean,
      systems_used: bp.meta?.systemsIncluded ?? [],
      meta: {
        ...reportMetaValue(report),
        lastInterpretedAt: new Date().toISOString(),
        clarityGlyphCount: clarityGlyphCountForTier(tier),
      },
    })
    .where(eq(reports.id, report.id))
    .returning();

  // 2) After persistence succeeds, delete temp image (never parallel with interpret).
  await deletePhysiognomyImage(physiognomyAssetId);

  app.log.info({ reportId: updated.id }, "Interpretation persisted with full_markdown");

  const md = resolveFullMarkdown(updated.full_markdown, updated.generated_report);

  return {
    reportId: updated.id,
    status: updated.status,
    report: interpretation,
    full_markdown: md,
    display_title: updated.display_title ?? "",
    interpretation_tier: updated.interpretation_tier ?? "intro",
    created_at: updated.created_at ?? new Date().toISOString(),
    updated_at: updated.updated_at ?? new Date().toISOString(),
  };
}

async function updateReportStatus(
  app: FastifyInstance,
  reportId: string,
  status: string,
  tier?: ReportTierId,
  errorMessage?: string | null,
): Promise<void> {
  await app.db.update(reports).set({ status }).where(eq(reports.id, reportId));
  if (tier) {
    await upsertTierOutput(app, reportId, tier, {
      status,
      error_message: errorMessage ?? null,
    });
  }
}

function pickActiveTierOutput(
  rows: Array<typeof reportTierOutputs.$inferSelect>,
  requestedTier?: string,
): typeof reportTierOutputs.$inferSelect | null {
  if (requestedTier && isReportTierId(requestedTier)) {
    return rows.find((row) => row.tier === requestedTier) ?? null;
  }
  return rows[0] ?? null;
}

export async function blueprintRoutes(app: FastifyInstance) {
  // ── Admin report list (register before /reports/:param routes that could shadow) ──
  app.get("/reports", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
    const q = request.query as { limit?: string; cursor?: string; showArchived?: string };
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || "50", 10) || 50));
    const cursor = decodeReportsListCursor(q.cursor);
    const showArchived = q.showArchived === "true";
    if (q.cursor?.trim() && !cursor) {
      return sendApiError(reply, 400, "Invalid reports cursor");
    }

    const cursorTs = cursor ? new Date(cursor.created_at) : null;
    if (cursor && (!cursorTs || Number.isNaN(cursorTs.getTime()))) {
      return sendApiError(reply, 400, "Invalid reports cursor");
    }

    /** Keyset only — (created_at, id) strictly before cursor row in DESC order */
    const whereKeyset =
      cursor && cursorTs
        ? sql`(${reports.created_at}, ${reports.id}) < (${cursor.created_at}::timestamptz, ${cursor.id}::uuid)`
        : sql`true`;

    const rows = await app.db
      .select({
        id: reports.id,
        client_id: reports.client_id,
        archived: reports.archived,
        status: reports.status,
        member_status: reports.member_status,
        display_title: reports.display_title,
        interpretation_tier: reports.interpretation_tier,
        purchase_intake: reports.purchase_intake,
        created_at: reports.created_at,
        updated_at: reports.updated_at,
        client_name: clients.full_birth_name,
        guest_name: sql<string | null>`${reports.blueprint_data}::jsonb -> 'core' -> 'birthData' ->> 'fullBirthName'`,
      })
      .from(reports)
      .leftJoin(clients, eq(reports.client_id, clients.id))
      .where(and(whereKeyset, showArchived ? sql`true` : eq(reports.archived, false)))
      .orderBy(desc(reports.created_at), desc(reports.id))
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const nextRow = rows.length > limit ? rows[limit] : null;
    const reportIds = page.map((row) => row.id);
    const tierRows = reportIds.length
      ? await app.db
          .select({
            report_id: reportTierOutputs.report_id,
            tier: reportTierOutputs.tier,
            status: reportTierOutputs.status,
          })
          .from(reportTierOutputs)
          .where(inArray(reportTierOutputs.report_id, reportIds))
      : [];
    const tiersByReport = new Map<string, Array<{ tier: string; status: string }>>();
    for (const row of tierRows) {
      const prev = tiersByReport.get(row.report_id) ?? [];
      prev.push({ tier: row.tier, status: row.status });
      tiersByReport.set(row.report_id, prev);
    }
    const nextCursor = nextRow
      ? Buffer.from(
          JSON.stringify({
            created_at: nextRow.created_at,
            id: nextRow.id,
          }),
        ).toString("base64url")
      : null;

    return ok({
      data: page.map((r) => ({
        id: r.id,
        client_id: r.client_id,
        archived: r.archived,
        status: r.status,
        member_status: r.member_status,
        display_title: r.display_title,
        interpretation_tier: r.interpretation_tier,
        subject_name: subjectFullName({
          client_id: r.client_id,
          blueprint_data: null,
          purchase_intake: r.purchase_intake,
        }, r.client_name ?? r.guest_name ?? null),
        created_at: r.created_at,
        updated_at: r.updated_at,
        tier_outputs: tiersByReport.get(r.id) ?? [],
      })),
      nextCursor,
    });
  });

  app.get<{ Params: { id: string } }>(
    "/reports/:id/docx",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const { id } = request.params;
      const q = request.query as { tier?: string };
      const [row] = await app.db
        .select({
          ...getTableColumns(reports),
          client_name: clients.full_birth_name,
        })
        .from(reports)
        .leftJoin(clients, eq(reports.client_id, clients.id))
        .where(eq(reports.id, id))
        .limit(1);
      if (!row) return sendApiError(reply, 404, "Report not found");

      const { client_name, ...rep } = row;
      const tierRows = await app.db
        .select()
        .from(reportTierOutputs)
        .where(eq(reportTierOutputs.report_id, rep.id))
        .orderBy(desc(reportTierOutputs.updated_at), desc(reportTierOutputs.created_at));
      const activeTierOutput = pickActiveTierOutput(tierRows, q.tier);

      const md = resolveFullMarkdown(
        activeTierOutput?.full_markdown ?? rep.full_markdown,
        activeTierOutput?.generated_report ?? rep.generated_report,
      );
      if (!md.trim()) {
        return sendApiError(reply, 400, "No markdown content for this report");
      }

      const title = activeTierOutput?.display_title ?? rep.display_title ?? "Soul Blueprint Report";
      let buf: Buffer;
      try {
        buf = await exportDocxFromMarkdown(title, md);
      } catch (err) {
        app.log.warn({ err }, "docx_export_failed");
        return sendApiError(reply, 500, "Export failed. Please try again.");
      }
      const tier = (activeTierOutput?.tier ?? rep.interpretation_tier ?? "intro") as string;
      const slug = slugForFilename(subjectFullName(rep, client_name ?? null));
      const filename = `soul-blueprint-${tier}-${slug}.docx`;

      reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);
      return reply.send(buf);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/reports/:id/pdf",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const { id } = request.params;
      const q = request.query as { tier?: string };
      const [row] = await app.db
        .select({
          ...getTableColumns(reports),
          client_name: clients.full_birth_name,
        })
        .from(reports)
        .leftJoin(clients, eq(reports.client_id, clients.id))
        .where(eq(reports.id, id))
        .limit(1);
      if (!row) return sendApiError(reply, 404, "Report not found");

      const { client_name, ...rep } = row;
      const tierRows = await app.db
        .select()
        .from(reportTierOutputs)
        .where(eq(reportTierOutputs.report_id, rep.id))
        .orderBy(desc(reportTierOutputs.updated_at), desc(reportTierOutputs.created_at));
      const activeTierOutput = pickActiveTierOutput(tierRows, q.tier);

      const md = resolveFullMarkdown(
        activeTierOutput?.full_markdown ?? rep.full_markdown,
        activeTierOutput?.generated_report ?? rep.generated_report,
      );
      if (!md.trim()) {
        return sendApiError(reply, 400, "No markdown content for this report");
      }

      const title = activeTierOutput?.display_title ?? rep.display_title ?? "Soul Blueprint Report";
      let buf: Buffer;
      try {
        buf = await exportPdfFromMarkdown(title, md);
      } catch (err) {
        app.log.warn({ err }, "pdf_export_failed");
        return sendApiError(reply, 500, "Export failed. Please try again.");
      }
      const tier = (activeTierOutput?.tier ?? rep.interpretation_tier ?? "intro") as string;
      const slug = slugForFilename(subjectFullName(rep, client_name ?? null));
      const filename = `soul-blueprint-${tier}-${slug}.pdf`;

      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);
      return reply.send(buf);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/reports/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const { id } = request.params;
      const [deleted] = await app.db.delete(reports).where(eq(reports.id, id)).returning({ id: reports.id });
      if (!deleted) return sendApiError(reply, 404, "Report not found");
      return ok({ ok: true, id: deleted.id });
    },
  );

  app.post("/blueprints/generate", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
    logger.info("blueprint_generate_requested", {
      route: "/api/blueprints/generate",
      userId: request.dbUser?.id ?? null,
    });
    const result = await generateBlueprintFromRequest(app, request.body);
    return ok(result);
  });

  app.post<{ Params: { clientId: string } }>(
    "/blueprints/:clientId/interpret",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);

      const { clientId } = request.params;

      if (!clientId || clientId === "undefined" || clientId === "null") {
        return sendApiError(reply, 400, "Missing or invalid clientId in URL");
      }

      app.log.info({ clientId }, "Interpretation requested (client mode)");

      const [report] = await app.db
        .select()
        .from(reports)
        .where(eq(reports.client_id, clientId))
        .orderBy(desc(reports.created_at))
        .limit(1);

      if (!report) {
        return sendApiError(reply, 404, "No blueprint found for this client. Generate one first.");
      }

      if (!report.blueprint_data) {
        return sendApiError(reply, 400, "Report exists but has no blueprint_data. Re-generate the blueprint.");
      }

      let tier: ReportTierId;
      try {
        tier = parseInterpretTier(request.body);
      } catch (err) {
        return sendApiError(reply, 400, err instanceof Error ? err.message : "Invalid interpretation tier");
      }
      app.log.info({ reportId: report.id, clientId, tier }, "Starting GPT interpretation (client mode)");
      await updateReportStatus(app, report.id, "interpreting", tier);
      try {
        const result = await finalizeInterpretation(app, report, tier);
        return ok(result);
      } catch (err) {
        await updateReportStatus(
          app,
          report.id,
          "failed",
          tier,
          err instanceof Error ? err.message : "Interpretation failed",
        );
        throw err;
      }
    },
  );

  app.post<{ Params: { reportId: string } }>(
    "/blueprints/interpret/:reportId",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);

      const { reportId } = request.params;

      if (!reportId || reportId === "undefined" || reportId === "null") {
        return sendApiError(reply, 400, "Missing or invalid reportId in URL");
      }

      app.log.info({ reportId }, "Interpretation requested (by report ID)");

      const [report] = await app.db.select().from(reports).where(eq(reports.id, reportId)).limit(1);

      if (!report) {
        return sendApiError(reply, 404, `Report ${reportId} not found. Generate a blueprint first.`);
      }

      if (!report.blueprint_data) {
        return sendApiError(reply, 400, "Report has no blueprint_data. Re-generate the blueprint.");
      }

      const bp = report.blueprint_data as BlueprintData;
      const systemsIncluded = bp.meta?.systemsIncluded ?? [];
      let tier: ReportTierId;
      try {
        tier = parseInterpretTier(request.body);
      } catch (err) {
        return sendApiError(reply, 400, err instanceof Error ? err.message : "Invalid interpretation tier");
      }

      app.log.info({ reportId, systemsIncluded, tier, hasCore: !!bp.core }, "Starting chunked GPT interpretation");
      await updateReportStatus(app, report.id, "interpreting", tier);
      try {
        const result = await finalizeInterpretation(app, report, tier);
        return ok(result);
      } catch (err) {
        await updateReportStatus(
          app,
          report.id,
          "failed",
          tier,
          err instanceof Error ? err.message : "Interpretation failed",
        );
        throw err;
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/blueprints/reports/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);

      const { id } = request.params;
      const q = request.query as { tier?: string };

      const [row] = await app.db
        .select({
          ...getTableColumns(reports),
          client_name: clients.full_birth_name,
        })
        .from(reports)
        .leftJoin(clients, eq(reports.client_id, clients.id))
        .where(eq(reports.id, id))
        .limit(1);

      if (!row) {
        return sendApiError(reply, 404, "Report not found");
      }

      const { client_name, ...report } = row;
      const tierRows = await app.db
        .select()
        .from(reportTierOutputs)
        .where(eq(reportTierOutputs.report_id, report.id))
        .orderBy(desc(reportTierOutputs.updated_at), desc(reportTierOutputs.created_at));
      const activeTierOutput = pickActiveTierOutput(tierRows, q.tier);

      const fullMarkdown = activeTierOutput?.full_markdown?.trim()
        ? activeTierOutput.full_markdown.trim()
        : resolveFullMarkdown(report.full_markdown, report.generated_report);

      return ok({
        id: report.id,
        client_id: report.client_id,
        user_id: report.user_id,
        status: activeTierOutput?.status ?? report.status,
        member_status: report.member_status,
        purchase_intake: reportPurchaseIntakeValue(report),
        birth_place_name: report.birth_place_name,
        birth_lat: report.birth_lat,
        birth_lng: report.birth_lng,
        birth_timezone: report.birth_timezone,
        blueprint_data: report.blueprint_data,
        generated_report: activeTierOutput?.generated_report ?? report.generated_report,
        structured_data:
          getStructuredDataFromStoredReport(activeTierOutput?.generated_report ?? report.generated_report)
          ?? (report.blueprint_data
            ? buildReportStructuredData({
                blueprint: report.blueprint_data as BlueprintData,
                reportDate:
                  typeof reportMetaValue(report).generated_at === "string"
                    ? String(reportMetaValue(report).generated_at)
                    : isoDateString(activeTierOutput?.updated_at ?? report.updated_at ?? report.created_at),
                purchaseIntake: report.purchase_intake,
                birthPlaceName: report.birth_place_name,
                birthTimezone: report.birth_timezone,
              })
            : null),
        full_markdown: fullMarkdown,
        interpretation_tier: activeTierOutput?.tier ?? report.interpretation_tier,
        display_title: activeTierOutput?.display_title ?? report.display_title,
        systems_used: reportSystemsUsedValue(report),
        meta: reportMetaValue(report),
        admin_notes: report.admin_notes,
        created_at: activeTierOutput?.created_at ?? report.created_at,
        updated_at: activeTierOutput?.updated_at ?? report.updated_at,
        subject_name: subjectFullName(report, client_name ?? null),
        tier_outputs: tierRows.filter((row) => isReportTierId(row.tier)).map(mapTierOutput),
      });
    },
  );

  app.get<{ Params: { clientId: string } }>(
    "/reports/:clientId",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);

      const { clientId } = request.params;

      const [report] = await app.db
        .select()
        .from(reports)
        .where(eq(reports.client_id, clientId))
        .orderBy(desc(reports.created_at))
        .limit(1);

      if (!report) {
        return sendApiError(reply, 404, "No report found for this client");
      }

      const tierRows = await app.db
        .select()
        .from(reportTierOutputs)
        .where(eq(reportTierOutputs.report_id, report.id))
        .orderBy(desc(reportTierOutputs.updated_at), desc(reportTierOutputs.created_at));
      const activeTierOutput = pickActiveTierOutput(tierRows);

      return ok({
        id: report.id,
        clientId: report.client_id,
        userId: report.user_id,
        status: activeTierOutput?.status ?? report.status,
        memberStatus: report.member_status,
        purchaseIntake: reportPurchaseIntakeValue(report),
        birthPlaceName: report.birth_place_name,
        birthLat: report.birth_lat,
        birthLng: report.birth_lng,
        birthTimezone: report.birth_timezone,
        blueprintData: report.blueprint_data,
        generatedReport: activeTierOutput?.generated_report ?? report.generated_report,
        structuredData:
          getStructuredDataFromStoredReport(activeTierOutput?.generated_report ?? report.generated_report)
          ?? (report.blueprint_data
            ? buildReportStructuredData({
                blueprint: report.blueprint_data as BlueprintData,
                reportDate:
                  typeof reportMetaValue(report).generated_at === "string"
                    ? String(reportMetaValue(report).generated_at)
                    : isoDateString(activeTierOutput?.updated_at ?? report.updated_at ?? report.created_at),
                purchaseIntake: report.purchase_intake,
                birthPlaceName: report.birth_place_name,
                birthTimezone: report.birth_timezone,
              })
            : null),
        fullMarkdown: resolveFullMarkdown(
          activeTierOutput?.full_markdown ?? report.full_markdown,
          activeTierOutput?.generated_report ?? report.generated_report,
        ),
        interpretationTier: activeTierOutput?.tier ?? report.interpretation_tier,
        displayTitle: activeTierOutput?.display_title ?? report.display_title,
        systemsUsed: reportSystemsUsedValue(report),
        meta: reportMetaValue(report),
        adminNotes: report.admin_notes,
        createdAt: report.created_at,
        updatedAt: report.updated_at,
        tierOutputs: tierRows.filter((row) => isReportTierId(row.tier)).map(mapTierOutput),
      });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: {
      full_markdown?: string;
      admin_notes?: string;
      status?: string;
      member_status?: string;
    };
  }>(
    "/reports/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);

      const { id } = request.params;
      const q = request.query as { tier?: string };
      const { full_markdown, admin_notes, status, member_status } = request.body || {};
      const allowedStatuses = new Set([
        "draft",
        "interpreting",
        "interpreted",
        "failed",
        "reviewed",
        "finalized",
        "final",
      ]);
      const allowedMemberStatuses = new Set(["pending_payment", "paid", "fulfilled"]);

      if (full_markdown !== undefined && typeof full_markdown !== "string") {
        return sendApiError(reply, 400, "full_markdown must be a string");
      }
      if (admin_notes !== undefined && typeof admin_notes !== "string") {
        return sendApiError(reply, 400, "admin_notes must be a string");
      }
      if (status !== undefined && (typeof status !== "string" || !allowedStatuses.has(status))) {
        return sendApiError(reply, 400, "Invalid report status");
      }
      if (member_status !== undefined && (typeof member_status !== "string" || !allowedMemberStatuses.has(member_status))) {
        return sendApiError(reply, 400, "Invalid member status");
      }

      const [current] = await app.db.select().from(reports).where(eq(reports.id, id)).limit(1);
      if (!current) {
        return sendApiError(reply, 404, "Report not found");
      }

      const tierRows = await app.db
        .select()
        .from(reportTierOutputs)
        .where(eq(reportTierOutputs.report_id, current.id))
        .orderBy(desc(reportTierOutputs.updated_at), desc(reportTierOutputs.created_at));
      const activeTierOutput = pickActiveTierOutput(tierRows, q.tier);
      const activeStatus = activeTierOutput?.status ?? current.status;
      if (full_markdown !== undefined && isLockedReportStatus(activeStatus)) {
        return sendApiError(reply, 400, "Final reports are locked and cannot be edited");
      }

      const updateFields: Record<string, unknown> = {};
      if (full_markdown !== undefined) updateFields.full_markdown = full_markdown.trim();
      if (admin_notes !== undefined) updateFields.admin_notes = admin_notes;
      if (status !== undefined) updateFields.status = status;
      if (member_status !== undefined) updateFields.member_status = member_status;

      if (Object.keys(updateFields).length === 0) {
        return sendApiError(reply, 400, "No fields to update");
      }

      await app.db.update(reports).set(updateFields).where(eq(reports.id, id));

      if (activeTierOutput && (full_markdown !== undefined || status !== undefined)) {
        await upsertTierOutput(app, current.id, activeTierOutput.tier as ReportTierId, {
          ...(full_markdown !== undefined ? { full_markdown: full_markdown.trim() } : {}),
          ...(status !== undefined ? { status } : {}),
        });
      }

      const [row] = await app.db
        .select({
          ...getTableColumns(reports),
          client_name: clients.full_birth_name,
        })
        .from(reports)
        .leftJoin(clients, eq(reports.client_id, clients.id))
        .where(eq(reports.id, id))
        .limit(1);
      if (!row) {
        return sendApiError(reply, 404, "Report not found");
      }
      const { client_name, ...updated } = row;
      const updatedTierRows = await app.db
        .select()
        .from(reportTierOutputs)
        .where(eq(reportTierOutputs.report_id, updated.id))
        .orderBy(desc(reportTierOutputs.updated_at), desc(reportTierOutputs.created_at));
      const updatedActiveTierOutput = pickActiveTierOutput(updatedTierRows, q.tier);
      const resolvedMarkdown = resolveFullMarkdown(
        updatedActiveTierOutput?.full_markdown ?? updated.full_markdown,
        updatedActiveTierOutput?.generated_report ?? updated.generated_report,
      );

      return ok({
        id: updated.id,
        client_id: updated.client_id,
        user_id: updated.user_id,
        status: updatedActiveTierOutput?.status ?? updated.status,
        member_status: updated.member_status,
        purchase_intake: reportPurchaseIntakeValue(updated),
        birth_place_name: updated.birth_place_name,
        birth_lat: updated.birth_lat,
        birth_lng: updated.birth_lng,
        birth_timezone: updated.birth_timezone,
        blueprint_data: updated.blueprint_data,
        generated_report: updatedActiveTierOutput?.generated_report ?? updated.generated_report,
        structured_data:
          getStructuredDataFromStoredReport(updatedActiveTierOutput?.generated_report ?? updated.generated_report)
          ?? (updated.blueprint_data
            ? buildReportStructuredData({
                blueprint: updated.blueprint_data as BlueprintData,
                reportDate:
                  typeof reportMetaValue(updated).generated_at === "string"
                    ? String(reportMetaValue(updated).generated_at)
                    : isoDateString(updatedActiveTierOutput?.updated_at ?? updated.updated_at ?? updated.created_at),
                purchaseIntake: updated.purchase_intake,
                birthPlaceName: updated.birth_place_name,
                birthTimezone: updated.birth_timezone,
              })
            : null),
        full_markdown: resolvedMarkdown,
        interpretation_tier: updatedActiveTierOutput?.tier ?? updated.interpretation_tier,
        display_title: updatedActiveTierOutput?.display_title ?? updated.display_title,
        systems_used: reportSystemsUsedValue(updated),
        meta: reportMetaValue(updated),
        admin_notes: updated.admin_notes,
        created_at: updatedActiveTierOutput?.created_at ?? updated.created_at,
        updated_at: updatedActiveTierOutput?.updated_at ?? updated.updated_at,
        subject_name: subjectFullName(updated, client_name ?? null),
        tier_outputs: updatedTierRows.filter((row) => isReportTierId(row.tier)).map(mapTierOutput),
      });
    },
  );

  app.post<{ Params: { id: string }; Body: { tier?: string } }>(
    "/reports/:id/regenerate",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);

      const { id } = request.params;
      const [report] = await app.db.select().from(reports).where(eq(reports.id, id)).limit(1);
      if (!report) {
        return sendApiError(reply, 404, "Report not found");
      }
      if (!report.blueprint_data) {
        return sendApiError(reply, 400, "Report has no blueprint_data. Re-generate the blueprint.");
      }

      const tierRows = await app.db
        .select()
        .from(reportTierOutputs)
        .where(eq(reportTierOutputs.report_id, report.id))
        .orderBy(desc(reportTierOutputs.updated_at), desc(reportTierOutputs.created_at));

      let tier: ReportTierId | null = null;
      const requestedTier = request.body?.tier;
      if (requestedTier !== undefined) {
        if (!isReportTierId(requestedTier)) {
          return sendApiError(reply, 400, "Invalid interpretation tier");
        }
        tier = requestedTier;
      } else if (tierRows[0] && isReportTierId(tierRows[0].tier)) {
        tier = tierRows[0].tier;
      } else if (isReportTierId(report.interpretation_tier)) {
        tier = report.interpretation_tier;
      }

      if (!tier) {
        return sendApiError(reply, 400, "Missing or invalid interpretation tier");
      }

      const activeTierOutput = pickActiveTierOutput(tierRows, tier);
      if (isLockedReportStatus(activeTierOutput?.status ?? report.status)) {
        return sendApiError(reply, 400, "Final reports are locked and cannot be regenerated");
      }

      await updateReportStatus(app, report.id, "interpreting", tier);
      try {
        const result = await finalizeInterpretation(app, report, tier);
        await app.db
          .update(reports)
          .set({
            meta: {
              ...reportMetaValue(report),
              lastRegeneratedAt: new Date().toISOString(),
              regenerationCount: Number(reportMetaValue(report).regenerationCount ?? 0) + 1,
              clarityGlyphCount: clarityGlyphCountForTier(tier),
            },
          })
          .where(eq(reports.id, report.id));
        return ok(result);
      } catch (err) {
        await updateReportStatus(
          app,
          report.id,
          "failed",
          tier,
          err instanceof Error ? err.message : "Regeneration failed",
        );
        throw err;
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { tier?: string } }>(
    "/reports/:id/finalize",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);

      const { id } = request.params;
      const [report] = await app.db.select().from(reports).where(eq(reports.id, id)).limit(1);
      if (!report) {
        return sendApiError(reply, 404, "Report not found");
      }

      const tierRows = await app.db
        .select()
        .from(reportTierOutputs)
        .where(eq(reportTierOutputs.report_id, report.id))
        .orderBy(desc(reportTierOutputs.updated_at), desc(reportTierOutputs.created_at));

      let tier: ReportTierId | null = null;
      const requestedTier = request.body?.tier;
      if (requestedTier !== undefined) {
        if (!isReportTierId(requestedTier)) {
          return sendApiError(reply, 400, "Invalid interpretation tier");
        }
        tier = requestedTier;
      } else if (tierRows[0] && isReportTierId(tierRows[0].tier)) {
        tier = tierRows[0].tier;
      } else if (isReportTierId(report.interpretation_tier)) {
        tier = report.interpretation_tier;
      }

      await app.db
        .update(reports)
        .set({
          status: "final",
          meta: {
            ...reportMetaValue(report),
            finalizedAt: new Date().toISOString(),
            clarityGlyphCount: clarityGlyphCountForTier(tier ?? report.interpretation_tier),
          },
        })
        .where(eq(reports.id, report.id));

      if (tier) {
        await upsertTierOutput(app, report.id, tier, {
          status: "final",
        });
      }

      const [updated] = await app.db.select().from(reports).where(eq(reports.id, report.id)).limit(1);
      if (!updated) {
        return sendApiError(reply, 404, "Report not found");
      }

      return ok({
        id: updated.id,
        status: "final",
        updated_at: updated.updated_at,
        meta: reportMetaValue(updated),
      });
    },
  );
}
