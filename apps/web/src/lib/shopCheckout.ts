import { api } from "./api";

interface ShopCheckoutResponse {
  alreadyPaid?: boolean;
  requiresPayment?: boolean;
  url?: string | null;
  data?: {
    alreadyPaid?: boolean;
    requiresPayment?: boolean;
    url?: string | null;
  } | null;
}

export function shopPurchaseReturnPath(slug: string) {
  return `/shop/${slug}?purchase=1`;
}

export function shopCheckoutErrorMessage(error: unknown): string {
  const err = error as { message?: string; status?: number };
  if (err.status === 401) return "Please sign in to continue checkout.";
  if (typeof err.message === "string") {
    const message = err.message.trim();
    if (message && message.length <= 180 && !/stack|sql|ECONN|stripe\.com\/v1/i.test(message)) {
      return message;
    }
  }
  return "Checkout could not be started. Please try again or contact support.";
}

export async function startShopCheckout(
  productId: string,
  token: string | null,
  promoCode?: string | null,
): Promise<{ alreadyPaid: boolean }> {
  if (!token?.trim()) {
    const error = new Error("Please sign in to continue checkout.") as Error & { status?: number };
    error.status = 401;
    throw error;
  }
  const data = (await api.post("/shop/checkout", {
    productId,
    ...(promoCode?.trim() ? { promoCode: promoCode.trim() } : {}),
  }, token)) as ShopCheckoutResponse;
  if (data.alreadyPaid || data.data?.alreadyPaid) {
    return { alreadyPaid: true };
  }
  const url = [data.url, data.data?.url].find((value) => typeof value === "string" && value.trim())?.trim() ?? "";
  if (url.startsWith("https://checkout.stripe.com/")) {
    window.location.assign(url);
    return { alreadyPaid: false };
  }
  throw new Error("Checkout did not return a redirect URL. Please try again or contact support.");
}
