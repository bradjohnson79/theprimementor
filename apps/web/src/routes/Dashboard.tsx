import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/react";
import { Link, useSearchParams } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { formatPacificDateOnly } from "@wisdom/utils";
import { api } from "../lib/api";
import { MENTORING_CIRCLE_SESSION_FALLBACK_ISO } from "../lib/mentoringCircleConstants";

interface BookingSummary {
  id: string;
  status: "pending_payment" | "paid" | "scheduled" | "completed" | "cancelled";
  start_time_utc: string | null;
}

interface MemberReportSummary {
  id: string;
  member_status: "pending_payment" | "paid" | "fulfilled";
}

interface MemberReportsListData {
  pending: MemberReportSummary[];
  completed: MemberReportSummary[];
  counts: {
    total: number;
    pending: number;
    completed: number;
  };
}

interface MentoringCircleState {
  eventTitle: string;
  sessionDate: string;
  timezone: string;
  registered: boolean;
  joinUrl: string | null;
}

function getDashboardGreetingName(user: {
  username: string | null;
  firstName: string | null;
  fullName: string | null;
} | null | undefined) {
  const username = user?.username?.trim();
  if (username) return username;

  const firstName = user?.firstName?.trim();
  if (firstName) return firstName;

  const fullName = user?.fullName?.trim();
  if (fullName) return fullName;

  return "Member";
}

