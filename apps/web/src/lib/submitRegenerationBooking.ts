import { api } from "./api";
import { startRegenerationCheckoutSession } from "./regenerationCheckout";

interface CreateBookingResponse {
  success?: boolean;
  bookingId?: string;
  requiresPayment?: boolean;
}

export async function submitRegenerationBooking(options: {
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
    throw new Error("Regeneration intake could not be saved. Please try again.");
  }

  await startRegenerationCheckoutSession({
    token: options.token,
    bookingId: bookingResponse.bookingId,
  });

  return { bookingId: bookingResponse.bookingId };
}
