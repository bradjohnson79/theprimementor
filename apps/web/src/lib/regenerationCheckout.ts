import { api } from "./api";

interface RegenerationCheckoutResponse {
  sessionId?: string;
  url?: string | null;
}

export async function startRegenerationCheckoutSession(options: {
  token: string | null;
}): Promise<void> {
  const data = (await api.post(
    "/member/regeneration-subscription/checkout",
    {},
    options.token,
  )) as RegenerationCheckoutResponse;

  const url = typeof data?.url === "string" ? data.url.trim() : "";
  if (url) {
    window.location.assign(url);
    return;
  }

  throw new Error(
    "Checkout did not return a redirect URL. Confirm Stripe pricing and regeneration checkout are configured.",
  );
}
