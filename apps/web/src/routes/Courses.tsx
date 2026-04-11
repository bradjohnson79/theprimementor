import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { COURSES, TTT_PROGRESS_STORAGE_KEY, createInitialCourseProgress } from "../lib/courses.config";

function readResumeDay() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(TTT_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { lastViewedLesson?: unknown };
    return typeof parsed.lastViewedLesson === "number" && parsed.lastViewedLesson > 0
      ? parsed.lastViewedLesson
      : createInitialCourseProgress().lastViewedLesson;
  } catch {
    return null;
  }
}

export default function Courses() {
  const resumeDay = readResumeDay();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="dashboard-shell"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="dashboard-panel">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
              <BookOpen className="h-5 w-5" strokeWidth={1.8} aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/60">Courses</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Structured learning inside your dashboard</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/65 sm:text-base">
                Move through focused teachings at your own pace, keep momentum with visible progress, and build completion into a meaningful part of your member journey.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          {COURSES.map((course) => {
            const isTTT = course.slug === "ttt";

            if (course.available) {
              return (
                <article key={course.slug} className="dashboard-panel cosmic-motion">
                  <div className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200/65">{course.statusLabel}</p>
                        <h2 className="mt-3 text-2xl font-semibold text-white">{course.title}</h2>
                      </div>
                      <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100/80">
                        Live
                      </div>
                    </div>
                    <p className="mt-4 flex-1 text-sm leading-relaxed text-white/70">{course.description}</p>
                    {isTTT && resumeDay ? (
                      <p className="mt-4 text-xs font-medium uppercase tracking-[0.22em] text-cyan-200/65">
                        Resume from Day {resumeDay}
                      </p>
                    ) : null}
                    <div className="mt-6">
                      <Link
                        to={course.route}
                        className="dashboard-action-primary"
                      >
                        {course.ctaLabel}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            }

            return (
              <article
                key={course.slug}
                className="dashboard-panel relative overflow-hidden border border-violet-300/15 opacity-85"
              >
                <motion.div
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.18),transparent_42%)]"
                  animate={{ opacity: [0.18, 0.3, 0.18] }}
                  transition={{ duration: 2.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-200/65">Coming Soon</p>
                      <h2 className="mt-3 text-2xl font-semibold text-white">{course.title}</h2>
                      {course.subtitle ? (
                        <p className="mt-2 text-sm font-medium text-white/68">{course.subtitle}</p>
                      ) : null}
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/15 text-white/75">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="3.5" y="7" width="9" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-white/68">{course.description}</p>
                  <div className="mt-6 group relative inline-flex w-fit">
                    <button
                      type="button"
                      disabled
                      title={course.tooltip}
                      className="dashboard-action-secondary cursor-not-allowed bg-white/[0.04] text-white/45 hover:bg-white/[0.04] hover:text-white/45"
                    >
                      {course.ctaLabel}
                    </button>
                    {course.tooltip ? (
                      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-950/95 px-2 py-1 text-[11px] font-medium text-white/80 shadow-xl group-hover:block">
                        {course.tooltip}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </motion.div>
  );
}
