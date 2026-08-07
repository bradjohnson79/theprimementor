import type React from "react";
import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import { trackCtaClick } from "../../lib/analytics";
import { startMentoringCircleCheckout } from "../../lib/mentoringCircleCheckout";

const MENTORING_CIRCLE_EVENT_ID = "2026-08-16";
const MENTORING_CIRCLE_AUTOCHECKOUT_PATH = `/mentoring-circle?eventId=${encodeURIComponent(MENTORING_CIRCLE_EVENT_ID)}&autocheckout=1`;

interface MentoringCircleCheckoutButtonProps {
  source: string;
  eventId?: string;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  onError?: (message: string) => void;
}

export default function MentoringCircleCheckoutButton({
  source,
  eventId = MENTORING_CIRCLE_EVENT_ID,
  disabled = false,
  className,
  children = "Reserve Your Spot",
  onError,
}: MentoringCircleCheckoutButtonProps) {
  const { isSignedIn, getToken } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  async function handleClick() {
    if (disabled || starting) {
      return;
    }

    trackCtaClick("reserve_mentoring_circle", source, {
      href: MENTORING_CIRCLE_AUTOCHECKOUT_PATH,
      title: "Mentoring Circle August 16",
      eventId,
    });

    try {
      if (!isSignedIn) {
        navigate(`/sign-up?redirect_url=${encodeURIComponent(MENTORING_CIRCLE_AUTOCHECKOUT_PATH)}`);
        return;
      }

      setStarting(true);
      const token = await getToken();
      await startMentoringCircleCheckout(eventId, { token });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to open Stripe checkout.";
      onError?.(message);
      setStarting(false);
    }
  }

  return (
    <button
      type="button"
      disabled={disabled || starting}
      onClick={() => void handleClick()}
      className={className}
    >
      {starting ? "Opening Checkout..." : children}
    </button>
  );
}
