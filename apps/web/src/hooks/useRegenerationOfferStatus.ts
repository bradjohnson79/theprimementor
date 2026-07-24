import { useEffect, useState } from "react";
import {
  fetchRegenerationOfferStatus,
  type RegenerationOfferStatus,
} from "../lib/regenerationOffer";

export function useRegenerationOfferStatus() {
  const [status, setStatus] = useState<RegenerationOfferStatus | null>(null);
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