export default function Dashboard() {
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const { user: dbUser, isLoading, tierState, refetch } = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statsLoading, setStatsLoading] = useState(true);
  const [upcomingSessions, setUpcomingSessions] = useState(0);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [reportsOrdered, setReportsOrdered] = useState(0);
  const [reportsPending, setReportsPending] = useState(0);
  const [mentoringCircle, setMentoringCircle] = useState<MentoringCircleState | null>(null);
  const [copiedCircleLink, setCopiedCircleLink] = useState(false);

  const memberTier = tierState;
  const usage = dbUser?.member?.usage;
  const capabilities = dbUser?.member?.capabilities;
  const greetingName = getDashboardGreetingName(clerkUser);
  const isTierLoading = memberTier === "loading";
  const isFree = memberTier === "free";
  const hasUnlimitedChat = capabilities?.unlimitedChat === true;
  const upgradeTarget = isFree ? "/subscriptions/seeker" : memberTier === "seeker" ? "/subscriptions/initiate" : null;
  const upgradeLabel = isFree ? "Upgrade" : "Upgrade to Initiate";
  const sessionSummary = useMemo(() => {
    if (statsLoading) return "Loading session stats...";
    if (upcomingSessions > 0) {
      return `${upcomingSessions} upcoming ${upcomingSessions === 1 ? "session" : "sessions"}`;
    }
    return "No upcoming sessions";
  }, [statsLoading, upcomingSessions]);
  const reportSummary = useMemo(() => {
    if (statsLoading) return "Loading report stats...";
    if (reportsOrdered > 0) {
      return `${reportsOrdered} report${reportsOrdered === 1 ? "" : "s"} ordered`;
    }
    return "No reports yet";
  }, [reportsOrdered, statsLoading]);

  useEffect(() => {
    if (!copiedCircleLink) return;
    const timeout = window.setTimeout(() => setCopiedCircleLink(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copiedCircleLink]);

  useEffect(() => {
    if (searchParams.get("success") !== "true") {
      return;
    }

    refetch();
    const next = new URLSearchParams(searchParams);
    next.delete("success");
    next.delete("tier");
    setSearchParams(next, { replace: true });
  }, [refetch, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      setStatsLoading(true);
      try {
        const token = await getToken();
        const [bookingsResponse, reportsResponse, circleResponse] = await Promise.all([
          api.get("/bookings", token) as Promise<{ data: BookingSummary[] }>,
          api.get("/member/reports", token) as Promise<{ data: MemberReportsListData }>,
          api.get("/mentoring-circle/me", token) as Promise<{ data: MentoringCircleState }>,
        ]);

        if (cancelled) return;

        const now = Date.now();
        const upcoming = bookingsResponse.data.filter((booking) =>
          booking.start_time_utc
          && booking.status !== "cancelled"
          && booking.status !== "completed"
          && new Date(booking.start_time_utc).getTime() > now
        ).length;
        const completed = bookingsResponse.data.filter((booking) => booking.status === "completed").length;
        setUpcomingSessions(upcoming);
        setCompletedSessions(completed);
        setReportsOrdered(reportsResponse.data.counts.total);
        setReportsPending(reportsResponse.data.counts.pending);
        setMentoringCircle(circleResponse.data);
      } catch {
        if (!cancelled) {
          setUpcomingSessions(0);
          setCompletedSessions(0);
          setReportsOrdered(0);
          setReportsPending(0);
          setMentoringCircle(null);
        }
      } finally {
        if (!cancelled) {
          setStatsLoading(false);
        }
      }
    }

    void loadStats();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  async function copyMentoringCircleLink() {
    if (!mentoringCircle?.joinUrl) return;
    await navigator.clipboard.writeText(mentoringCircle.joinUrl);
    setCopiedCircleLink(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="dashboard-shell"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Member Dashboard</h1>
            <p className="mt-1 text-sm text-white/60">Hi {greetingName}! Here is your overview and quick actions.</p>
          </div>
          {isTierLoading ? (
            <div className="h-10 w-28 animate-pulse rounded-xl bg-white/10" aria-hidden="true" />
          ) : isFree ? (
            <Link
              to="/subscriptions/seeker"
              className="dashboard-action-upgrade upgrade-btn w-full sm:w-auto"
            >
              <span className="relative z-10 flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
                  <path d="M2 12h12L13 5l-3 3-2-4-2 4-3-3-1 7z" fill="currentColor" />
                  <rect x="2" y="12" width="12" height="2" rx="0.5" fill="currentColor" />
                </svg>
                Upgrade
              </span>
            </Link>
          ) : (
            <Link
              to="/dashboard/divin8"
              className="dashboard-action-primary w-full sm:w-auto"
            >
              Open Divin8 Chat
            </Link>
          )}
        </div>

        {isLoading || isTierLoading ? (
          <div className="dashboard-panel text-sm text-white/60">Loading dashboard...</div>
        ) : (
          <div className="space-y-4">
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="dashboard-stat-card">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Upcoming Sessions</p>
                <p className="mt-3 text-2xl font-semibold text-white">{statsLoading ? "..." : upcomingSessions}</p>
              </div>
              <div className="dashboard-stat-card">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Sessions Completed</p>
                <p className="mt-3 text-2xl font-semibold text-white">{statsLoading ? "..." : completedSessions}</p>
              </div>
              <div className="dashboard-stat-card">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Reports Ordered</p>
                <p className="mt-3 text-2xl font-semibold text-white">{statsLoading ? "..." : reportsOrdered}</p>
              </div>
              <div className="dashboard-stat-card">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Reports Pending</p>
                <p className="mt-3 text-2xl font-semibold text-white">{statsLoading ? "..." : reportsPending}</p>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <section className="dashboard-panel cosmic-motion">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Divin8</h2>
              <p className="mt-3 text-lg font-semibold text-white">
                {isFree ? "Free Tier" : memberTier === "initiate" ? "Initiate" : "Seeker"}
              </p>
              <p className="mt-1 text-sm text-white/60">
                {isFree
                  ? "Upgrade to unlock the full Divin8 chat experience."
                  : hasUnlimitedChat
                    ? "Unlimited prompts available."
                    : `${usage?.used ?? 0} / ${usage?.limit ?? 150} prompts used`}
              </p>
              <div className="mt-4 flex gap-2">
                {!isFree ? (
                  <Link to="/dashboard/divin8" className="dashboard-action-primary cosmic-motion">
                    Open Chat
                  </Link>
                ) : null}
                {upgradeTarget ? (
                  <Link to={upgradeTarget} className="dashboard-action-upgrade upgrade-btn">
                    <span className="relative z-10 flex items-center gap-1.5">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
                        <path d="M2 12h12L13 5l-3 3-2-4-2 4-3-3-1 7z" fill="currentColor" />
                        <rect x="2" y="12" width="12" height="2" rx="0.5" fill="currentColor" />
                      </svg>
                      {upgradeLabel}
                    </span>
                  </Link>
                ) : null}
              </div>
            </section>

            <section className="dashboard-panel cosmic-motion">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Sessions</h2>
              <p className="mt-3 text-lg font-semibold text-white">{sessionSummary}</p>
              <p className="mt-1 text-sm text-white/60">Book your next Prime Mentor session.</p>
              <Link to="/sessions" className="dashboard-action-primary cosmic-motion mt-4">
                Book Session
              </Link>
            </section>

            <section className="dashboard-panel cosmic-motion">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Reports</h2>
              <p className="mt-3 text-lg font-semibold text-white">{reportSummary}</p>
              <p className="mt-1 text-sm text-white/60">Access existing reports or order a new one.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to="/reports"
                  className="dashboard-action-upgrade gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
                    <path d="M2 12h12L13 5l-3 3-2-4-2 4-3-3-1 7z" fill="currentColor" />
                    <rect x="2" y="12" width="12" height="2" rx="0.5" fill="currentColor" />
                  </svg>
                  Buy Report
                </Link>
                <Link to="/reports" className="dashboard-action-secondary cosmic-motion">
                View Reports
                </Link>
              </div>
            </section>

            <section className="dashboard-panel cosmic-motion">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Mentoring</h2>
              <p className="mt-3 text-lg font-semibold text-white">
                {memberTier === "initiate" ? "Mentor Training available" : "Mentoring Session required"}
              </p>
              <p className="mt-1 text-sm text-white/60">
                {memberTier === "initiate"
                  ? "Track your mentor training progress and next steps."
                  : "Complete a Mentoring Session and maintain Initiate access to unlock Mentor Training."}
              </p>
              <Link
                to={memberTier === "initiate" ? "/mentor-training" : "/sessions/mentoring"}
                className="dashboard-action-secondary cosmic-motion mt-4"
              >
                {memberTier === "initiate" ? "Start Path" : "Book Mentoring Session"}
              </Link>
            </section>

            <section className="dashboard-panel cosmic-motion">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Mentoring Circle</h2>
              {mentoringCircle?.registered ? (
                <>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {mentoringCircle.eventTitle}:{" "}
                    {formatPacificDateOnly(
                      mentoringCircle.sessionDate ?? MENTORING_CIRCLE_SESSION_FALLBACK_ISO,
                    )}
                  </p>
                  <p className="mt-1 text-sm text-white/60">Status: Registered</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void copyMentoringCircleLink()}
                      className="cosmic-motion rounded-md border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                    >
                      Copy Link
                    </button>
                    <a
                      href={mentoringCircle.joinUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="cosmic-motion rounded-md bg-accent-cyan px-3 py-2 text-sm font-medium text-slate-950 hover:bg-accent-cyan/90"
                    >
                      Quick Join
                    </a>
                  </div>
                  {copiedCircleLink ? <p className="mt-2 text-xs text-accent-cyan">Link Copied!</p> : null}
                </>
              ) : (
                <>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {mentoringCircle
                      ? `Mentoring Circle: ${formatPacificDateOnly(
                        mentoringCircle.sessionDate ?? MENTORING_CIRCLE_SESSION_FALLBACK_ISO,
                      )}`
                      : "No event scheduled"}
                  </p>
                  <p className="mt-1 text-sm text-white/60">Join upcoming circles and replay available sessions.</p>
                  <Link to="/mentoring-circle" className="cosmic-motion mt-4 inline-block rounded-md border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/5">
                    View Circle
                  </Link>
                </>
              )}
            </section>
          </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
