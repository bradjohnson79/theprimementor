import type { MentorTrainingPackageType } from "@wisdom/utils";
import { api } from "./api";

interface MentorTrainingCheckoutResponse {
  url?: string | null;
  alreadyPaid?: boolean;
  trainingOrderId?: string;
}

export async function startMentorTrainingCheckout(
  packageType: MentorTrainingPackageType,
  options: {
    token: string | null;
    onAlreadyPaid?: (trainingOrderId: string | null) => void;
  },
): Promise<void> {
  const data = (await api.post(
    "/mentor-training/checkout",
    { packageType },
    options.token,
  )) as MentorTrainingCheckoutResponse;

  if (data?.alreadyPaid) {
    options.onAlreadyPaid?.(typeof data.trainingOrderId === "string" ? data.trainingOrderId : null);
    return;
  }

  const url = typeof data?.url === "string" ? data.url.trim() : "";
  if (url) {
    window.location.assign(url);
    return;
  }

  throw new Error(
    "Checkout did not return a redirect URL. Confirm the mentor training Stripe price IDs are configured.",
  );
}
