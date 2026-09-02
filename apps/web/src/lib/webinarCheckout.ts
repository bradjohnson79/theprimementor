import { api } from "./api";

interface CreateCheckoutSessionResponse {
  sessionId?: string;
  url?: string | null;
}

export async function startWebinarCheckout(
  eventId: string,
  options: { token: string | null },
): Promise<void> {
  const payload = await api.post(
    "/create-checkout-session",
    { type: "webinar", eventId },
    options.token,
  ) as CreateCheckoutSessionResponse & { data?: CreateCheckoutSessionResponse };

  const url = (typeof payload?.data?.url === "string" ? payload.data.url : payload?.url)?.trim() ?? "";
  if (url) {
    window.location.assign(url);
    return;
  }

  throw new Error(
    "Checkout did not return a redirect URL. Confirm STRIPE_SECRET_KEY and create-checkout-session are configured.",
  );
}
