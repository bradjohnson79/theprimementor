import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { CourseLearningShell, type CourseLearningLesson, type CourseLearningSelectedLesson } from "@wisdom/ui/courses";
import {
  TTT_COURSE_SUMMARY,
  TTT_LESSONS,
  TTT_TOTAL_LESSONS,
  readTTTProgressState,
  writeTTTProgressState,
  type CourseProgressState,
} from "../lib/courses.config";

function createInitialCourseState() {
  const progress = readTTTProgressState();
  return {
    progress,
    selectedDay: progress.lastViewedLesson,
  };
}

function toLearningLessons(progress: CourseProgressState, selectedDay: number): CourseLearningLesson[] {
  const completed = new Set(progress.completedLessons);
  return TTT_LESSONS.map((lesson) => ({
    id: String(lesson.day),
    sequence: lesson.day,
    moduleTitle: `Day ${lesson.day}`,
    title: lesson.title,
    status: completed.has(lesson.day)
      ? "completed"
      : lesson.day === selectedDay
        ? "unlocked"
        : "unlocked",
  }));
}

function toSelectedLesson(day: number): CourseLearningSelectedLesson {
  const lesson = TTT_LESSONS.find((item) => item.day === day) ?? TTT_LESSONS[0];
  return {
    id: String(lesson.day),
    sequence: lesson.day,
    moduleTitle: `Day ${lesson.day}`,
    title: lesson.title,
    description: [lesson.description],
    videoUrl: lesson.videoUrl,
    resources: [],
  };
}

export default function CourseTTT() {
  const [initialCourseState] = useState(() => createInitialCourseState());
  const [progress, setProgress] = useState<CourseProgressState>(initialCourseState.progress);
  const [selectedDay, setSelectedDay] = useState(initialCourseState.selectedDay);

  useEffect(() => {
    writeTTTProgressState(progress);
  }, [progress]);

  const lessons = useMemo(() => toLearningLessons(progress, selectedDay), [progress, selectedDay]);
  const selectedLesson = useMemo(() => toSelectedLesson(selectedDay), [selectedDay]);
  const completedLessons = useMemo(() => new Set(progress.completedLessons), [progress.completedLessons]);

  function markLessonComplete(lessonId: string) {
    const day = Number(lessonId);
    if (!Number.isFinite(day)) return;
    setProgress((current) => {
      if (current.completedLessons.includes(day)) {
        return current;
      }
      return {
        completedLessons: [...current.completedLessons, day].sort((left, right) => left - right),
        lastViewedLesson: day,
      };
    });
    if (day < TTT_TOTAL_LESSONS) {
      setSelectedDay(day + 1);
    }
  }

  function selectLesson(lessonId: string) {
    const day = Number(lessonId);
    if (!Number.isFinite(day) || day < 1 || day > TTT_TOTAL_LESSONS) return;
    setSelectedDay(day);
    setProgress((current) => ({
      ...current,
      lastViewedLesson: day,
    }));
  }

  function goToOffset(offset: number) {
    const nextDay = Math.min(TTT_TOTAL_LESSONS, Math.max(1, selectedDay + offset));
    selectLesson(String(nextDay));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <CourseLearningShell
        title="Trauma Transcendence Technique"
        summary={TTT_COURSE_SUMMARY}
        thumbnailUrl="/images/Trauma-Transcendence-Technique-banner.png"
        badge="Free · 10 Days"
        lessons={lessons}
        selectedLesson={selectedLesson}
        selectedLessonId={String(selectedDay)}
        completedCount={completedLessons.size}
        totalLessons={TTT_TOTAL_LESSONS}
        backHref="/dashboard/courses"
        completionDisabled={completedLessons.has(selectedDay)}
        onSelectLesson={selectLesson}
        onMarkComplete={markLessonComplete}
        onSelectPrevious={selectedDay > 1 ? () => goToOffset(-1) : undefined}
        onSelectNext={selectedDay < TTT_TOTAL_LESSONS ? () => goToOffset(1) : undefined}
      />
    </motion.div>
  );
}
