import { api } from "./api";
import { startRegenerationOfferCheckout } from "./regenerationOffer";

interface CreateBookingResponse {
  success?: boolean;
  bookingId?: string;
  requiresPayment?: boolean;
}

export async function submitRegenerationOfferBooking(options: {
  token: string | null;
  payload: Record<string, unknown>;
}): Promise<{ bookingId: string }> {
  const bookingResponse = (await api.post(
    "/bookings",
    {
      ...options.payload,
      deferPaymentRecord: true,
    },
    options.token,
  )) as CreateBookingResponse;

  if (!bookingResponse.success || !bookingResponse.bookingId || bookingResponse.requiresPayment !== true) {
    throw new Error("Regeneration Q&A Package intake could not be saved. Please try again.");
  }

  await startRegenerationOfferCheckout(options.token, bookingResponse.bookingId);

  return { bookingId: bookingResponse.bookingId };
}
