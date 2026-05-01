import { api } from "./api";
import { resolveApiUrl } from "./apiBase";

interface RegenerationCheckoutResponse {
  sessionId?: string;
  url?: string | null;
  data?: {
    sessionId?: string;
    url?: string | null;
  } | null;
  result?: {
    sessionId?: string;
    url?: string | null;
  } | null;
}

export async function startRegenerationCheckoutSession(options: {
  token: string | null;
  bookingId?: string | null;
}): Promise<void> {
  const checkoutPath = "/member/regeneration-subscription/checkout";

  try {
    const response = (await api.post(
      checkoutPath,
      options.bookingId ? { bookingId: options.bookingId } : {},
      options.token,
    )) as RegenerationCheckoutResponse;

    const checkoutUrl = [
      response?.url,
      response?.data?.url,
      response?.result?.url,
    ].find((value) => typeof value === "string" && value.trim().length > 0)?.trim();

    if (checkoutUrl) {
      window.location.assign(checkoutUrl);
      return;
    }
  } catch (error) {
    const checkoutError = error as Error & { status?: number; code?: string };
    const isRouteNotLiveYet = checkoutError.status === 404
      && checkoutError.message.toLowerCase().includes("route not found");

    if (import.meta.env.DEV) {
      console.error("[regeneration-checkout] failed to start checkout", {
        path: resolveApiUrl(checkoutPath),
        status: checkoutError.status,
        code: checkoutError.code,
        message: checkoutError.message,
      });
    }

    if (isRouteNotLiveYet) {
      throw new Error("The checkout service is not available yet. Please try again shortly.");
    }

    throw checkoutError;
  }

  throw new Error(
    "Checkout session was created, but no checkout URL was returned.",
  );
}
