import type React from "react";
import { useAuth } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import { REGENERATION_OFFER_BOOKING_PATH } from "@wisdom/utils";
import { trackCtaClick } from "../../lib/analytics";

interface RegenerationOfferCheckoutButtonProps {
  source: string;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  onError?: (message: string) => void;
}

export default function RegenerationOfferCheckoutButton({
  source,
  disabled = false,
  className,
  children = "Order Now",
  onError,
}: RegenerationOfferCheckoutButtonProps) {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();

  function handleClick() {
    if (disabled) {
      return;
    }

    trackCtaClick("order_regeneration_offer", source, {
      href: REGENERATION_OFFER_BOOKING_PATH,
      title: "Regeneration Q&A Package",
    });

    try {
      if (!isSignedIn) {
        navigate(`/sign-up?redirect_url=${encodeURIComponent(REGENERATION_OFFER_BOOKING_PATH)}`);
        return;
      }

      navigate(REGENERATION_OFFER_BOOKING_PATH);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start intake.";
      onError?.(message);
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={className}
    >
      {children}
    </button>
  );
}
