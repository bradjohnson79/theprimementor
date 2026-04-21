import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import {
  COURSES,
  getTTTCourseStatus,
  readTTTProgressState,
  type CourseStatus,
} from "../lib/courses.config";

function getCourseActionLabel(status: CourseStatus) {
  if (status === "completed") return "Completed ✓";
  if (status === "in_progress") return "Continue Course";
  return "Start the Course";
}

export default function Courses() {
  const progress = readTTTProgressState();
  const tttStatus = getTTTCourseStatus(progress);
  const resumeDay = tttStatus === "in_progress" ? progress.lastViewedLesson : null;
  const featuredCourse = COURSES.find((course) => course.slug === "ttt") ?? COURSES[0];
  const remainingCourses = COURSES.filter((course) => course.slug !== "ttt");

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
          <article className="dashboard-panel cosmic-motion relative overflow-hidden border border-cyan-300/18 lg:col-span-2">
            <motion.div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_44%)]"
              animate={{ opacity: [0.72, 1, 0.8] }}
              transition={{ duration: 3.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            />
            <div className="relative flex h-full flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/65">{featuredCourse.statusLabel}</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">{featuredCourse.title}</h2>
                <p className="mt-2 text-sm font-medium text-cyan-100/80">{featuredCourse.subtitle ?? "Free • 10 Days"}</p>
                <p className="mt-4 text-sm leading-relaxed text-white/70">{featuredCourse.description}</p>
                {resumeDay ? (
                  <p className="mt-4 text-xs font-medium uppercase tracking-[0.22em] text-cyan-200/65">
                    Resume from Day {resumeDay}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col items-start gap-3 lg:items-end">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                  {featuredCourse.subtitle ?? "Free • 10 Days"}
                </span>
                <Link
                  to={featuredCourse.route}
                  className={`dashboard-action-primary ${
                    tttStatus === "completed"
                      ? "border-teal-300/20 bg-teal-300/10 text-teal-100 hover:bg-teal-300/12 hover:text-teal-100"
                      : ""
                  }`}
                >
                  {getCourseActionLabel(tttStatus)}
                </Link>
              </div>
            </div>
          </article>

          {remainingCourses.map((course) => {
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
