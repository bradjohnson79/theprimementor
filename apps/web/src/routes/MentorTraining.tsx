import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import type { MentorTrainingPackageDefinition, MentorTrainingPackageType } from "@wisdom/utils";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { api } from "../lib/api";
import { startMentorTrainingCheckout } from "../lib/mentorTrainingCheckout";

interface MentorTrainingEligibilityData {
  isInitiate: boolean;
  hasCompletedMentoringSession: boolean;
  isEligible: boolean;
}

interface MentorTrainingPageData {
  eligibility: MentorTrainingEligibilityData;
  packages: MentorTrainingPackageDefinition[];
}

export default function MentorTraining() {
  const { getToken } = useAuth();
  const { tierState } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [pageData, setPageData] = useState<MentorTrainingPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingPackage, setSubmittingPackage] = useState<MentorTrainingPackageType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (tierState === "loading") {
      return;
    }

    if (tierState !== "initiate") {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, tierState]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkoutState = params.get("checkout");
    if (checkoutState === "success") {
      setSuccess("Payment confirmed. Your mentor training order is active and ready for the next step.");
      setNotice(null);
      setError(null);
      return;
    }
    if (checkoutState === "canceled") {
      setSuccess(null);
      setNotice("Payment failed or was cancelled. Your training order is safe, and you can retry anytime.");
      return;
    }

    setSuccess(null);
    setNotice(null);
  }, [location.search]);

  useEffect(() => {
    if (tierState !== "initiate") {
      return;
    }

    let cancelled = false;

    async function loadPageData() {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const response = (await api.get("/mentor-training", token)) as { data: MentorTrainingPageData };
        if (!cancelled) {
          setPageData(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          const nextError = err instanceof Error ? err.message : "Failed to load mentor training.";
          setError(nextError);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPageData();
    return () => {
      cancelled = true;
    };
  }, [getToken, tierState]);

  async function handlePurchase(packageType: MentorTrainingPackageType) {
    setSubmittingPackage(packageType);
    setError(null);
    try {
      const token = await getToken();
      await startMentorTrainingCheckout(packageType, {
        token,
        onAlreadyPaid: (trainingOrderId) => {
          const params = new URLSearchParams();
          params.set("checkout", "success");
          if (trainingOrderId) {
            params.set("trainingOrderId", trainingOrderId);
          }
          navigate(`/mentor-training?${params.toString()}`, { replace: true });
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start mentor training checkout.");
    } finally {
      setSubmittingPackage(null);
    }
  }

  if (tierState === "loading" || loading) {
    return (
      <div className="dashboard-shell">
        <div className="mx-auto max-w-5xl space-y-6">
          <section className="dashboard-panel">
            <div className="h-8 w-52 animate-pulse rounded bg-white/10" />
            <div className="mt-3 h-4 w-80 animate-pulse rounded bg-white/10" />
          </section>
          <section className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <article key={item} className="glass-card rounded-2xl p-6">
                <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
                <div className="mt-4 h-4 w-40 animate-pulse rounded bg-white/10" />
                <div className="mt-2 h-4 w-28 animate-pulse rounded bg-white/10" />
                <div className="mt-6 space-y-2">
                  {[0, 1, 2, 3].map((line) => (
                    <div key={line} className="h-3 w-full animate-pulse rounded bg-white/10" />
                  ))}
                </div>
              </article>
            ))}
          </section>
        </div>
      </div>
    );
  }

  const eligibility = pageData?.eligibility;
  const isEligible = eligibility?.isEligible === true;
  const packages = pageData?.packages ?? [];

  return (
    <div className="dashboard-shell">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="dashboard-panel">
          <h1 className="text-2xl font-semibold text-white">Mentor Training</h1>
          <p className="mt-2 text-sm text-white/70">
            Structured pathways for deeper integration, embodiment, and guided transformation.
          </p>
        </section>

        {success ? (
          <section className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-5 py-4 text-emerald-100">
            {success}
          </section>
        ) : null}
        {notice ? (
          <section className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-5 py-4 text-amber-100">
            {notice}
          </section>
        ) : null}
        {error ? (
          <section className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-5 py-4 text-rose-100">
            {error}
          </section>
        ) : null}

        <section
          className={`rounded-2xl border px-5 py-4 ${
            isEligible
              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
              : "border-rose-400/25 bg-rose-400/10 text-rose-100"
          }`}
        >
          <p className="text-sm font-semibold uppercase tracking-wide">
            {isEligible ? "Eligible" : "Not Yet Eligible"}
          </p>
          <p className="mt-2 text-sm">
            {isEligible
              ? "You have completed a Mentoring Session and can now apply for training packages."
              : "You must complete a Mentoring Session before applying for Mentor Training."}
          </p>
          {!isEligible ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-4">
              <p className="text-sm font-medium text-white">Complete a Mentoring Session to unlock Mentor Training</p>
              <Link
                to="/sessions/mentoring"
                className="dashboard-action-primary mt-3 bg-white hover:bg-white/90"
              >
                Book Mentoring Session
              </Link>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {packages.map((tier) => {
            const disabled = !isEligible || submittingPackage !== null;
            const isSubmitting = submittingPackage === tier.type;
            return (
              <article
                key={tier.type}
                className={`dashboard-panel cosmic-motion flex h-full transition ${
                  isEligible ? "" : "opacity-60"
                }`}
              >
                <div className="flex h-full flex-col">
                  <div>
                    <h2 className="text-lg font-medium text-white">{tier.title}</h2>
                    <p className="mt-2 text-base font-semibold text-white">{tier.durationLabel}</p>
                    <p className="mt-1 text-sm text-white/70">{tier.goalsLabel}</p>
                    <p className="mt-3 text-xl font-semibold text-white">{tier.priceLabel}</p>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/50">Includes</p>
                    <ul className="mt-3 space-y-2 text-sm text-white/70">
                      {tier.includes.map((line) => (
                        <li key={line}>- {line}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-6">
                    {isEligible ? (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => void handlePurchase(tier.type)}
                        className="dashboard-action-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSubmitting ? "Redirecting..." : `Purchase - ${tier.priceLabel}`}
                      </button>
                    ) : (
                      <p className="text-sm text-white/60">Complete a Mentoring Session to unlock this package.</p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
