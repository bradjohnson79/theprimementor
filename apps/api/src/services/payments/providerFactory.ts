import type { PaymentProvider } from "./paymentProvider.js";
import { MockPaymentProvider } from "./mockPaymentProvider.js";
import { StripePaymentProvider } from "./stripePaymentProvider.js";

let cachedProvider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  cachedProvider =
    process.env.PAYMENT_PROVIDER === "stripe" ? new StripePaymentProvider() : new MockPaymentProvider();

  return cachedProvider;
}
