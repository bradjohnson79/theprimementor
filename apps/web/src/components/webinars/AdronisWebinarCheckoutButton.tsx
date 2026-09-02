import type React from "react";
import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import {
  ADRONIS_WEBINAR_AUTOCHECKOUT_PATH,
  ADRONIS_WEBINAR_EVENT_ID,
  ADRONIS_WEBINAR_THANK_YOU_PATH,
  ADRONIS_WEBINAR_TITLE,
} from "@wisdom/utils";
import { trackCtaClick } from "../../lib/analytics";
import { startWebinarCheckout } from "../../lib/webinarCheckout";

interface AdronisWebinarCheckoutButtonProps {
  source: string;
  owned?: boolean;
  registrationOpen?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  onError?: (message: string) => void;
}

export default function AdronisWebinarCheckoutButton({
  source,
  owned = false,
  registrationOpen = true,
  disabled = false,
  className,
  children,
  onError,
}: AdronisWebinarCheckoutButtonProps) {
  const { isSignedIn, getToken } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  const label = children
    ?? (owned ? "Access Webinar Registration" : starting ? "Opening Checkout..." : "Register");

  async function handleClick() {
    if (disabled || starting) {
      return;
    }

    trackCtaClick(owned ? "access_adronis_webinar" : "register_adronis_webinar", source, {
      href: owned ? ADRONIS_WEBINAR_THANK_YOU_PATH : ADRONIS_WEBINAR_AUTOCHECKOUT_PATH,
      title: ADRONIS_WEBINAR_TITLE,
      eventId: ADRONIS_WEBINAR_EVENT_ID,
    });

    if (owned) {
      navigate(ADRONIS_WEBINAR_THANK_YOU_PATH);
      return;
    }

    if (!registrationOpen) {
      onError?.("Registration for this webinar has closed.");
      return;
    }

    try {
      if (!isSignedIn) {
        trackCtaClick("adronis_webinar_authentication_required", source, {
          eventId: ADRONIS_WEBINAR_EVENT_ID,
        });
        navigate(`/sign-up?redirect_url=${encodeURIComponent(ADRONIS_WEBINAR_AUTOCHECKOUT_PATH)}`);
        return;
      }

      setStarting(true);
      trackCtaClick("adronis_webinar_checkout_started", source, {
        eventId: ADRONIS_WEBINAR_EVENT_ID,
      });
      const token = await getToken();
      await startWebinarCheckout(ADRONIS_WEBINAR_EVENT_ID, { token });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to open Stripe checkout.";
      if (/already been purchased|already been paid/i.test(message)) {
        navigate(ADRONIS_WEBINAR_THANK_YOU_PATH);
        return;
      }
      onError?.(message);
      setStarting(false);
    }
  }

  return (
    <button
      type="button"
      disabled={disabled || starting || (!owned && !registrationOpen)}
      onClick={() => void handleClick()}
      className={className}
    >
      {starting ? "Opening Checkout..." : label}
    </button>
  );
}
