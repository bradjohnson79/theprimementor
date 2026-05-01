import type { FastifyInstance } from "fastify";
import type { MentorTrainingPackageType, PromoBillingScope, PromoTarget, ReportTierId } from "@wisdom/utils";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase, requireDbUser } from "../routeAssertions.js";
import {
  applyPromoFixSync,
  createPromoCode,
  listPromoCodes,
  updatePromoCode,
  validatePromoCodeForCheckout,
  verifyPromoCodeWithStripe,
} from "../services/promoCodeService.js";

interface PromoParams {
  promoCodeId: string;
}

interface CreatePromoBody {
  code?: string;
  discountValue?: number;
  active?: boolean;
  expiresAt?: string | null;
  usageLimit?: number | null;
  appliesTo?: PromoTarget[] | null;
  appliesToBilling?: PromoBillingScope | null;
  minAmountCents?: number | null;
  firstTimeOnly?: boolean;
  campaign?: string | null;
}

interface UpdatePromoBody extends Partial<CreatePromoBody> {
  archive?: boolean;
}

interface ValidatePromoBody {
  code?: string;
  type?: "session" | "report" | "subscription" | "mentor_training" | "mentoring_circle";
  bookingId?: string;
  reportId?: string;
  membershipId?: string;
  trainingOrderId?: string;
  eventId?: string;
  sessionType?: string | null;
  reportTier?: ReportTierId | null;
  membershipTier?: "seeker" | "initiate" | null;
  billingInterval?: "monthly" | "annual" | null;
  packageType?: MentorTrainingPackageType | null;
}

interface FixSyncBody {
  direction?: "db_to_stripe" | "stripe_to_db";
}

export async function promoCodesRoutes(app: FastifyInstance) {
  app.get("/admin/promo-codes", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    return ok({ data: await listPromoCodes(db) });
  });

  app.post<{ Body: CreatePromoBody }>("/admin/promo-codes", { preHandler: requireAuth }, async (request, reply) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    requireAdmin(request);
    const body = request.body ?? {};
    if (!body.code || typeof body.discountValue !== "number") {
      return sendApiError(reply, 400, "code and discountValue are required");
    }
    const created = await createPromoCode(db, {
      code: body.code,
      discountValue: body.discountValue,
      active: body.active ?? true,
      expiresAt: body.expiresAt ?? null,
      usageLimit: body.usageLimit ?? null,
      appliesTo: body.appliesTo ?? null,
      appliesToBilling: body.appliesToBilling ?? null,
      minAmountCents: body.minAmountCents ?? null,
      firstTimeOnly: body.firstTimeOnly ?? false,
      campaign: body.campaign ?? null,
    }, user.id);
    return ok({ data: created });
  });

  app.patch<{ Params: PromoParams; Body: UpdatePromoBody }>("/admin/promo-codes/:promoCodeId", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    requireAdmin(request);
    const updated = await updatePromoCode(db, request.params.promoCodeId, request.body ?? {}, user.id);
    return ok({ data: updated });
  });

  app.post<{ Params: PromoParams }>("/admin/promo-codes/:promoCodeId/verify", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    requireAdmin(request);
    const validation = await verifyPromoCodeWithStripe(db, request.params.promoCodeId);
    return ok({ data: validation });
  });

  app.post<{ Params: PromoParams; Body: FixSyncBody }>("/admin/promo-codes/:promoCodeId/fix-sync", { preHandler: requireAuth }, async (request, reply) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    requireAdmin(request);
    if (request.body?.direction !== "db_to_stripe" && request.body?.direction !== "stripe_to_db") {
      return sendApiError(reply, 400, "direction must be db_to_stripe or stripe_to_db");
    }
    const result = await applyPromoFixSync(db, request.params.promoCodeId, request.body.direction, user.id);
    return ok({ data: result });
  });

  app.post<{ Body: ValidatePromoBody }>("/promo-codes/validate", { preHandler: requireAuth }, async (request, reply) => {
    const db = requireDatabase(app.db);
    const user = requireDbUser(request);
    const body = request.body ?? {};
    if (!body.code?.trim()) {
      return sendApiError(reply, 400, "code is required");
    }
    const validation = await validatePromoCodeForCheckout(db, {
      code: body.code,
      type: body.type,
      bookingId: body.bookingId,
      reportId: body.reportId,
      membershipId: body.membershipId,
      trainingOrderId: body.trainingOrderId,
      eventId: body.eventId,
      sessionType: body.sessionType,
      reportTier: body.reportTier ?? null,
      membershipTier: body.membershipTier ?? null,
      billingInterval: body.billingInterval ?? null,
      packageType: body.packageType ?? null,
      userId: user.id,
    });
    return ok({ data: validation });
  });
}
