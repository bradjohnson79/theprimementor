import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { api } from "../lib/api";
import { REGENERATION_BOOKING_PATH } from "../lib/sessionLandingPaths";

export default function RegenerationSuccess() {
  const { getToken } = useAuth();
  const { refetch } = useCurrentUser();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Confirming your regeneration subscription...");

  useEffect(() => {
    const checkoutSessionId = searchParams.get("checkoutSessionId")?.trim();
    if (!checkoutSessionId) {
      setStatus("error");
      setMessage("Your checkout completed, but the confirmation details were missing. Please open your dashboard or try again.");
      return;
    }

    let cancelled = false;

    async function confirmRegeneration() {
      try {
        const token = await getToken();
        await api.post(
          "/member/regeneration-subscription/confirm",
          { checkoutSessionId },
          token,
        );
        if (cancelled) {
          return;
        }
        refetch();
        setStatus("success");
        setMessage("Your Regeneration Monthly Package is active and syncing into your dashboard now.");
      } catch (error) {
        if (cancelled) {
          return;
        }
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "We couldn't finish syncing your regeneration checkout.");
      }
    }

    void confirmRegeneration();
    return () => {
      cancelled = true;
    };
  }, [getToken, refetch, searchParams]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto max-w-3xl px-6 py-12"
    >
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white shadow-[0_0_32px_rgba(15,23,42,0.28)]">
        <h1 className="text-3xl font-bold tracking-tight text-white">Regeneration Monthly Package</h1>
        <p className="mt-3 text-sm leading-7 text-white/70">{message}</p>

        {status === "loading" ? (
          <p className="mt-5 text-sm text-cyan-200">Finalizing your secure checkout...</p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105"
          >
            Open Dashboard
          </Link>
          {status === "error" ? (
            <Link
              to={REGENERATION_BOOKING_PATH}
              className="inline-flex items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-white/85 transition hover:bg-white/5"
            >
              Return to Intake
            </Link>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
