import { useEffect, useState } from "react";
import { getRegenerationOfferStatus } from "@wisdom/utils";
import {
  fetchRegenerationOfferStatus,
  type RegenerationOfferStatus,
} from "../lib/regenerationOffer";

function getClientOfferStatus(): RegenerationOfferStatus {
  return getRegenerationOfferStatus();
}

export function useRegenerationOfferStatus() {
  // Seed from shared expiry rules so homepage/sessions promo can render even if the
  // status API is temporarily unavailable during deploy.
  const [status, setStatus] = useState<RegenerationOfferStatus | null>(() => getClientOfferStatus());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      setLoading(true);
      setError(null);
      try {
        const nextStatus = await fetchRegenerationOfferStatus();
        if (!cancelled) {
          setStatus(nextStatus);
        }
      } catch (err) {
        if (!cancelled) {
          // Keep client-side status for display; checkout still enforces server-side.
          setStatus(getClientOfferStatus());
          setError(err instanceof Error ? err.message : "Unable to load offer status.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, loading, error };
}
