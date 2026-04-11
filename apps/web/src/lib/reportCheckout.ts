import { api } from "./api";

interface CreateCheckoutSessionResponse {
  sessionId?: string;
  url?: string | null;
}

export async function startReportCheckout(
  reportId: string,
  options: {
    token: string | null;
  },
): Promise<void> {
  const data = (await api.post(
    "/create-checkout-session",
    { type: "report", reportId },
    options.token,
  )) as CreateCheckoutSessionResponse;

  const url = typeof data?.url === "string" ? data.url.trim() : "";
  if (url) {
    window.location.assign(url);
    return;
  }

  throw new Error(
    "Checkout did not return a redirect URL. Confirm STRIPE_SECRET_KEY and create-checkout-session are configured.",
  );
}
