import Stripe from "stripe";
import {
  RESONANT_DOWSING_CURRENCY,
  RESONANT_DOWSING_PRICE_CENTS,
} from "../services/courses/resonantDowsingCourse.js";

export const RESONANT_DOWSING_STRIPE_PRICE_ID = "price_1ToFFCAd5V3LaCqj2pPuEFp9";
export const RESONANT_DOWSING_STRIPE_PRICE_ENV = "STRIPE_PRICE_RESONANT_DOWSING";
export const RESONANT_DOWSING_CHECKOUT_UNAVAILABLE_MESSAGE =
  "Course checkout is temporarily unavailable. Please try again later or contact support.";
export const RESONANT_DOWSING_STRIPE_PRICE_MISMATCH_MESSAGE =
  "Resonant Dowsing Stripe configuration mismatch: Expected active one-time CAD price at 9900 cents.";

export type ResonantDowsingStripePriceFailureReason =
  | "missing_env"
  | "price_not_found"
  | "price_inactive"
  | "wrong_currency"
  | "wrong_amount"
  | "wrong_type"
  | "stripe_request_failed";

export interface ResonantDowsingStripePriceDiagnostics {
  configuredPriceId: string | null;
  retrievedPriceId: string | null;
  exists: boolean;
  active: boolean | null;
  currency: string | null;
  unitAmount: number | null;
  type: string | null;
  livemode: boolean | null;
  valid: boolean;
  failureReason: ResonantDowsingStripePriceFailureReason | null;
  priceDoesNotExist: boolean;
}

type SafeLogger = {
  error?: (message: string, meta?: unknown) => void;
  warn?: (message: string, meta?: unknown) => void;
};

export class ResonantDowsingStripePriceConfigError extends Error {
  diagnostics: ResonantDowsingStripePriceDiagnostics;

  constructor(message: string, diagnostics: ResonantDowsingStripePriceDiagnostics) {
    super(message);
    this.name = "ResonantDowsingStripePriceConfigError";
    this.diagnostics = diagnostics;
  }
}

function createDiagnostics(input: Partial<ResonantDowsingStripePriceDiagnostics> = {}): ResonantDowsingStripePriceDiagnostics {
  return {
    configuredPriceId: input.configuredPriceId ?? process.env[RESONANT_DOWSING_STRIPE_PRICE_ENV]?.trim() ?? null,
    retrievedPriceId: input.retrievedPriceId ?? null,
    exists: input.exists ?? false,
    active: input.active ?? null,
    currency: input.currency ?? null,
    unitAmount: input.unitAmount ?? null,
    type: input.type ?? null,
    livemode: input.livemode ?? null,
    valid: input.valid ?? false,
    failureReason: input.failureReason ?? null,
    priceDoesNotExist: input.priceDoesNotExist ?? false,
  };
}

function isStripeMissingPriceError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { type?: unknown; code?: unknown; statusCode?: unknown; raw?: { code?: unknown; type?: unknown } };
  return maybe.code === "resource_missing"
    || maybe.raw?.code === "resource_missing"
    || (maybe.statusCode === 404 && (maybe.type === "StripeInvalidRequestError" || maybe.raw?.type === "invalid_request_error"));
}

function toConfigError(diagnostics: ResonantDowsingStripePriceDiagnostics) {
  return new ResonantDowsingStripePriceConfigError(RESONANT_DOWSING_STRIPE_PRICE_MISMATCH_MESSAGE, diagnostics);
}

function logPriceValidationFailure(logger: SafeLogger | undefined, diagnostics: ResonantDowsingStripePriceDiagnostics) {
  logger?.error?.("resonant_dowsing_stripe_price_validation_failed", diagnostics);
}

export function isResonantDowsingStripePriceConfigError(error: unknown): error is ResonantDowsingStripePriceConfigError {
  return error instanceof ResonantDowsingStripePriceConfigError
    || Boolean(error && typeof error === "object" && (error as { name?: unknown }).name === "ResonantDowsingStripePriceConfigError");
}

export function getResonantDowsingStripePriceId() {
  const configured = process.env[RESONANT_DOWSING_STRIPE_PRICE_ENV]?.trim();
  if (!configured) {
    throw toConfigError(createDiagnostics({
      configuredPriceId: null,
      failureReason: "missing_env",
    }));
  }
  return configured;
}

export function getResonantDowsingStripePriceDiagnostics(price: Stripe.Price): ResonantDowsingStripePriceDiagnostics {
  const currencyMatches = price.currency.toLowerCase() === RESONANT_DOWSING_CURRENCY.toLowerCase();
  const amountMatches = price.unit_amount === RESONANT_DOWSING_PRICE_CENTS;
  const typeMatches = price.type === "one_time";
  const failureReason: ResonantDowsingStripePriceFailureReason | null = !price.active
    ? "price_inactive"
    : !currencyMatches
      ? "wrong_currency"
      : !amountMatches
        ? "wrong_amount"
        : !typeMatches
          ? "wrong_type"
          : null;

  return createDiagnostics({
    retrievedPriceId: price.id,
    exists: true,
    active: price.active,
    currency: price.currency,
    unitAmount: price.unit_amount,
    type: price.type,
    livemode: price.livemode,
    valid: failureReason === null,
    failureReason,
  });
}

export function validateResonantDowsingStripePrice(price: Stripe.Price) {
  const diagnostics = getResonantDowsingStripePriceDiagnostics(price);
  if (!diagnostics.valid) {
    throw toConfigError(diagnostics);
  }
  return true;
}

export async function diagnoseResonantDowsingStripePrice(stripe: Stripe): Promise<ResonantDowsingStripePriceDiagnostics> {
  let priceId: string;
  try {
    priceId = getResonantDowsingStripePriceId();
  } catch (error) {
    if (isResonantDowsingStripePriceConfigError(error)) {
      return error.diagnostics;
    }
    throw error;
  }

  try {
    const price = await stripe.prices.retrieve(priceId);
    return getResonantDowsingStripePriceDiagnostics(price);
  } catch (error) {
    if (isStripeMissingPriceError(error)) {
      return createDiagnostics({
        configuredPriceId: priceId,
        failureReason: "price_not_found",
        priceDoesNotExist: true,
      });
    }
    return createDiagnostics({
      configuredPriceId: priceId,
      failureReason: "stripe_request_failed",
    });
  }
}

export async function verifyResonantDowsingStripePrice(stripe: Stripe, options: { logger?: SafeLogger } = {}) {
  let priceId: string;
  try {
    priceId = getResonantDowsingStripePriceId();
  } catch (error) {
    if (isResonantDowsingStripePriceConfigError(error)) {
      logPriceValidationFailure(options.logger, error.diagnostics);
    }
    throw error;
  }
  let price: Stripe.Price;
  try {
    price = await stripe.prices.retrieve(priceId);
  } catch (error) {
    const diagnostics = createDiagnostics({
      configuredPriceId: priceId,
      failureReason: isStripeMissingPriceError(error) ? "price_not_found" : "stripe_request_failed",
      priceDoesNotExist: isStripeMissingPriceError(error),
    });
    logPriceValidationFailure(options.logger, diagnostics);
    throw toConfigError(diagnostics);
  }

  const diagnostics = getResonantDowsingStripePriceDiagnostics(price);
  if (!diagnostics.valid) {
    logPriceValidationFailure(options.logger, diagnostics);
    throw toConfigError(diagnostics);
  }
  return price;
}
