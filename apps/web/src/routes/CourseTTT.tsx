import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { CourseLearningShell, type CourseLearningLesson, type CourseLearningSelectedLesson } from "@wisdom/ui/courses";
import {
  TTT_COURSE_SUMMARY,
  TTT_LESSONS,
  TTT_MATERIALS,
  TTT_TOTAL_LESSONS,
  readTTTProgressState,
  writeTTTProgressState,
  type CourseProgressState,
} from "../lib/courses.config";

const COURSE_MATERIALS_LESSON_ID = "course-materials";

function createInitialCourseState() {
  const progress = readTTTProgressState();
  return {
    progress,
    selectedLessonId: String(progress.lastViewedLesson),
  };
}

function toLearningLessons(progress: CourseProgressState, selectedLessonId: string): CourseLearningLesson[] {
  const completed = new Set(progress.completedLessons);
  return [
    {
      id: COURSE_MATERIALS_LESSON_ID,
      sequence: 0,
      moduleTitle: "Course Materials",
      title: "Downloadable PDFs",
      status: "unlocked" as const,
    },
    ...TTT_LESSONS.map((lesson) => ({
      id: String(lesson.day),
      sequence: lesson.day,
      moduleTitle: `Day ${lesson.day}`,
      title: lesson.title,
      status: completed.has(lesson.day)
        ? "completed" as const
        : lesson.day === Number(selectedLessonId)
          ? "unlocked" as const
          : "unlocked" as const,
    })),
  ];
}

function toSelectedLesson(lessonId: string): CourseLearningSelectedLesson {
  if (lessonId === COURSE_MATERIALS_LESSON_ID) {
    return {
      id: COURSE_MATERIALS_LESSON_ID,
      sequence: 0,
      moduleTitle: "Course Materials",
      title: "Downloadable PDFs",
      description: [
        "Download the course worksheets and templates before beginning Day 1, or return to them whenever you need support during the 10-day practice.",
      ],
      resources: TTT_MATERIALS.map((material) => ({
        id: material.title,
        title: material.title,
        url: material.href,
        helperText: "Open PDF in Google Drive",
      })),
    };
  }

  const day = Number(lessonId);
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
  const [selectedLessonId, setSelectedLessonId] = useState(initialCourseState.selectedLessonId);

  useEffect(() => {
    writeTTTProgressState(progress);
  }, [progress]);

  const lessons = useMemo(() => toLearningLessons(progress, selectedLessonId), [progress, selectedLessonId]);
  const selectedLesson = useMemo(() => toSelectedLesson(selectedLessonId), [selectedLessonId]);
  const completedLessons = useMemo(() => new Set(progress.completedLessons), [progress.completedLessons]);
  const selectedDay = Number(selectedLessonId);
  const selectedLessonIndex = lessons.findIndex((lesson) => lesson.id === selectedLessonId);

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
      setSelectedLessonId(String(day + 1));
    }
  }

  function selectLesson(lessonId: string) {
    if (lessonId === COURSE_MATERIALS_LESSON_ID) {
      setSelectedLessonId(lessonId);
      return;
    }

    const day = Number(lessonId);
    if (!Number.isFinite(day) || day < 1 || day > TTT_TOTAL_LESSONS) return;
    setSelectedLessonId(lessonId);
    setProgress((current) => ({
      ...current,
      lastViewedLesson: day,
    }));
  }

  function goToOffset(offset: number) {
    const nextIndex = Math.min(lessons.length - 1, Math.max(0, selectedLessonIndex + offset));
    const nextLessonId = lessons[nextIndex]?.id;
    if (nextLessonId) {
      selectLesson(nextLessonId);
    }
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
        selectedLessonId={selectedLessonId}
        completedCount={completedLessons.size}
        totalLessons={TTT_TOTAL_LESSONS}
        backHref="/dashboard/courses"
        completionDisabled={selectedLessonId === COURSE_MATERIALS_LESSON_ID || completedLessons.has(selectedDay)}
        onSelectLesson={selectLesson}
        onMarkComplete={markLessonComplete}
        onSelectPrevious={selectedLessonIndex > 0 ? () => goToOffset(-1) : undefined}
        onSelectNext={selectedLessonIndex < lessons.length - 1 ? () => goToOffset(1) : undefined}
      />
    </motion.div>
  );
}
