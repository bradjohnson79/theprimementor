export interface CreatePaymentIntentInput {
  paymentId: string;
  amountCents: number;
  currency: string;
  metadata?: Record<string, unknown> | null;
}

export interface ConfirmPaymentInput {
  paymentId: string;
  providerPaymentIntentId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface RefundPaymentInput {
  paymentId: string;
  providerPaymentIntentId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PaymentProviderResult {
  providerPaymentIntentId?: string | null;
  providerCustomerId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PaymentProvider {
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentProviderResult>;
  confirmPayment(input: ConfirmPaymentInput): Promise<PaymentProviderResult>;
  refundPayment(input: RefundPaymentInput): Promise<PaymentProviderResult>;
}
