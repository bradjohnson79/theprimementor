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
  | "valid"
  | "missing_environment_variable"
  | "price_not_found"
  | "wrong_stripe_account_or_connect_context"
  | "wrong_mode"
  | "inactive_price"
  | "wrong_currency"
  | "wrong_amount"
  | "recurring_price"
  | "stripe_api_request_failed";

export interface ResonantDowsingStripePriceDiagnostics {
  configuredPriceId: string | null;
  retrievedPriceId: string | null;
  priceExists: boolean;
  exists: boolean;
  active: boolean | null;
  currency: string | null;
  unitAmount: number | null;
  type: string | null;
  priceLivemode: boolean | null;
  livemode: boolean | null;
  stripeAccountId: string | null;
  stripeAccountLivemode: boolean | null;
  stripeAccountContext: string | null;
  validationResult: "valid" | "invalid";
  validationFailureReason: ResonantDowsingStripePriceFailureReason | null;
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
  const valid = input.valid ?? input.validationResult === "valid";
  const validationFailureReason = input.validationFailureReason ?? input.failureReason ?? (valid ? "valid" : null);
  const priceExists = input.priceExists ?? input.exists ?? false;
  const priceLivemode = input.priceLivemode ?? input.livemode ?? null;
  return {
    configuredPriceId: input.configuredPriceId ?? process.env[RESONANT_DOWSING_STRIPE_PRICE_ENV]?.trim() ?? null,
    retrievedPriceId: input.retrievedPriceId ?? null,
    priceExists,
    exists: priceExists,
    active: input.active ?? null,
    currency: input.currency ?? null,
    unitAmount: input.unitAmount ?? null,
    type: input.type ?? null,
    priceLivemode,
    livemode: priceLivemode,
    stripeAccountId: input.stripeAccountId ?? null,
    stripeAccountLivemode: input.stripeAccountLivemode ?? null,
    stripeAccountContext: input.stripeAccountContext ?? null,
    validationResult: valid ? "valid" : "invalid",
    validationFailureReason,
    valid,
    failureReason: validationFailureReason,
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
      validationFailureReason: "missing_environment_variable",
    }));
  }
  return configured;
}

export function buildResonantDowsingCheckoutLineItem() {
  return {
    price: getResonantDowsingStripePriceId(),
    quantity: 1,
  } as const;
}

function getStripeAccountContext() {
  return process.env.STRIPE_ACCOUNT_ID?.trim() || process.env.STRIPE_CONNECT_ACCOUNT_ID?.trim() || null;
}

function inferStripeSecretLivemode() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (key?.startsWith("sk_live_")) return true;
  if (key?.startsWith("sk_test_")) return false;
  return null;
}

async function getStripeAccountDiagnostics(stripe: Stripe) {
  const account = await stripe.accounts.retrieve();
  const accountRecord = account as unknown as { id?: string | null; livemode?: boolean | null };
  return {
    stripeAccountId: accountRecord.id ?? null,
    stripeAccountLivemode: typeof accountRecord.livemode === "boolean" ? accountRecord.livemode : inferStripeSecretLivemode(),
    stripeAccountContext: getStripeAccountContext(),
  };
}

export function getResonantDowsingStripePriceDiagnostics(
  price: Stripe.Price,
  account: { stripeAccountId?: string | null; stripeAccountLivemode?: boolean | null; stripeAccountContext?: string | null } = {},
): ResonantDowsingStripePriceDiagnostics {
  const currencyMatches = price.currency.toLowerCase() === RESONANT_DOWSING_CURRENCY.toLowerCase();
  const amountMatches = price.unit_amount === RESONANT_DOWSING_PRICE_CENTS;
  const typeMatches = price.type === "one_time";
  const modeMatches = typeof account.stripeAccountLivemode !== "boolean" || price.livemode === account.stripeAccountLivemode;
  const failureReason: ResonantDowsingStripePriceFailureReason | null = !price.active
    ? "inactive_price"
    : !currencyMatches
      ? "wrong_currency"
      : !amountMatches
        ? "wrong_amount"
        : !typeMatches
          ? "recurring_price"
          : !modeMatches
            ? "wrong_mode"
            : null;

  return createDiagnostics({
    retrievedPriceId: price.id,
    priceExists: true,
    active: price.active,
    currency: price.currency,
    unitAmount: price.unit_amount,
    type: price.type,
    priceLivemode: price.livemode,
    stripeAccountId: account.stripeAccountId ?? null,
    stripeAccountLivemode: account.stripeAccountLivemode ?? null,
    stripeAccountContext: account.stripeAccountContext ?? getStripeAccountContext(),
    valid: failureReason === null,
    validationFailureReason: failureReason ?? "valid",
  });
}

export function validateResonantDowsingStripePrice(
  price: Stripe.Price,
  account: { stripeAccountId?: string | null; stripeAccountLivemode?: boolean | null; stripeAccountContext?: string | null } = {},
) {
  const diagnostics = getResonantDowsingStripePriceDiagnostics(price, account);
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

  let accountDiagnostics: Awaited<ReturnType<typeof getStripeAccountDiagnostics>>;
  try {
    accountDiagnostics = await getStripeAccountDiagnostics(stripe);
  } catch {
    return createDiagnostics({
      configuredPriceId: priceId,
      validationFailureReason: "stripe_api_request_failed",
      stripeAccountContext: getStripeAccountContext(),
    });
  }

  try {
    const price = await stripe.prices.retrieve(priceId);
    return getResonantDowsingStripePriceDiagnostics(price, accountDiagnostics);
  } catch (error) {
    if (isStripeMissingPriceError(error)) {
      return createDiagnostics({
        configuredPriceId: priceId,
        ...accountDiagnostics,
        validationFailureReason: "price_not_found",
        priceDoesNotExist: true,
      });
    }
    return createDiagnostics({
      configuredPriceId: priceId,
      ...accountDiagnostics,
      validationFailureReason: "stripe_api_request_failed",
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

  let accountDiagnostics: Awaited<ReturnType<typeof getStripeAccountDiagnostics>>;
  try {
    accountDiagnostics = await getStripeAccountDiagnostics(stripe);
  } catch {
    const diagnostics = createDiagnostics({
      configuredPriceId: priceId,
      validationFailureReason: "stripe_api_request_failed",
      stripeAccountContext: getStripeAccountContext(),
    });
    logPriceValidationFailure(options.logger, diagnostics);
    throw toConfigError(diagnostics);
  }

  let price: Stripe.Price;
  try {
    price = await stripe.prices.retrieve(priceId);
  } catch (error) {
    const diagnostics = createDiagnostics({
      configuredPriceId: priceId,
      ...accountDiagnostics,
      validationFailureReason: isStripeMissingPriceError(error) ? "price_not_found" : "stripe_api_request_failed",
      priceDoesNotExist: isStripeMissingPriceError(error),
    });
    logPriceValidationFailure(options.logger, diagnostics);
    throw toConfigError(diagnostics);
  }

  const diagnostics = getResonantDowsingStripePriceDiagnostics(price, accountDiagnostics);
  if (!diagnostics.valid) {
    logPriceValidationFailure(options.logger, diagnostics);
    throw toConfigError(diagnostics);
  }
  return price;
}
