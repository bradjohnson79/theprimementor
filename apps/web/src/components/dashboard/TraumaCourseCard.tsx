import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  TTT_COURSE_ROUTE,
  TTT_PROGRESS_STORAGE_KEY,
  getTTTCourseStatus,
  readTTTProgressState,
  type CourseStatus,
} from "../../lib/courses.config";

function getCourseActionLabel(status: CourseStatus) {
  if (status === "completed") return "Completed ✓";
  if (status === "in_progress") return "Continue Course";
  return "Start the Course";
}

export default function TraumaCourseCard() {
  const [courseStatus, setCourseStatus] = useState<CourseStatus>("not_started");

  useEffect(() => {
    function syncStatus() {
      setCourseStatus(getTTTCourseStatus(readTTTProgressState()));
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === TTT_PROGRESS_STORAGE_KEY) {
        syncStatus();
      }
    }

    syncStatus();
    window.addEventListener("focus", syncStatus);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("focus", syncStatus);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const actionLabel = useMemo(() => getCourseActionLabel(courseStatus), [courseStatus]);

  return (
    <section className="dashboard-panel cosmic-motion relative overflow-hidden border border-cyan-300/18">
      <motion.div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_42%)]"
        animate={{ opacity: [0.72, 1, 0.78] }}
        transition={{ duration: 3.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/65">Featured Course</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Trauma Transcendence Technique</h2>
          <p className="mt-2 text-sm font-medium text-cyan-100/80">Free 10-Day E-Course</p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
            Release the past. Reclaim your state. Step into a new level of clarity and control through this guided 10-day transformation.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-white/55">
            {courseStatus === "completed" ? "Completed" : courseStatus === "in_progress" ? "In Progress" : "Ready to Start"}
          </span>
          <Link
            to={TTT_COURSE_ROUTE}
            className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              courseStatus === "completed"
                ? "dashboard-action-secondary border-teal-300/20 bg-teal-300/10 text-teal-100 hover:bg-teal-300/12 hover:text-teal-100"
                : "dashboard-action-primary"
            }`}
          >
            {actionLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
