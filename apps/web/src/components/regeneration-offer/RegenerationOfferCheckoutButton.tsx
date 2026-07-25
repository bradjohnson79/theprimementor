import { useState } from "react";
import type React from "react";
import { useAuth } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import { trackCtaClick, trackEvent } from "../../lib/analytics";
import {
  REGENERATION_OFFER_ROUTE,
  startRegenerationOfferCheckout,
} from "../../lib/regenerationOffer";

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
  const { isSignedIn, getToken } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    if (disabled || submitting) {
      return;
    }

    trackCtaClick("order_regeneration_offer", source, {
      href: REGENERATION_OFFER_ROUTE,
      title: "Regeneration Q&A Package",
    });

    if (!isSignedIn) {
      navigate(`/sign-up?redirect_url=${encodeURIComponent(REGENERATION_OFFER_ROUTE)}`);
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      trackEvent("cta_click", {
        source,
        label: "regeneration_offer_checkout_initiated",
      });
      await startRegenerationOfferCheckout(token);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Unable to start checkout.";
      const looksLikeInternalDbError = /failed query|insert into|select |update |delete from|enum/i.test(raw);
      const message = looksLikeInternalDbError
        ? "Unable to start checkout right now. Please try again in a moment."
        : raw;
      onError?.(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      disabled={disabled || submitting}
      onClick={() => void handleClick()}
      className={className}
    >
      {submitting ? "Redirecting..." : children}
    </button>
  );
}
