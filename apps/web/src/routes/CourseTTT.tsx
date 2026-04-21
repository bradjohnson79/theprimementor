import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CourseCompletionBadge from "../components/courses/CourseCompletionBadge";
import CourseDaySelector from "../components/courses/CourseDaySelector";
import YouTubeLessonPlayer from "../components/courses/YouTubeLessonPlayer";
import {
  TTT_COURSE_SUMMARY,
  TTT_LESSONS,
  TTT_MATERIALS,
  TTT_TOTAL_LESSONS,
  readTTTProgressState,
  writeTTTProgressState,
  type CourseProgressState,
} from "../lib/courses.config";

function getLessonByDay(day: number) {
  return TTT_LESSONS.find((lesson) => lesson.day === day) ?? TTT_LESSONS[0];
}

function createInitialCourseState() {
  const progress = readTTTProgressState();
  return {
    progress,
    selectedDay: progress.lastViewedLesson,
  };
}

function isUsableMaterialLink(href: string) {
  try {
    const parsed = new URL(href);
    return parsed.protocol === "https:" && parsed.hostname !== "example.com";
  } catch {
    return false;
  }
}

export default function CourseTTT() {
  const [initialCourseState] = useState(() => createInitialCourseState());
  const [progress, setProgress] = useState<CourseProgressState>(initialCourseState.progress);
  const [selectedDay, setSelectedDay] = useState(initialCourseState.selectedDay);
  const [videoProgress, setVideoProgress] = useState(0);
  const [showCompletionMoment, setShowCompletionMoment] = useState(false);
  const completionMomentShownRef = useRef(false);

  useEffect(() => {
    writeTTTProgressState(progress);
  }, [progress]);

  useEffect(() => {
    if (!showCompletionMoment) {
      return;
    }

    const timeout = window.setTimeout(() => setShowCompletionMoment(false), 3200);
    return () => window.clearTimeout(timeout);
  }, [showCompletionMoment]);

  const completedLessons = useMemo(() => new Set(progress.completedLessons), [progress.completedLessons]);
  const completedCount = progress.completedLessons.length;
  const allLessonsComplete = completedCount === TTT_TOTAL_LESSONS;
  const currentLesson = getLessonByDay(selectedDay);
  const progressPercent = Math.round((completedCount / TTT_TOTAL_LESSONS) * 100);
  const canResumeDifferentLesson = progress.lastViewedLesson !== selectedDay;

  useEffect(() => {
    if (!allLessonsComplete) {
      completionMomentShownRef.current = false;
    }
  }, [allLessonsComplete]);

  const markLessonComplete = useCallback((day: number) => {
    setProgress((current) => {
      if (current.completedLessons.includes(day)) {
        return current;
      }

      const nextCompletedLessons = [...current.completedLessons, day].sort((left, right) => left - right);
      const nextProgress = {
        completedLessons: nextCompletedLessons,
        lastViewedLesson: day,
      };

      if (
        day === TTT_TOTAL_LESSONS
        && nextCompletedLessons.length === TTT_TOTAL_LESSONS
        && !completionMomentShownRef.current
      ) {
        completionMomentShownRef.current = true;
        window.setTimeout(() => setShowCompletionMoment(true), 80);
      }

      return nextProgress;
    });
  }, []);

  const selectLesson = useCallback((day: number) => {
    setSelectedDay(day);
    setVideoProgress(0);
    setProgress((current) => ({
      ...current,
      lastViewedLesson: day,
    }));
  }, []);

  useEffect(() => {
    if (videoProgress >= 0.7 && !completedLessons.has(selectedDay)) {
      markLessonComplete(selectedDay);
    }
  }, [completedLessons, markLessonComplete, selectedDay, videoProgress]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="dashboard-shell"
    >
      <AnimatePresence>
        {showCompletionMoment ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-6"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-amber-300/30 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.18),rgba(76,29,149,0.32)_46%,rgba(2,6,23,0.96)_100%)] px-8 py-10 text-center shadow-[0_0_70px_rgba(245,158,11,0.18)]"
            >
              <motion.div
                className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.16),transparent_56%)]"
                animate={{ scale: [0.96, 1.08, 1], opacity: [0.18, 0.32, 0.12] }}
                transition={{ duration: 1.1, ease: "easeOut" }}
              />
              <div className="relative">
                <motion.div
                  className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-amber-300/35 bg-black/20 text-4xl text-amber-100"
                  animate={{ boxShadow: ["0 0 0 rgba(245,158,11,0)", "0 0 40px rgba(245,158,11,0.28)", "0 0 16px rgba(245,158,11,0.14)"] }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                >
                  ✦
                </motion.div>
                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.32em] text-amber-100/70">Course Completed</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Trauma Transcendence Graduate</h2>
                <p className="mt-3 text-sm leading-relaxed text-white/78">
                  You&apos;ve completed the Trauma Transcendence Technique.
                </p>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mx-auto max-w-6xl space-y-6">
        <section className="dashboard-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/60">Course</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Trauma Transcendence Technique</h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/68 sm:text-base">
            {TTT_COURSE_SUMMARY}
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <div className="flex items-center justify-between gap-3 text-sm text-white/72">
                <span>Progress: {completedCount} / {TTT_TOTAL_LESSONS} Completed</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-teal-300 to-violet-300"
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canResumeDifferentLesson ? (
                <button
                  type="button"
                  onClick={() => selectLesson(progress.lastViewedLesson)}
                  className="dashboard-action-secondary"
                >
                  Resume Day {progress.lastViewedLesson}
                </button>
              ) : null}
              <Link
                to="/sessions/mentoring"
                className="dashboard-action-secondary"
              >
                Book Mentoring Session
              </Link>
            </div>
          </div>
        </section>

        {allLessonsComplete ? (
          <CourseCompletionBadge completedCount={completedCount} totalLessons={TTT_TOTAL_LESSONS} />
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="dashboard-panel p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">Lesson Navigation</p>
                <p className="mt-2 text-sm text-white/65">Choose a day and keep moving forward.</p>
              </div>
            </div>
            <CourseDaySelector
              lessons={TTT_LESSONS}
              selectedDay={selectedDay}
              completedLessons={completedLessons}
              lastViewedLesson={progress.lastViewedLesson}
              onSelect={selectLesson}
            />
          </div>

          <div className="space-y-5">
            <AnimatePresence mode="wait">
              <motion.section
                key={currentLesson.day}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="space-y-5"
              >
                <YouTubeLessonPlayer
                  videoUrl={currentLesson.videoUrl}
                  title={`TTT Day ${currentLesson.day}`}
                  onProgressChange={setVideoProgress}
                />

                <section className="dashboard-panel">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/60">Current Lesson</p>
                      <h2 className="mt-3 text-2xl font-semibold text-white">{currentLesson.title}</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/70">
                        {currentLesson.description}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-left text-sm text-white/68 md:text-right">
                      <p>Video progress</p>
                      <p className="mt-1 text-base font-semibold text-white">{Math.min(Math.round(videoProgress * 100), 100)}%</p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => markLessonComplete(currentLesson.day)}
                      disabled={completedLessons.has(currentLesson.day)}
                      className={`rounded-md px-4 py-2.5 text-sm font-medium transition ${
                        completedLessons.has(currentLesson.day)
                          ? "dashboard-action-secondary cursor-default border-teal-300/20 bg-teal-300/10 text-teal-100 hover:bg-teal-300/10 hover:text-teal-100"
                          : "dashboard-action-primary"
                      }`}
                    >
                      {completedLessons.has(currentLesson.day) ? "Completed" : "Mark as Complete"}
                    </button>
                    <p className="text-sm text-white/60">
                      Lessons also auto-complete after roughly 70% watched.
                    </p>
                  </div>
                </section>
              </motion.section>
            </AnimatePresence>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">Course Materials</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Downloadable materials</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                Supporting worksheets tied directly to key moments in the 10-day sequence.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {TTT_MATERIALS.map((material) => (
              <article key={material.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">{material.title}</p>
                {material.relatedDay ? (
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/65">
                    Used in Day {material.relatedDay}
                  </p>
                ) : null}
                {isUsableMaterialLink(material.href) ? (
                  <a
                    href={material.href}
                    target="_blank"
                    rel="noreferrer"
                    className="dashboard-action-secondary mt-5"
                  >
                    Download PDF
                  </a>
                ) : (
                  <span className="dashboard-action-secondary mt-5 cursor-not-allowed bg-white/[0.04] text-white/45 hover:bg-white/[0.04] hover:text-white/45">
                    Material link coming soon
                  </span>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="dashboard-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-200/55">Next Steps</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Keep the momentum moving</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/68">
            Let the course become a lived practice. Continue into Mentoring Sessions, deeper Prime Law work, and your next level of guided progression inside Prime Mentor.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/sessions/mentoring"
              className="dashboard-action-primary"
            >
              Book Mentoring Session
            </Link>
            <Link
              to="/subscriptions/initiate"
              className="dashboard-action-secondary"
            >
              Explore Initiate Membership
            </Link>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
