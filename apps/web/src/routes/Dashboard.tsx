import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/react";
import { Link, useSearchParams } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { formatPacificDateOnly } from "@wisdom/utils";
import { api } from "../lib/api";
import { syncOwnedCheckoutSession, type CheckoutSyncEntityType } from "../lib/checkoutSessionSync";
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

interface MentoringCircleEventState {
  eventId: string;
  eventTitle: string;
  sessionDate: string;
  timezone: string;
  bookingId: string | null;
  paymentStatus: string | null;
  purchaseStatus: "not_started" | "pending_payment" | "confirmed";
  joinEligible: boolean;
  registered: boolean;
  joinUrl: string | null;
}

interface MentoringCircleState {
  currentEvent: MentoringCircleEventState | null;
  nextEvent: MentoringCircleEventState | null;
  activeEventForPurchase: MentoringCircleEventState | null;
  requestedEvent: MentoringCircleEventState | null;
}

interface MemberRecordingSummary {
  orderId: string;
  orderNumber: string;
  sessionDate: string | null;
  recordingLink: string;
  createdAt: string;
}

function collectPendingSyncTargets(
  bookingsData: BookingSummary[],
  reportsData: MemberReportsListData,
  circleData: MentoringCircleState | null,
): Array<{ entityType: CheckoutSyncEntityType; entityId: string }> {
  const targets: Array<{ entityType: CheckoutSyncEntityType; entityId: string }> = [];

  for (const booking of bookingsData) {
    if (booking.status === "pending_payment") {
      targets.push({ entityType: "session", entityId: booking.id });
    }
  }

  for (const report of reportsData.pending) {
    if (report.member_status === "pending_payment") {
      targets.push({ entityType: "report", entityId: report.id });
    }
  }

  for (const event of [
    circleData?.requestedEvent,
    circleData?.currentEvent,
    circleData?.nextEvent,
    circleData?.activeEventForPurchase,
  ]) {
    if (event?.purchaseStatus === "pending_payment" && event.bookingId) {
      targets.push({ entityType: "mentoring_circle", entityId: event.bookingId });
    }
  }

  return targets.filter((target, index, items) =>
    items.findIndex((candidate) =>
      candidate.entityType === target.entityType && candidate.entityId === target.entityId,
    ) === index,
  );
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
  const [activeSessions, setActiveSessions] = useState(0);
  const [purchasedSessionsAwaitingScheduling, setPurchasedSessionsAwaitingScheduling] = useState(0);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [reportsOrdered, setReportsOrdered] = useState(0);
  const [reportsPending, setReportsPending] = useState(0);
  const [recordings, setRecordings] = useState<MemberRecordingSummary[]>([]);
  const [mentoringCircle, setMentoringCircle] = useState<MentoringCircleState | null>(null);
  const [copiedCircleLink, setCopiedCircleLink] = useState(false);
  const accessibleCircleEvent = mentoringCircle?.currentEvent?.joinEligible
    ? mentoringCircle.currentEvent
    : mentoringCircle?.nextEvent?.joinEligible
      ? mentoringCircle.nextEvent
      : mentoringCircle?.activeEventForPurchase?.joinEligible
        ? mentoringCircle.activeEventForPurchase
        : null;
  const purchasableCircleEvent = mentoringCircle?.activeEventForPurchase ?? mentoringCircle?.currentEvent ?? mentoringCircle?.nextEvent ?? null;

  const memberTier = tierState;
  const usage = dbUser?.member?.usage;
  const capabilities = dbUser?.member?.capabilities;
  const seekerPromptLimit = usage?.limit ?? 150;
  const seekerPromptsRemaining = Math.max(seekerPromptLimit - (usage?.used ?? 0), 0);
  const greetingName = getDashboardGreetingName(clerkUser);
  const isTierLoading = memberTier === "loading";
  const isFree = memberTier === "free";
  const hasUnlimitedChat = capabilities?.unlimitedChat === true;
  const upgradeTarget = isFree ? "/subscriptions/seeker" : memberTier === "seeker" ? "/subscriptions/initiate" : null;
  const upgradeLabel = isFree ? "Upgrade" : "Upgrade to Initiate";
  const sessionSummary = useMemo(() => {
    if (statsLoading) {
      return "Loading session stats...";
    }
    if (purchasedSessionsAwaitingScheduling > 0) {
      return `${purchasedSessionsAwaitingScheduling} purchased ${purchasedSessionsAwaitingScheduling === 1 ? "session is" : "sessions are"} awaiting scheduling`;
    }
    if (activeSessions > 0) {
      return `${activeSessions} active ${activeSessions === 1 ? "session" : "sessions"}`;
    }
    return "No purchased or upcoming sessions";
  }, [activeSessions, purchasedSessionsAwaitingScheduling, statsLoading]);
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

    function applyStats(
      bookingsData: BookingSummary[],
      reportsData: MemberReportsListData,
      circleData: MentoringCircleState,
      recordingsData: MemberRecordingSummary[],
    ) {
      const now = Date.now();
      const awaitingScheduling = bookingsData.filter((booking) =>
        booking.status === "paid" && !booking.start_time_utc,
      ).length;
      const upcomingOrScheduled = bookingsData.filter((booking) =>
        booking.status !== "cancelled"
        && booking.status !== "completed"
        && (
          booking.status === "paid"
          || (booking.start_time_utc && new Date(booking.start_time_utc).getTime() > now)
        ),
      ).length;
      const completed = bookingsData.filter((booking) => booking.status === "completed").length;
      setActiveSessions(upcomingOrScheduled);
      setPurchasedSessionsAwaitingScheduling(awaitingScheduling);
      setCompletedSessions(completed);
      setReportsOrdered(reportsData.counts.total);
      setReportsPending(reportsData.counts.pending);
      setRecordings(recordingsData);
      setMentoringCircle(circleData);
    }

    async function fetchStats(token: string | null) {
      const [bookingsResponse, reportsResponse, circleResponse, recordingsResponse] = await Promise.all([
        api.get("/bookings", token) as Promise<{ data: BookingSummary[] }>,
        api.get("/member/reports", token) as Promise<{ data: MemberReportsListData }>,
        api.get("/mentoring-circle/me", token) as Promise<{ data: MentoringCircleState }>,
        api.get("/me/recordings", token) as Promise<{ recordings: MemberRecordingSummary[] }>,
      ]);

      return {
        bookingsData: bookingsResponse.data,
        reportsData: reportsResponse.data,
        circleData: circleResponse.data,
        recordingsData: recordingsResponse.recordings ?? [],
      };
    }

    async function loadStats() {
      setStatsLoading(true);
      try {
        const token = await getToken();
        let { bookingsData, reportsData, circleData, recordingsData } = await fetchStats(token);

        if (cancelled) return;

        const syncTargets = collectPendingSyncTargets(bookingsData, reportsData, circleData);
        if (syncTargets.length > 0) {
          await Promise.all(syncTargets.map((target) =>
            syncOwnedCheckoutSession({
              token,
              entityType: target.entityType,
              entityId: target.entityId,
            }).catch(() => null)
          ));

          if (cancelled) return;

          ({ bookingsData, reportsData, circleData, recordingsData } = await fetchStats(token));
          if (cancelled) return;
        }

        applyStats(bookingsData, reportsData, circleData, recordingsData);
      } catch {
        if (!cancelled) {
          setActiveSessions(0);
          setPurchasedSessionsAwaitingScheduling(0);
          setCompletedSessions(0);
          setReportsOrdered(0);
          setReportsPending(0);
          setRecordings([]);
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
    if (!accessibleCircleEvent?.joinUrl) return;
    await navigator.clipboard.writeText(accessibleCircleEvent.joinUrl);
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
                <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Active Sessions</p>
                <p className="mt-3 text-2xl font-semibold text-white">{statsLoading ? "..." : activeSessions}</p>
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
            {recordings.length > 0 ? (
              <section className="dashboard-panel cosmic-motion">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Recordings</h2>
                <p className="mt-3 text-lg font-semibold text-white">Your Recordings Are Ready</p>
                <p className="mt-1 text-sm text-white/60">
                  You have {recordings.length} recording{recordings.length === 1 ? "" : "s"} available.
                </p>
                <Link to="/dashboard/recordings" className="dashboard-action-primary cosmic-motion mt-4">
                  View Recordings
                </Link>
              </section>
            ) : null}

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
                    : `${seekerPromptsRemaining} of ${seekerPromptLimit} prompts remaining`}
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

            {memberTier === "initiate" ? (
              <section className="dashboard-panel cosmic-motion">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Mentoring</h2>
                <p className="mt-3 text-lg font-semibold text-white">Mentor Training available</p>
                <p className="mt-1 text-sm text-white/60">
                  Track your mentor training progress and next steps.
                </p>
                <Link
                  to="/mentor-training"
                  className="dashboard-action-secondary cosmic-motion mt-4"
                >
                  Start Path
                </Link>
              </section>
            ) : null}

            <section className="dashboard-panel cosmic-motion">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Mentoring Circle</h2>
              {accessibleCircleEvent?.joinEligible ? (
                <>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {accessibleCircleEvent.eventTitle}:{" "}
                    {formatPacificDateOnly(
                      accessibleCircleEvent.sessionDate ?? MENTORING_CIRCLE_SESSION_FALLBACK_ISO,
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
                      href={accessibleCircleEvent.joinUrl ?? "#"}
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
                    {purchasableCircleEvent
                      ? `Mentoring Circle: ${formatPacificDateOnly(
                        purchasableCircleEvent.sessionDate ?? MENTORING_CIRCLE_SESSION_FALLBACK_ISO,
                      )}`
                      : "No event scheduled"}
                  </p>
                  <p className="mt-1 text-sm text-white/60">
                    {purchasableCircleEvent?.purchaseStatus === "pending_payment"
                      ? "Payment is processing. Your access will appear here shortly."
                      : "Join upcoming circles and purchase access to live sessions."}
                  </p>
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
