import type React from "react";
import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import {
  ADRONIS_ON_DEMAND_WEBINAR_ID,
  formatOnDemandWebinarPrice,
  getOnDemandWebinarById,
} from "@wisdom/utils";
import { trackCtaClick } from "../../lib/analytics";
import { startOnDemandWebinarCheckout } from "../../lib/onDemandWebinarApi";

interface OnDemandWebinarCheckoutButtonProps {
  source: string;
  webinarId?: string;
  owned?: boolean;
  saleable?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  onError?: (message: string) => void;
}

export default function OnDemandWebinarCheckoutButton({
  source,
  webinarId = ADRONIS_ON_DEMAND_WEBINAR_ID,
  owned = false,
  saleable = false,
  disabled = false,
  className,
  children,
  onError,
}: OnDemandWebinarCheckoutButtonProps) {
  const { isSignedIn, getToken } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const webinar = getOnDemandWebinarById(webinarId);
  const autocheckoutPath = webinar?.autocheckoutPath ?? "/";
  const playerPath = webinar?.playerPath ?? `/dashboard/webinars/${webinarId}`;
  const title = webinar?.title ?? "On-demand webinar";
  const priceLabel = webinar
    ? formatOnDemandWebinarPrice(webinar.priceCents, webinar.currency)
    : "$7.99 CAD";

  const label = children
    ?? (owned ? "Watch Now" : starting ? "Opening Checkout..." : `Watch On Demand — ${priceLabel}`);

  async function handleClick() {
    if (disabled || starting) {
      return;
    }

    trackCtaClick(owned ? "watch_on_demand_webinar" : "buy_on_demand_webinar", source, {
      href: owned ? playerPath : autocheckoutPath,
      title,
      webinarId,
    });

    if (owned) {
      navigate(playerPath);
      return;
    }

    if (!isSignedIn) {
      trackCtaClick("on_demand_webinar_authentication_required", source, { webinarId });
      navigate(`/sign-up?redirect_url=${encodeURIComponent(autocheckoutPath)}`);
      return;
    }

    if (!saleable) {
      onError?.("This on-demand webinar is not available for purchase yet.");
      return;
    }

    try {
      setStarting(true);
      trackCtaClick("on_demand_webinar_checkout_started", source, { webinarId });
      const token = await getToken();
      await startOnDemandWebinarCheckout(webinarId, { token });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to open Stripe checkout.";
      if (/already been purchased|already been paid/i.test(message)) {
        navigate(playerPath);
        return;
      }
      onError?.(message);
      setStarting(false);
    }
  }

  return (
    <button
      type="button"
      disabled={disabled || starting || (isSignedIn && !owned && !saleable)}
      onClick={() => void handleClick()}
      className={className}
    >
      {starting ? "Opening Checkout..." : label}
    </button>
  );
}
