import { api } from "./api";

export type CheckoutSyncEntityType = "session" | "report" | "mentoring_circle" | "mentor_training";

interface CheckoutSessionSyncInput {
  checkoutSessionId?: string | null;
  entityType?: CheckoutSyncEntityType;
  entityId?: string | null;
  token: string | null;
}

interface CheckoutSessionSyncResponse {
  synchronized?: boolean;
  paymentStatus?: string | null;
  mode?: string | null;
  reason?: string;
}

export async function syncOwnedCheckoutSession(input: CheckoutSessionSyncInput) {
  const body = input.checkoutSessionId
    ? { checkoutSessionId: input.checkoutSessionId }
    : {
        entityType: input.entityType,
        entityId: input.entityId,
      };

  return (await api.post(
    "/checkout-session/sync",
    body,
    input.token,
  )) as CheckoutSessionSyncResponse;
}
