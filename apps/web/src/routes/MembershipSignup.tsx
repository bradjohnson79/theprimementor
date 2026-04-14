import { useAuth } from "@clerk/react";
import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import MembershipPlanCard from "../components/membership/MembershipPlanCard";
import MentorTrainingTeaserCard from "../components/membership/MentorTrainingTeaserCard";
import {
  MEMBERSHIP_SIGNUP_PLANS,
  type MembershipSignupPlan,
  type MembershipSignupTierKey,
} from "../config/membershipSignupPlans";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { api } from "../lib/api";
import { trackEvent, trackEventOnce } from "../lib/analytics";
import { startMembershipCheckoutSession } from "../lib/membershipCheckout";

function resolveTierFromPath(pathname: string): MembershipSignupTierKey | null {
  if (pathname.endsWith("/seeker")) return "seeker";
  if (pathname.endsWith("/initiate")) return "initiate";
  return null;
}

interface MentorTrainingEligibilityData {
  isInitiate: boolean;
  hasCompletedMentoringSession: boolean;
  isEligible: boolean;
}

export default function MembershipSignup() {
  const { isSignedIn, isLoaded, getToken, userId } = useAuth();
  const { tierState, refetch } = useCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mentorTrainingEligibility, setMentorTrainingEligibility] = useState<MentorTrainingEligibilityData | null>(null);
  const [mentorTrainingLoading, setMentorTrainingLoading] = useState(false);
  const selectedTier = useMemo(() => resolveTierFromPath(location.pathname), [location.pathname]);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const checkoutState = searchParams.get("checkout");
    if (checkoutState === "success") {
      setError(null);
      setNotice("Finalizing your membership access...");
      return;
    }
    if (checkoutState === "canceled") {
      setNotice("Checkout canceled. Your pending membership is still ready if you want to try again.");
      return;
    }
    setNotice(null);
  }, [searchParams]);

  useEffect(() => {
    const checkoutState = searchParams.get("checkout");
    const membershipId = searchParams.get("membershipId");
    if (checkoutState !== "success" || !membershipId || !isLoaded || !isSignedIn) {
      return;
    }

    let cancelled = false;

    async function confirmMembership() {
      try {
        const token = await getToken();
        const response = (await api.post(`/member/subscriptions/${membershipId}/confirm`, undefined, token)) as {
          data?: { tier?: string; status?: string };
        };
        if (cancelled) {
          return;
        }
        refetch();
        const tierLabel = typeof response.data?.tier === "string"
          ? `${response.data.tier.charAt(0).toUpperCase()}${response.data.tier.slice(1)}`
          : "Membership";
        const tierKey = typeof response.data?.tier === "string" ? response.data.tier : selectedTier ?? "unknown";
        const trackingKey = `analytics:membership:${membershipId}`;
        trackEventOnce(trackingKey, "subscription_started", {
          source: "membership_signup_success",
          tier: tierKey,
        });
        trackEventOnce(`${trackingKey}:purchase`, "purchase", {
          source: "membership_signup_success",
          productType: "subscription",
          tier: tierKey,
        });
        setError(null);
        setNotice(`${tierLabel} membership is now active on your account.`);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setNotice("Payment confirmed. Membership access is still syncing.");
        setError(err instanceof Error ? err.message : "Membership confirmation could not be completed.");
      }
    }

    void confirmMembership();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, refetch, searchParams, selectedTier]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || tierState !== "initiate") {
      setMentorTrainingEligibility(null);
      setMentorTrainingLoading(false);
      return;
    }

    let cancelled = false;

    async function loadEligibility() {
      setMentorTrainingLoading(true);
      try {
        const token = await getToken();
        const response = (await api.get("/mentor-training", token)) as {
          data?: { eligibility?: MentorTrainingEligibilityData };
        };
        if (!cancelled) {
          setMentorTrainingEligibility(response.data?.eligibility ?? null);
        }
      } catch {
        if (!cancelled) {
          setMentorTrainingEligibility(null);
        }
      } finally {
        if (!cancelled) {
          setMentorTrainingLoading(false);
        }
      }
    }

    void loadEligibility();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, tierState]);

  const mentorTrainingState = useMemo<"locked" | "initiates_locked" | "eligible">(() => {
    if (tierState === "initiate") {
      return mentorTrainingEligibility?.isEligible ? "eligible" : "initiates_locked";
    }
    return "locked";
  }, [mentorTrainingEligibility?.isEligible, tierState]);

  const handleSelectPlan = useCallback(
    async (plan: MembershipSignupPlan) => {
      setError(null);
      trackEvent("cta_click", {
        source: "membership_signup_page",
        label: "membership_plan_select",
        tier: plan.tier,
      });

      if (!isLoaded) return;

      if (!isSignedIn) {
        const redirectPath = `/subscriptions/${plan.tier}`;
        navigate(
          `/sign-up?redirect_url=${encodeURIComponent(redirectPath)}&tier=${encodeURIComponent(plan.tier)}`,
        );
        return;
      }

      setBusyTier(plan.tier);
      try {
        await startMembershipCheckoutSession(plan.tier, { getToken, clerkUserId: userId ?? undefined });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Checkout could not start. Please try again.");
      } finally {
        setBusyTier(null);
      }
    },
    [getToken, isLoaded, isSignedIn, navigate, userId],
  );

  return (
    <div className="relative text-white">
      <section className="relative border-b border-white/8 px-6 pb-14 pt-10 sm:pt-14">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: "easeOut" }}
          >
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">Membership</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
              Choose Your Path Within Prime Mentor
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/62 sm:text-lg">
              Step into guided transformation with access to Divin8, advanced teachings, and a growing library of
              initiatory systems. Select the level that aligns with your current path.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          {!isLoaded ? (
            <p className="text-center text-sm text-white/50">Loading…</p>
          ) : !isSignedIn ? (
            <p className="mb-8 text-center text-sm text-white/55">
              Already have an account?{" "}
              <Link to="/sign-in" className="font-medium text-cyan-200/90 underline-offset-4 hover:text-cyan-100 hover:underline">
                Sign in
              </Link>{" "}
              to continue to checkout. New here? Choose a plan and you&apos;ll be guided to create an account first.
            </p>
          ) : null}

          {error ? (
            <div
              className="mb-8 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-100/95"
              role="alert"
            >
              {error}
            </div>
          ) : null}

      {notice ? (
        <div
          className="mb-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-100/95"
          role="status"
        >
          {notice}
        </div>
      ) : null}

          <div className="grid items-stretch gap-8 lg:grid-cols-2 lg:gap-10">
            {MEMBERSHIP_SIGNUP_PLANS.map((plan) => (
              <MembershipPlanCard
                key={plan.tier}
                plan={plan}
                onSelect={handleSelectPlan}
                busyTier={busyTier}
                selected={selectedTier === plan.tier}
              />
            ))}
          </div>
          <div className="mt-10">
            <MentorTrainingTeaserCard
              state={mentorTrainingState}
              isLoading={mentorTrainingLoading && tierState === "initiate"}
            />
          </div>
          <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-white/78 sm:mt-10 sm:text-sm">
            You are under no obligation and can cancel your membership at anytime.
          </p>
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-12 sm:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm leading-relaxed text-white/58 sm:text-base">
            Both plans include full access to the Prime Mentor ecosystem—your choice determines the depth, frequency, and
            level of mastery you wish to embody.
          </p>
        </div>
      </section>

      <section className="border-t border-white/8 px-6 pb-20 pt-12 sm:pb-24 sm:pt-16">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Not Sure Where to Start?</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/58 sm:text-base">
            Begin as a Seeker and upgrade anytime as your journey deepens. The path is designed to evolve with you.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/"
              className="w-full rounded-xl border border-white/14 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10 sm:w-auto"
            >
              Back to home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
