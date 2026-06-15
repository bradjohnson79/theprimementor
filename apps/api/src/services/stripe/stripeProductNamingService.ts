import type { MentorTrainingPackageType, ReportProductKey } from "@wisdom/utils";
import { MENTOR_TRAINING_PACKAGES } from "@wisdom/utils";
import {
  REGENERATION_MANIFESTATION_ENHANCEMENT_DURATION_DAYS,
  REGENERATION_MANIFESTATION_ENHANCEMENT_KEY,
  REGENERATION_MANIFESTATION_ENHANCEMENT_NAME,
  REGENERATION_PLAN_NAME,
  REGENERATION_PRODUCT_KEY,
} from "../../config/regenerationBilling.js";
import type { SessionCheckoutType } from "../../config/sessionCheckout.js";

export const PRIME_MENTOR_STRIPE_PLATFORM = "prime_mentor";

export type StripeNamedProduct =
  | {
    type: "session";
    sessionType: SessionCheckoutType | string | null;
    durationMinutes?: number | null;
    fallbackName?: string | null;
  }
  | {
    type: "report";
    reportType: ReportProductKey | string | null;
  }
  | {
    type: "event";
    eventType: "mentoring_circle" | "webinar" | string;
    eventName?: string | null;
  }
  | {
    type: "subscription";
    subscriptionType: "membership" | "regeneration" | string;
    tier?: string | null;
    billingInterval?: string | null;
  }
  | {
    type: "addon";
    addonType: "regeneration_manifestation_enhancement" | string;
  }
  | {
    type: "mentor_training";
    packageType: MentorTrainingPackageType | string | null;
  }
  | {
    type: "manual_invoice";
    productType: "session" | "report" | "subscription" | "webinar" | "custom" | string;
    customLabel?: string | null;
  }
  | {
    type: "custom";
    productName: string;
    description?: string | null;
    metadata?: Record<string, string | number | boolean | null | undefined>;
  };

export interface StripeProductNamingResult {
  productName: string;
  description: string;
  metadata: Record<string, string>;
}

const REPORT_DISPLAY_NAMES: Record<ReportProductKey, string> = {
  intro: "Seeker Divin8 Report",
  deep_dive: "Deep Dive Divin8 Report",
  initiate: "Initiate Divin8 Report",
  three_questions: "3 Questions Divin8 Report",
  compatibility: "Partner Compatibility Report",
  annual_12_month: "12 Month Annual Report",
};

function toMetadata(input: Record<string, string | number | boolean | null | undefined>) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
      .map(([key, value]) => [key, String(value)]),
  );
}

function toMetadataFromUnknown(input: Record<string, unknown>) {
  return toMetadata(input as Record<string, string | number | boolean | null | undefined>);
}

