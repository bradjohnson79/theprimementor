import type {
  ConfirmPaymentInput,
  CreatePaymentIntentInput,
  PaymentProvider,
  PaymentProviderResult,
  RefundPaymentInput,
} from "./paymentProvider.js";

function buildMockIntentId(paymentId: string) {
  return `mock_pi_${paymentId.replace(/-/g, "")}`;
}

export class MockPaymentProvider implements PaymentProvider {
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentProviderResult> {
    return {
      providerPaymentIntentId: buildMockIntentId(input.paymentId),
      metadata: {
        mock: true,
        stage: "create_payment_intent",
      },
    };
  }

  async confirmPayment(input: ConfirmPaymentInput): Promise<PaymentProviderResult> {
    return {
      providerPaymentIntentId: input.providerPaymentIntentId ?? buildMockIntentId(input.paymentId),
      metadata: {
        mock: true,
        stage: "confirm_payment",
      },
    };
  }

  async refundPayment(input: RefundPaymentInput): Promise<PaymentProviderResult> {
    return {
      providerPaymentIntentId: input.providerPaymentIntentId ?? buildMockIntentId(input.paymentId),
      metadata: {
        mock: true,
        stage: "refund_payment",
      },
    };
  }
}
