import Stripe from "stripe";

/**
 * Guest-checkout local testing (additive, production-safe): optional override so the Stripe
 * client can be pointed at a local stripe-mock instance instead of the real Stripe API. These
 * env vars are unset in production/normal local dev, so `new Stripe(key)` behaves exactly as
 * before everywhere this factory is used.
 *
 *   STRIPE_API_HOST=localhost
 *   STRIPE_API_PORT=12111
 *   STRIPE_API_PROTOCOL=http
 */
export function createStripeClient(apiKey: string): Stripe {
  const host = process.env.STRIPE_API_HOST?.trim();
  if (!host) {
    return new Stripe(apiKey);
  }

  const port = process.env.STRIPE_API_PORT?.trim();
  const protocol = (process.env.STRIPE_API_PROTOCOL?.trim() as "http" | "https" | undefined) || "http";

  return new Stripe(apiKey, {
    host,
    port: port ? Number(port) : undefined,
    protocol,
  });
}

/**
 * True only when the Stripe client is deliberately pointed at a local mock AND the configured
 * key is a test key. Both conditions are required so a mock-only code path (e.g. skipping a
 * live-Stripe verification check) can never activate in production, even if one of the two env
 * vars were ever set by mistake.
 */
export function isStripeMockModeActive(): boolean {
  const host = process.env.STRIPE_API_HOST?.trim();
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return Boolean(host) && Boolean(key?.startsWith("sk_test_"));
}

/**
 * Guest-checkout local testing only: the local stripe-mock binary's bundled OpenAPI spec
 * (0.206.0) rejects `payment_method_types` on `checkout.sessions.create` with "additional
 * properties are not allowed" (verified directly against stripe-mock, independent of the SDK).
 * Real Stripe accepts this field normally, so production must always keep sending it. Spread
 * this at each checkout.sessions.create call site instead of the literal
 * `payment_method_types: ["card"]` key so the field is included unchanged in production and
 * omitted only when both `isStripeMockModeActive()` gates are true.
 */
export function checkoutPaymentMethodTypesParam(): { payment_method_types: ["card"] } | Record<string, never> {
  if (isStripeMockModeActive()) {
    return {};
  }
  return { payment_method_types: ["card"] };
}
