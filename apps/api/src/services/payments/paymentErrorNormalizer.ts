export interface NormalizedPaymentFailure {
  code: string | null;
  rawMessage: string | null;
  normalizedMessage: string;
}

export function normalizePaymentFailure(
  code: string | null | undefined,
  rawMessage: string | null | undefined,
): NormalizedPaymentFailure {
  const normalizedCode = code?.trim() || null;
  switch (normalizedCode) {
    case "card_declined":
      return {
        code: normalizedCode,
        rawMessage: rawMessage?.trim() || null,
        normalizedMessage: "Card was declined",
      };
    case "insufficient_funds":
      return {
        code: normalizedCode,
        rawMessage: rawMessage?.trim() || null,
        normalizedMessage: "Insufficient funds",
      };
    case "authentication_required":
      return {
        code: normalizedCode,
        rawMessage: rawMessage?.trim() || null,
        normalizedMessage: "Authentication required (3D Secure)",
      };
    case "expired_card":
      return {
        code: normalizedCode,
        rawMessage: rawMessage?.trim() || null,
        normalizedMessage: "Card has expired",
      };
    default:
      return {
        code: normalizedCode,
        rawMessage: rawMessage?.trim() || null,
        normalizedMessage: "Payment failed. Please try another method.",
      };
  }
}
