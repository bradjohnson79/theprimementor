import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CourseLearningShell, type CourseLearningLesson, type CourseLearningSelectedLesson } from "@wisdom/ui/courses";
import { api } from "../lib/api";
import { syncOwnedCheckoutSession } from "../lib/checkoutSessionSync";

interface PublicCourse {
  slug: string;
  title: string;
  description: string[];
  price: {
    label: string;
    currency: string;
    amountCents: number;
  };
  access: "lifetime";
  disclaimer: string;
  moduleCount?: number;
  totalLessons?: number;
  thumbnailUrl: string;
}

interface CourseAccessResponse {
  course: PublicCourse;
  hasAccess: boolean;
  accessSource: "admin" | "entitlement" | "locked";
}

interface CourseContentResponse {
  course: PublicCourse & { totalLessons: number; moduleCount: number };
  accessSource: "admin" | "entitlement";
  lessons: CourseLearningLesson[];
  progress: {
    completedLessonIds: string[];
    unlockedLessonId: string | null;
    completedCount: number;
    totalLessons: number;
  };
}

interface LessonDetailResponse {
  lesson: {
    id: string;
    sequence: number;
    moduleTitle: string;
    title: string;
    youtubeEmbedUrl: string;
    description: string[];
    resources: Array<{ id: string; title: string; url: string }>;
  };
}

interface CompletionResponse {
  completedLessonIds: string[];
  unlockedLessonId: string | null;
  nextLessonId: string | null;
  completedCount: number;
  totalLessons: number;
}

