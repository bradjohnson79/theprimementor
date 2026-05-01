import type { MentorTrainingPackageType, ReportTierId } from "@wisdom/utils";
import { api } from "./api";

export interface PromoValidationContext {
  type: "session" | "report" | "subscription" | "mentor_training" | "mentoring_circle";
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

export interface PromoValidationResult {
  valid: boolean;
  message?: string;
  code?: string;
  promoCodeId?: string;
  stripePromotionCodeId?: string;
  estimatedDiscount: number | null;
  finalEstimate: number | null;
  estimatedDiscountCents: number | null;
  finalEstimateCents: number | null;
  currency: string | null;
}

export async function validatePromoCode(
  code: string,
  context: PromoValidationContext,
  token: string | null,
): Promise<PromoValidationResult> {
  const response = (await api.post("/promo-codes/validate", {
    code,
    ...context,
  }, token)) as { data: PromoValidationResult };
  return response.data;
}
