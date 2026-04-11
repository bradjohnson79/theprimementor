import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { formatPacificTime } from "@wisdom/utils";
import { api } from "../lib/api";
import { MENTORING_CIRCLE_SESSION_FALLBACK_ISO } from "../lib/mentoringCircleConstants";

interface MentoringCircleState {
  eventKey: string;
  eventTitle: string;
  sessionDate: string;
  timezone: string;
  posterPath: string;
  priceCents: number;
  registered: boolean;
  joinUrl: string | null;
}

const MENTORING_CIRCLE_POSTER_SRC = "/images/mentoring-circle-april-26.webp";

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function MentoringCircle() {
  const { getToken } = useAuth();
  const { user: dbUser, isLoading: loadingUser } = useCurrentUser();
  const [circleState, setCircleState] = useState<MentoringCircleState | null>(null);
  const [loadingCircle, setLoadingCircle] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [copied, setCopied] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const includesMentorCircle = dbUser?.member?.capabilities.includesMentorCircle === true;

  useEffect(() => {
    let cancelled = false;
    async function loadCircleState() {
      setLoadingCircle(true);
      try {
        const token = await getToken();
        const response = (await api.get("/mentoring-circle/me", token)) as { data: MentoringCircleState };
        if (!cancelled) {
          setCircleState(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load event details.");
        }
      } finally {
        if (!cancelled) {
          setLoadingCircle(false);
        }
      }
    }

    void loadCircleState();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const eventDateLabel = useMemo(() => {
    const iso = circleState?.sessionDate ?? MENTORING_CIRCLE_SESSION_FALLBACK_ISO;
    return formatPacificTime(iso);
  }, [circleState]);

  async function handleRegister() {
    setError(null);
    setSuccess(null);
    setRegistering(true);
    try {
      const token = await getToken();
      const response = (await api.post(
        "/mentoring-circle/register",
        {
          accessMode: includesMentorCircle ? "included" : "placeholder_paid",
        },
        token,
      )) as { data: MentoringCircleState };
      setCircleState(response.data);
      setSuccess("Registration confirmed. Your Zoom link is ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reserve your spot.");
    } finally {
      setRegistering(false);
    }
  }

  async function copyLink() {
    if (!circleState?.joinUrl) return;
    await navigator.clipboard.writeText(circleState.joinUrl);
    setCopied(true);
  }

  const ctaLabel = includesMentorCircle
    ? "Free Sign Up"
    : `Reserve Spot (${circleState ? formatPrice(circleState.priceCents) : "$25"})`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="px-6 py-10"
    >
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[28px] bg-gradient-to-br from-accent-cyan/25 via-violet-400/15 to-amber-300/25 p-[1px] shadow-[0_0_60px_rgba(99,102,241,0.12)]">
          <section className="glass-card rounded-[27px] p-6 sm:p-8">
            <div className="overflow-hidden rounded-2xl bg-black/20 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
              {posterFailed ? (
                <div className="aspect-[16/9] bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.24),transparent_35%),linear-gradient(135deg,#0b1020_0%,#141b35_50%,#1f1842_100%)] p-6">
                  <div className="flex h-full flex-col justify-end rounded-xl border border-white/10 bg-black/10 p-6 backdrop-blur-sm">
                    <span className="inline-flex w-fit rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-amber-100">
                      Live Event
                    </span>
                    <h1 className="mt-4 text-3xl font-semibold text-white">Mentoring Circle: The Prime Law</h1>
                    <p className="mt-2 text-sm text-white/70">{eventDateLabel}</p>
                  </div>
                </div>
              ) : (
                <img
                  src={MENTORING_CIRCLE_POSTER_SRC}
                  alt="Mentoring Circle Poster"
                  className="relative z-10 block aspect-[16/9] w-full object-cover"
                  onLoad={() => setPosterFailed(false)}
                  onError={() => setPosterFailed(true)}
                />
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-amber-100">
                  Sunday, April 26
                </div>
                <h2 className="mt-4 text-3xl font-semibold text-white">
                  {circleState?.eventTitle ?? "Mentoring Circle: The Prime Law"}
                </h2>
                <p className="mt-2 text-sm text-white/60">{eventDateLabel}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right text-sm text-white/65">
                <p className="text-xs uppercase tracking-wide text-white/40">Access</p>
                <p className="mt-2 font-medium text-white">
                  {includesMentorCircle ? "Included for Initiate" : `${formatPrice(circleState?.priceCents ?? 2500)} reservation`}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-base font-medium text-white">Beta Mind vs Prime Mind</h3>
                <p className="mt-3 text-sm text-white/70">
                  The difference between living in the Beta Mind vs the Prime Mind and what true manifestation is.
                </p>
              </section>
              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-base font-medium text-white">Blueprint Exploration</h3>
                <ul className="mt-3 space-y-2 text-sm text-white/70">
                  <li>Energetic and behavioral patterns revealed live with attendees</li>
                  <li>Where alignment or distortion is shaping results right now</li>
                </ul>
              </section>
              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-base font-medium text-white">Live Demonstration</h3>
                <ul className="mt-3 space-y-2 text-sm text-white/70">
                  <li>Real-time application of manifestation principles</li>
                  <li>How inner alignment changes outcomes without force</li>
                </ul>
              </section>
            </div>

            <p className="mt-6 text-sm text-white/70">
              This is our first Prime Mentor webinar. Sign up early for the opportunity to have your blueprint
              exploration shared in class. Register to unlock your ZOOM access and return here anytime to copy or
              join the event.
            </p>

            {error ? (
              <div className="mt-6 rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            {success ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-950/35 px-4 py-3 text-sm text-emerald-100"
              >
                {success}
              </motion.div>
            ) : null}

            <div className="mt-6">
              {loadingUser || loadingCircle ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/55">
                  Loading registration details...
                </div>
              ) : circleState?.registered ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-emerald-400/25 bg-emerald-950/25 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">You're Registered</h3>
                      <p className="mt-1 text-sm text-white/65">{eventDateLabel}</p>
                    </div>
                    <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-100">
                      Registered
                    </span>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-white/40">Zoom Join Link</p>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <a
                        href={circleState.joinUrl ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-sm text-accent-cyan hover:underline"
                      >
                        {circleState.joinUrl}
                      </a>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void copyLink()}
                          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/80 transition hover:bg-white/5"
                        >
                          <CopyIcon />
                          Copy Link
                        </button>
                        <a
                          href={circleState.joinUrl ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-lg bg-accent-cyan px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-accent-cyan/90"
                        >
                          Quick Join
                        </a>
                      </div>
                    </div>
                  </div>

                  {copied ? (
                    <div className="mt-3 inline-flex rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-1 text-xs font-medium text-accent-cyan">
                      Link Copied!
                    </div>
                  ) : null}
                </motion.div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-lg font-semibold text-white">
                    {includesMentorCircle ? "Initiate Access" : "Reserve Your Spot"}
                  </h3>
                  <p className="mt-2 text-sm text-white/65">
                    {includesMentorCircle
                      ? "Your Initiate tier includes complimentary access to this live event."
                      : "Reserve your place for this Mentoring Circle event. Payment is represented as a placeholder in this build, while registration and Zoom access are fully handled by the backend."}
                  </p>
                  <button
                    type="button"
                    disabled={registering}
                    onClick={() => void handleRegister()}
                    className="cosmic-motion mt-5 inline-flex items-center rounded-xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(255,215,0,0.18)] transition hover:scale-[1.01] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {registering ? "Preparing Access..." : ctaLabel}
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
