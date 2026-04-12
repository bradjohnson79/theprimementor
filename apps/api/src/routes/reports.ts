import type { FastifyInstance } from "fastify";
import { ok } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../routeAssertions.js";
import {
  createMemberReportOrder,
  getMemberReportDetail,
  listMemberReports,
} from "../services/reportPurchaseService.js";

interface CreateMemberReportBody {
  tier?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  birthTime?: string;
  birthPlaceName?: string;
  birthLat?: number;
  birthLng?: number;
  birthTimezone?: string;
  timezoneSource?: "user" | "suggested" | "fallback";
  primaryFocus?: string;
  consentGiven?: boolean;
  notes?: string;
}

export async function reportsRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateMemberReportBody }>("/member/reports", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);

    const body = request.body ?? {};
    const report = await createMemberReportOrder(db, {
      userId: request.dbUser!.id,
      tier: body.tier,
      fullName: body.fullName,
      email: body.email,
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
    });

    return ok({
      success: true,
      reportId: report.id,
      requiresPayment: true,
      data: report,
    });
  });

  app.get("/member/reports", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    return ok({
      data: await listMemberReports(db, request.dbUser!.id),
    });
  });

  app.get<{ Params: { id: string } }>("/member/reports/:id", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    return ok({
      data: await getMemberReportDetail(db, request.dbUser!.id, request.params.id),
    });
  });
}
