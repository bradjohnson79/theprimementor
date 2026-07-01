import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, LockKeyhole } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
}

interface CourseLesson {
  id: string;
  title: string;
  youtubeEmbedUrl: string;
}

interface CourseResource {
  id: string;
  title: string;
  url: string;
}

interface CourseModule {
  id: string;
  order: number;
  title: string;
  description: string[];
  lessons: CourseLesson[];
  resources: CourseResource[];
}

interface CourseAccessResponse {
  course: PublicCourse;
  hasAccess: boolean;
  accessSource: "admin" | "entitlement" | "locked";
}

interface CourseContentResponse {
  course: PublicCourse & {
    moduleCount: number;
    modules: CourseModule[];
    unresolvedTodos?: string[];
  };
  accessSource: "admin" | "entitlement";
}

export default function CourseResonantDowsing() {
  const { getToken } = useAuth();
  const [searchParams] = useSearchParams();
  const checkoutState = searchParams.get("checkout");
  const checkoutSessionId = searchParams.get("checkoutSessionId");
  const [access, setAccess] = useState<CourseAccessResponse | null>(null);
  const [content, setContent] = useState<CourseContentResponse["course"] | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
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
        setSelectedModuleId(null);
        return;
      }

      setContentLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const response = await api.get("/courses/resonant-dowsing/content", token) as CourseContentResponse;
        if (!cancelled) {
          setContent(response.course);
          setSelectedModuleId((current) => current ?? response.course.modules[0]?.id ?? null);
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

  const selectedModuleIndex = useMemo(() => {
    if (!content?.modules.length || !selectedModuleId) return 0;
    return Math.max(0, content.modules.findIndex((module) => module.id === selectedModuleId));
  }, [content?.modules, selectedModuleId]);

  const selectedModule = content?.modules[selectedModuleIndex] ?? null;

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

  function goToOffset(offset: number) {
    if (!content?.modules.length) return;
    const nextIndex = Math.min(content.modules.length - 1, Math.max(0, selectedModuleIndex + offset));
    setSelectedModuleId(content.modules[nextIndex]?.id ?? null);
  }

  const publicCourse = content ?? access?.course;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="dashboard-shell"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <Link to="/dashboard/courses" className="text-sm font-medium text-cyan-100/75 hover:text-cyan-100">
          ← Back to Courses
        </Link>

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

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-200/25 bg-amber-200/10 text-amber-100">
                  {access?.hasAccess ? <BookOpen className="h-5 w-5" aria-hidden /> : <LockKeyhole className="h-5 w-5" aria-hidden />}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Access</p>
                  <p className="text-sm font-semibold text-white">
                    {access?.hasAccess ? "Purchased" : publicCourse?.price.label ?? "$99 CAD"}
                  </p>
                </div>
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
                {checkoutLoading ? "Starting checkout..." : "Unlock Course — $99 CAD"}
              </button>
            </div>
          </section>
        ) : contentLoading ? (
          <div className="dashboard-panel text-sm text-white/60">Loading course curriculum...</div>
        ) : content && selectedModule ? (
          <section className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="dashboard-panel h-fit lg:sticky lg:top-24">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/65">Modules</p>
              <div className="mt-4 space-y-2">
                {content.modules.map((module) => (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => setSelectedModuleId(module.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      module.id === selectedModule.id
                        ? "border-cyan-200/30 bg-cyan-200/10 text-cyan-50"
                        : "border-white/8 bg-white/[0.03] text-white/60 hover:border-white/16 hover:text-white/80"
                    }`}
                  >
                    <span className="block text-[11px] uppercase tracking-[0.18em] opacity-70">
                      {module.order === 0 ? "Prep" : `Module ${module.order}`}
                    </span>
                    <span className="mt-1 block font-medium">{module.title}</span>
                  </button>
                ))}
              </div>
            </aside>

            <article className="dashboard-panel">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/65">
                {selectedModule.order === 0 ? "Preparation" : `Module ${selectedModule.order}`}
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">{selectedModule.title}</h2>
              <div className="mt-4 space-y-2">
                {selectedModule.description.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-white/68">{paragraph}</p>
                ))}
              </div>

              <div className="mt-6 space-y-6">
                {selectedModule.lessons.map((lesson) => (
                  <div key={lesson.id} className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
                    <div className="aspect-video bg-black">
                      <iframe
                        title={lesson.title}
                        src={lesson.youtubeEmbedUrl}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-white">{lesson.title}</h3>
                    </div>
                  </div>
                ))}
              </div>

              {selectedModule.resources.length ? (
                <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/48">Resources</p>
                  <div className="mt-3 space-y-2">
                    {selectedModule.resources.map((resource) => (
                      <a
                        key={resource.id}
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/15 px-4 py-3 text-sm text-cyan-100/82 hover:border-cyan-200/24 hover:text-cyan-50"
                      >
                        <span>{resource.title}</span>
                        <ExternalLink className="h-4 w-4" aria-hidden />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-8 flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  onClick={() => goToOffset(-1)}
                  disabled={selectedModuleIndex === 0}
                  className="dashboard-action-secondary disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden /> Previous
                </button>
                <button
                  type="button"
                  onClick={() => goToOffset(1)}
                  disabled={selectedModuleIndex >= content.modules.length - 1}
                  className="dashboard-action-primary disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Next <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </button>
              </div>
            </article>
          </section>
        ) : null}
      </div>
    </motion.div>
  );
}
