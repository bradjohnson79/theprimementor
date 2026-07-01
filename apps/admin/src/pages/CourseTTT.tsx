import { CourseLearningShell, type CourseLearningLesson, type CourseLearningSelectedLesson } from "@wisdom/ui/courses";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

const TTT_SUMMARY =
  "Through this 10-day guided course, you will learn a proven technique designed to neutralize trauma and cultivate a deep sense of inner peace.";

const TTT_LESSONS = [
  ["1", "Day 1", "https://www.youtube.com/embed/_qFtwHnz020?rel=0&modestbranding=1"],
  ["2", "Day 2", "https://www.youtube.com/embed/mQGCdaLSx6o?rel=0&modestbranding=1"],
  ["3", "Day 3", "https://www.youtube.com/embed/J3qlxH2_u-o?rel=0&modestbranding=1"],
  ["4", "Day 4", "https://www.youtube.com/embed/q_hI5snvIow?rel=0&modestbranding=1"],
  ["5", "Day 5", "https://www.youtube.com/embed/8BJ1-5_sSTM?rel=0&modestbranding=1"],
  ["6", "Day 6", "https://www.youtube.com/embed/w_Lato5hOFE?rel=0&modestbranding=1"],
  ["7", "Day 7", "https://www.youtube.com/embed/Cvw1gxLbb_Q?rel=0&modestbranding=1"],
  ["8", "Day 8", "https://www.youtube.com/embed/9nvSxfpFTFA?rel=0&modestbranding=1"],
  ["9", "Day 9", "https://www.youtube.com/embed/T_ryrwpljJY?rel=0&modestbranding=1"],
  ["10", "Day 10", "https://www.youtube.com/embed/mQxy6hUhZ60?rel=0&modestbranding=1"],
] as const;

function toLearningLessons(completed: Set<string>): CourseLearningLesson[] {
  return TTT_LESSONS.map(([id, title]) => ({
    id,
    sequence: Number(id),
    moduleTitle: title,
    title,
    status: completed.has(id) ? "completed" : "unlocked",
  }));
}

function toSelectedLesson(id: string): CourseLearningSelectedLesson {
  const lesson = TTT_LESSONS.find(([lessonId]) => lessonId === id) ?? TTT_LESSONS[0];
  return {
    id: lesson[0],
    sequence: Number(lesson[0]),
    moduleTitle: lesson[1],
    title: lesson[1],
    description: [TTT_SUMMARY],
    videoUrl: lesson[2],
    resources: [],
  };
}

export default function CourseTTT() {
  const [selectedLessonId, setSelectedLessonId] = useState("1");
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(() => new Set());
  const lessons = useMemo(() => toLearningLessons(completedLessonIds), [completedLessonIds]);
  const selectedLesson = useMemo(() => toSelectedLesson(selectedLessonId), [selectedLessonId]);
  const selectedIndex = lessons.findIndex((lesson) => lesson.id === selectedLessonId);

  function markComplete(lessonId: string) {
    setCompletedLessonIds((current) => new Set([...current, lessonId]));
  }

  function goToOffset(offset: number) {
    const nextIndex = Math.min(lessons.length - 1, Math.max(0, selectedIndex + offset));
    setSelectedLessonId(lessons[nextIndex]?.id ?? "1");
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <CourseLearningShell
        title="Trauma Transcendence Technique"
        summary={TTT_SUMMARY}
        thumbnailUrl="/images/Trauma-Transcendence-Technique-banner.png"
        badge="Free · Admin access"
        lessons={lessons}
        selectedLesson={selectedLesson}
        selectedLessonId={selectedLessonId}
        completedCount={completedLessonIds.size}
        totalLessons={lessons.length}
        backHref="/admin/courses"
        message="Admin access opens all lessons immediately."
        onSelectLesson={setSelectedLessonId}
        onMarkComplete={markComplete}
        onSelectPrevious={selectedIndex > 0 ? () => goToOffset(-1) : undefined}
        onSelectNext={selectedIndex < lessons.length - 1 ? () => goToOffset(1) : undefined}
      />
    </motion.div>
  );
}
