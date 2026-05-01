import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import { startRegenerationCheckoutSession } from "../lib/regenerationCheckout";

export default function RegenerationCheckoutStart() {
  const { getToken } = useAuth();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function launchCheckout() {
      setBusy(true);
      setError(null);
      try {
        const token = await getToken();
        if (cancelled) {
          return;
        }
        await startRegenerationCheckoutSession({ token });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Regeneration checkout could not be started.");
          setBusy(false);
        }
      }
    }

    void launchCheckout();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="dashboard-shell"
    >
      <div className="mx-auto max-w-3xl">
        <div className="dashboard-panel">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Starting your regeneration cycle</h1>
          <p className="mt-3 text-sm leading-7 text-white/65">
            You are being redirected to Stripe to begin the Regeneration Monthly Package.
          </p>
          {busy ? (
            <p className="mt-4 text-sm text-cyan-200">Redirecting to secure checkout...</p>
          ) : null}
          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
              {error}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-4 inline-flex rounded-lg border border-white/10 px-3 py-2 text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                Try Again
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