function normalizeDuration(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function resolveSessionName(input: Extract<StripeNamedProduct, { type: "session" }>) {
  const duration = normalizeDuration(input.durationMinutes);
  const sessionType = input.sessionType ?? "";
  if (sessionType === "qa_session") {
    return duration ? `${duration} Minute Q&A Session` : "Q&A Session";
  }
  if (sessionType === "focus") {
    return duration ? `${duration} Minute Focus Session` : "Focus Session";
  }
  if (sessionType === "mentoring") {
    return duration ? `${duration} Minute Mentoring Session` : "Mentoring Session";
  }
  if (sessionType === "regeneration") {
    return REGENERATION_PLAN_NAME;
  }
  return input.fallbackName?.trim() || (duration ? `${duration} Minute Session` : "Prime Mentor Session");
}

function resolveManualInvoiceName(input: Extract<StripeNamedProduct, { type: "manual_invoice" }>) {
  if (input.productType === "custom") {
    return input.customLabel?.trim() || "Custom Prime Mentor Invoice";
  }
  if (input.productType === "session") return "Manual Session Invoice";
  if (input.productType === "report") return "Manual Report Invoice";
  if (input.productType === "subscription") return "Manual Subscription Invoice";
  if (input.productType === "webinar") return "Prime Mentor Webinar Registration";
  return input.customLabel?.trim() || "Prime Mentor Invoice";
}

export function resolveStripeProductNaming(input: StripeNamedProduct): StripeProductNamingResult {
  if (input.type === "custom") {
    const productName = input.productName.trim();
    return {
      productName,
      description: input.description?.trim() || productName,
      metadata: {
        platform: PRIME_MENTOR_STRIPE_PLATFORM,
        product_type: "custom",
        product_name: productName,
        ...toMetadata(input.metadata ?? {}),
      },
    };
  }

  if (input.type === "session") {
    const productName = resolveSessionName(input);
    const duration = normalizeDuration(input.durationMinutes);
    return {
      productName,
      description: duration
        ? `Private Prime Mentor ${productName.toLowerCase()} (${duration} minutes)`
        : `Private Prime Mentor ${productName.toLowerCase()}`,
      metadata: toMetadata({
        platform: PRIME_MENTOR_STRIPE_PLATFORM,
        product_type: "session",
        session_type: input.sessionType,
        duration,
        product_name: productName,
      }),
    };
  }

  if (input.type === "report") {
    const reportType = input.reportType as ReportProductKey;
    const productName = REPORT_DISPLAY_NAMES[reportType] ?? "Divin8 Report";
    return {
      productName,
      description: `Prime Mentor ${productName}`,
      metadata: toMetadata({
        platform: PRIME_MENTOR_STRIPE_PLATFORM,
        product_type: "report",
        report_type: input.reportType,
        product_name: productName,
      }),
    };
  }

  if (input.type === "event") {
    const productName = input.eventType === "webinar"
      ? "Prime Mentor Webinar Registration"
      : "Mentoring Circle Registration";
    return {
      productName,
      description: input.eventName?.trim()
        ? `${productName}: ${input.eventName.trim()}`
        : `${productName} for a Prime Mentor live event`,
      metadata: toMetadata({
        platform: PRIME_MENTOR_STRIPE_PLATFORM,
        product_type: "event",
        event_type: input.eventType,
        event_name: input.eventName,
        product_name: productName,
      }),
    };
  }

  if (input.type === "subscription") {
    const productName = input.subscriptionType === "regeneration"
      ? REGENERATION_PLAN_NAME
      : input.tier === "seeker"
        ? "Premium Member Subscription"
        : `${input.tier ? `${input.tier[0]?.toUpperCase()}${input.tier.slice(1)} ` : ""}Membership Subscription`.trim();
    return {
      productName,
      description: input.subscriptionType === "regeneration"
        ? "Prime Mentor Regeneration monthly membership package"
        : `Prime Mentor ${productName}`,
      metadata: toMetadata({
        platform: PRIME_MENTOR_STRIPE_PLATFORM,
        product_type: "subscription",
        subscription_type: input.subscriptionType,
        tier: input.tier,
        billing_interval: input.billingInterval,
        product_key: input.subscriptionType === "regeneration" ? REGENERATION_PRODUCT_KEY : undefined,
        product_name: productName,
      }),
    };
  }

  if (input.type === "addon") {
    const productName = input.addonType === "regeneration_manifestation_enhancement"
      ? REGENERATION_MANIFESTATION_ENHANCEMENT_NAME
      : "Prime Mentor Add-on";
    return {
      productName,
      description: input.addonType === "regeneration_manifestation_enhancement"
        ? `Prime Mentor ${REGENERATION_MANIFESTATION_ENHANCEMENT_NAME} (${REGENERATION_MANIFESTATION_ENHANCEMENT_DURATION_DAYS} days)`
        : productName,
      metadata: toMetadata({
        platform: PRIME_MENTOR_STRIPE_PLATFORM,
        product_type: "addon",
        addon_type: input.addonType,
        product_key: input.addonType === "regeneration_manifestation_enhancement"
          ? REGENERATION_MANIFESTATION_ENHANCEMENT_KEY
          : undefined,
        duration_days: input.addonType === "regeneration_manifestation_enhancement"
          ? REGENERATION_MANIFESTATION_ENHANCEMENT_DURATION_DAYS
          : undefined,
        product_name: productName,
      }),
    };
  }

  if (input.type === "mentor_training") {
    const packageDefinition = input.packageType && input.packageType in MENTOR_TRAINING_PACKAGES
      ? MENTOR_TRAINING_PACKAGES[input.packageType as MentorTrainingPackageType]
      : null;
    const productName = packageDefinition ? `Mentor Training ${packageDefinition.title}` : "Mentor Training Package";
    return {
      productName,
      description: `Prime Mentor ${productName}`,
      metadata: toMetadata({
        platform: PRIME_MENTOR_STRIPE_PLATFORM,
        product_type: "mentor_training",
        package_type: input.packageType,
        product_name: productName,
      }),
    };
  }

  const productName = resolveManualInvoiceName(input);
  return {
    productName,
    description: productName,
    metadata: toMetadata({
      platform: PRIME_MENTOR_STRIPE_PLATFORM,
      product_type: input.productType,
      invoice_product_type: input.productType,
      product_name: productName,
    }),
  };
}

export function mergeStripeMetadata(
  ...metadataSources: Array<Record<string, unknown> | null | undefined>
) {
  return metadataSources.reduce<Record<string, string>>((acc, metadata) => ({
    ...acc,
    ...toMetadataFromUnknown(metadata ?? {}),
  }), {});
}

export function isHumanReadableStripeDescription(value: string | null | undefined) {
  const description = value?.trim();
  if (!description) return false;
  return !/^pi_[A-Za-z0-9]+$/.test(description)
    && !/^ch_[A-Za-z0-9]+$/.test(description)
    && description !== "Subscription creation";
}
