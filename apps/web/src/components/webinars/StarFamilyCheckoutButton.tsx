import type React from "react";
import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import {
  STAR_FAMILY_WEBINAR_AUTOCHECKOUT_PATH,
  STAR_FAMILY_WEBINAR_EVENT_ID,
  STAR_FAMILY_WEBINAR_THANK_YOU_PATH,
} from "@wisdom/utils";
import { trackEvent } from "../../lib/analytics";
import { startWebinarCheckout } from "../../lib/webinarCheckout";

interface StarFamilyCheckoutButtonProps {
  source: string;
  placement: "homepage_primary" | "landing_page";
  owned?: boolean;
  registrationOpen?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  onError?: (message: string) => void;
}

export default function StarFamilyCheckoutButton({
  source,
  placement,
  owned = false,
  registrationOpen = true,
  disabled = false,
  className,
  children,
  onError,
}: StarFamilyCheckoutButtonProps) {
  const { isSignedIn, getToken } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const label = children ?? (starting ? "Opening Checkout..." : "Register Now — $14.99 CAD");

  async function handleClick() {
    if (disabled || starting) return;
    const properties = {
      webinar_id: STAR_FAMILY_WEBINAR_EVENT_ID,
      webinar_type: "live_webinar",
      placement,
      price_cents: 1499,
      currency: "CAD",
      source,
    };
    trackEvent("webinar_registration_started", properties);

    if (owned) {
      navigate(STAR_FAMILY_WEBINAR_THANK_YOU_PATH);
      return;
    }
    if (!registrationOpen) {
      onError?.("Registration for this webinar has closed.");
      return;
    }
    if (!isSignedIn) {
      navigate(`/sign-up?redirect_url=${encodeURIComponent(STAR_FAMILY_WEBINAR_AUTOCHECKOUT_PATH)}`);
      return;
    }

    try {
      setStarting(true);
      trackEvent("webinar_checkout_started", properties);
      const token = await getToken();
      await startWebinarCheckout(STAR_FAMILY_WEBINAR_EVENT_ID, { token });
      trackEvent("webinar_checkout_created", properties);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to open Stripe checkout.";
      if (/already been purchased|already been paid/i.test(message)) {
        navigate(STAR_FAMILY_WEBINAR_THANK_YOU_PATH);
        return;
      }
      onError?.(message);
      setStarting(false);
    }
  }

  return (
    <button type="button" className={className} disabled={disabled || starting || !registrationOpen} onClick={() => void handleClick()}>
      {label}
    </button>
  );
}
