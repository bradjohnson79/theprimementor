import { motion } from "framer-motion";
import { useAuth } from "@clerk/react";
import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { CourseCatalogCard } from "@wisdom/ui/courses";
import { api } from "../lib/api";
import {
  COURSES,
  getTTTCourseStatus,
  readTTTProgressState,
  type CourseStatus,
} from "../lib/courses.config";

interface ResonantDowsingAccessState {
  course?: {
    title: string;
    description: string[];
    price: { label: string };
    thumbnailUrl: string;
    moduleCount?: number;
  };
  hasAccess?: boolean;
}

function getCourseActionLabel(status: CourseStatus) {
  if (status === "completed") return "View Now";
  if (status === "in_progress") return "Continue Course";
  return "View Now";
}

export default function Courses() {
  const { getToken } = useAuth();
  const progress = readTTTProgressState();
  const tttStatus = getTTTCourseStatus(progress);
  const resumeDay = tttStatus === "in_progress" ? progress.lastViewedLesson : null;
  const featuredCourse = COURSES.find((course) => course.slug === "ttt") ?? COURSES[0];
  const [resonantDowsing, setResonantDowsing] = useState<ResonantDowsingAccessState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCourseAccess() {
      try {
        const token = await getToken();
        const response = await api.get("/courses/resonant-dowsing", token) as ResonantDowsingAccessState;
        if (!cancelled) {
          setResonantDowsing(response);
        }
      } catch {
        if (!cancelled) {
          setResonantDowsing(null);
        }
      }
    }

    void loadCourseAccess();

    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const resonantCourse = resonantDowsing?.course;
  const hasResonantAccess = resonantDowsing?.hasAccess === true;

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
          <CourseCatalogCard
            title={featuredCourse.title}
            description={featuredCourse.description}
            badge={featuredCourse.subtitle ?? "Free"}
            badgeTone="free"
            meta={resumeDay ? `Resume from Day ${resumeDay}` : featuredCourse.statusLabel}
            ctaLabel={getCourseActionLabel(tttStatus)}
            thumbnailUrl="/images/Trauma-Transcendence-Technique-banner.png"
            href={featuredCourse.route}
          />

          <CourseCatalogCard
            title={resonantCourse?.title ?? "The Resonant Dowsing Course"}
            description={resonantCourse?.description?.[0]
              ?? "The Resonant Dowsing Course is an online teaching series instructed by its founder, Brad Johnson."}
            badge={hasResonantAccess ? "Purchased" : resonantCourse?.price.label ?? "$99 CAD"}
            badgeTone={hasResonantAccess ? "owned" : "paid"}
            meta={hasResonantAccess ? "Lifetime Access" : "One-Time Course"}
            ctaLabel={hasResonantAccess ? "Continue Course" : "Purchase Course — $99 CAD"}
            thumbnailUrl={resonantCourse?.thumbnailUrl ?? "/images/courses/resonant-dowsing-course.png"}
            href="/dashboard/courses/resonant-dowsing"
          />
        </section>
      </div>
    </motion.div>
  );
}
