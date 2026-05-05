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
  reportType?: string;
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
  currentLocation?: string;
  question1?: string;
  question2?: string;
  question3?: string;
  personA?: unknown;
  personB?: unknown;
  relationshipType?: string;
  relationshipQuestion?: string;
  relationshipStatus?: string;
  desiredFocus?: string;
  currentLifeFocus?: string;
  areasOfInterest?: string[];
}

export async function reportsRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateMemberReportBody }>("/member/reports", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);

    const body = request.body ?? {};
    const report = await createMemberReportOrder(db, {
      userId: request.dbUser!.id,
      tier: body.tier,
      reportType: body.reportType,
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