export default function CourseResonantDowsing() {
  const { getToken } = useAuth();
  const [searchParams] = useSearchParams();
  const checkoutState = searchParams.get("checkout");
  const checkoutSessionId = searchParams.get("checkoutSessionId");
  const [access, setAccess] = useState<CourseAccessResponse | null>(null);
  const [content, setContent] = useState<CourseContentResponse | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<CourseLearningSelectedLesson | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [completingLessonId, setCompletingLessonId] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAccess = useCallback(async () => {
    const token = await getToken();
    return await api.get("/courses/resonant-dowsing", token) as CourseAccessResponse;
  }, [getToken]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        if (checkoutState === "success" && checkoutSessionId) {
          setMessage("Confirming your course access...");
          await syncOwnedCheckoutSession({ token, checkoutSessionId });
        } else if (checkoutState === "canceled") {
          setMessage("Checkout was canceled. You can restart whenever you're ready.");
        }

        let latest = await loadAccess();
        for (let attempt = 0; checkoutState === "success" && !latest.hasAccess && attempt < 4; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1200));
          if (cancelled) return;
          latest = await loadAccess();
        }

        if (!cancelled) {
          setAccess(latest);
          if (checkoutState === "success" && !latest.hasAccess) {
            setMessage("Payment is confirmed by Stripe. Course access is still syncing; refresh in a moment if it has not appeared.");
          } else if (latest.hasAccess) {
            setMessage(null);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Course access could not be loaded.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [checkoutSessionId, checkoutState, getToken, loadAccess]);

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      if (!access?.hasAccess) {
        setContent(null);
        setSelectedLessonId(null);
        setSelectedLesson(null);
        return;
      }

      setContentLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const response = await api.get("/courses/resonant-dowsing/content", token) as CourseContentResponse;
        if (!cancelled) {
          setContent(response);
          setSelectedLessonId((current) => current ?? response.progress.unlockedLessonId ?? response.lessons.find((lesson) => lesson.status !== "locked")?.id ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Course content could not be loaded.");
        }
      } finally {
        if (!cancelled) {
          setContentLoading(false);
        }
      }
    }

    void loadContent();

    return () => {
      cancelled = true;
    };
  }, [access?.hasAccess, getToken]);

  const selectedLessonIndex = useMemo(() => {
    if (!content?.lessons.length || !selectedLessonId) return 0;
    return Math.max(0, content.lessons.findIndex((lesson) => lesson.id === selectedLessonId));
  }, [content?.lessons, selectedLessonId]);

  const loadLesson = useCallback(async (lessonId: string) => {
    setLessonLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await api.get(`/courses/resonant-dowsing/lessons/${encodeURIComponent(lessonId)}`, token) as LessonDetailResponse;
      setSelectedLesson({
        id: response.lesson.id,
        sequence: response.lesson.sequence,
        moduleTitle: response.lesson.moduleTitle,
        title: response.lesson.title,
        videoUrl: response.lesson.youtubeEmbedUrl,
        description: response.lesson.description,
        resources: response.lesson.resources,
      });
      setSelectedLessonId(lessonId);
    } catch (lessonError) {
      setError(lessonError instanceof Error ? lessonError.message : "Lesson could not be loaded.");
    } finally {
      setLessonLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (selectedLessonId) {
      void loadLesson(selectedLessonId);
    }
  }, [loadLesson, selectedLessonId]);

  async function startCheckout() {
    setCheckoutLoading(true);
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      const response = await api.post("/courses/resonant-dowsing/checkout", undefined, token) as {
        alreadyPaid?: boolean;
        url?: string | null;
      };
      if (response.alreadyPaid) {
        const latest = await loadAccess();
        setAccess(latest);
        return;
      }
      if (!response.url) {
        throw new Error("Checkout could not be started.");
      }
      window.location.assign(response.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout could not be started.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function markLessonComplete(lessonId: string) {
    setCompletingLessonId(lessonId);
    setError(null);
    try {
      const token = await getToken();
      await api.post(`/courses/resonant-dowsing/lessons/${encodeURIComponent(lessonId)}/complete`, undefined, token) as CompletionResponse;
      const refreshed = await api.get("/courses/resonant-dowsing/content", token) as CourseContentResponse;
      setContent(refreshed);
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "Lesson completion could not be saved.");
    } finally {
      setCompletingLessonId(null);
    }
  }

  function goToOffset(offset: number) {
    if (!content?.lessons.length) return;
    const nextIndex = Math.min(content.lessons.length - 1, Math.max(0, selectedLessonIndex + offset));
    const nextLesson = content.lessons[nextIndex];
    if (nextLesson?.status !== "locked") {
      setSelectedLessonId(nextLesson.id);
    }
  }

  const publicCourse = content?.course ?? access?.course;
  const selectedLessonSummary = content?.lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const shouldDisableNext = Boolean(selectedLessonSummary && selectedLessonSummary.status !== "completed");

  if (access?.hasAccess && content) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
        <CourseLearningShell
          title={publicCourse?.title ?? "The Resonant Dowsing Course"}
          summary={publicCourse?.description?.[0] ?? ""}
          badge={`${publicCourse?.moduleCount ?? 13} Modules · ${content.progress.totalLessons} Lessons`}
          lessons={content.lessons}
          selectedLesson={selectedLesson}
          selectedLessonId={selectedLessonId}
          completedCount={content.progress.completedCount}
          totalLessons={content.progress.totalLessons}
          isLoadingLesson={lessonLoading || contentLoading}
          isCompleting={Boolean(completingLessonId)}
          nextDisabled={shouldDisableNext}
          backHref="/dashboard/courses"
          message={message}
          error={error}
          onSelectLesson={setSelectedLessonId}
          onMarkComplete={markLessonComplete}
          onSelectPrevious={selectedLessonIndex > 0 ? () => goToOffset(-1) : undefined}
          onSelectNext={selectedLessonIndex < content.lessons.length - 1 ? () => goToOffset(1) : undefined}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="dashboard-shell"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <a href="/dashboard/courses" className="text-sm font-medium text-cyan-100/75 hover:text-cyan-100">
          {"<-"} Back to Courses
        </a>

        <section className="dashboard-panel relative overflow-hidden border border-amber-200/15">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_46%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-100/70">
                {access?.hasAccess ? "Lifetime Access" : "One-Time Course"}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {publicCourse?.title ?? "The Resonant Dowsing Course"}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70 sm:text-base">
                {publicCourse?.description?.[0] ?? "A protected dashboard course teaching Brad Johnson's Resonant Dowsing method."}
              </p>
              {publicCourse?.description?.[1] ? (
                <p className="mt-3 max-w-3xl text-sm leading-7 text-white/62">{publicCourse.description[1]}</p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <img
                  src={publicCourse?.thumbnailUrl ?? "/images/courses/resonant-dowsing-course.png"}
                  alt=""
                  className="aspect-video w-full object-cover"
                />
              </div>
              <div className="mt-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Access</p>
                <p className="text-sm font-semibold text-white">
                  {access?.hasAccess ? "Purchased" : publicCourse?.price.label ?? "$99 CAD"}
                </p>
              </div>
              <p className="mt-4 text-xs leading-6 text-white/55">
                {publicCourse?.disclaimer}
              </p>
            </div>
          </div>
        </section>

        {message ? (
          <div className="dashboard-panel border border-cyan-200/15 bg-cyan-200/5 text-sm text-cyan-50/80">{message}</div>
        ) : null}
        {error ? (
          <div className="dashboard-panel border border-red-300/20 bg-red-500/10 text-sm text-red-100">{error}</div>
        ) : null}

        {loading ? (
          <div className="dashboard-panel text-sm text-white/60">Loading course access...</div>
        ) : !access?.hasAccess ? (
          <section className="dashboard-panel">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-100/70">Locked Course</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Unlock Lifetime Access</h2>
              <p className="mt-3 text-sm leading-7 text-white/68">
                Purchase once to open the full protected curriculum, video embeds, and authorized resource links inside your member dashboard.
              </p>
              <button
                type="button"
                onClick={startCheckout}
                disabled={checkoutLoading}
                className="dashboard-action-primary mt-6"
              >
                {checkoutLoading ? "Starting checkout..." : "Purchase Course — $99 CAD"}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </motion.div>
  );
}
