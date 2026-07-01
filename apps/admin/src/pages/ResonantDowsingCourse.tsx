import { useAuth } from "@clerk/react";
import { CourseLearningShell, type CourseLearningLesson, type CourseLearningSelectedLesson } from "@wisdom/ui/courses";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

interface CourseContentResponse {
  course: {
    title: string;
    description: string[];
    thumbnailUrl: string;
    moduleCount: number;
    totalLessons: number;
  };
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

export default function ResonantDowsingCourse() {
  const { getToken } = useAuth();
  const [content, setContent] = useState<CourseContentResponse | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<CourseLearningSelectedLesson | null>(null);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [completingLessonId, setCompletingLessonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOutline = useCallback(async () => {
    const token = await getToken();
    const response = await api.get("/courses/resonant-dowsing/content", token) as CourseContentResponse;
    setContent(response);
    setSelectedLessonId((current) => current ?? response.lessons[0]?.id ?? null);
  }, [getToken]);

  useEffect(() => {
    void loadOutline().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Course content could not be loaded.");
    });
  }, [loadOutline]);

  const selectedLessonIndex = useMemo(() => {
    if (!content?.lessons.length || !selectedLessonId) return 0;
    return Math.max(0, content.lessons.findIndex((lesson) => lesson.id === selectedLessonId));
  }, [content?.lessons, selectedLessonId]);

  const loadLesson = useCallback(async (lessonId: string) => {
    setLoadingLesson(true);
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
      setLoadingLesson(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (selectedLessonId) {
      void loadLesson(selectedLessonId);
    }
  }, [loadLesson, selectedLessonId]);

  async function markLessonComplete(lessonId: string) {
    setCompletingLessonId(lessonId);
    try {
      const token = await getToken();
      await api.post(`/courses/resonant-dowsing/lessons/${encodeURIComponent(lessonId)}/complete`, undefined, token);
      await loadOutline();
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "Lesson completion could not be saved.");
    } finally {
      setCompletingLessonId(null);
    }
  }

  function goToOffset(offset: number) {
    if (!content?.lessons.length) return;
    const nextIndex = Math.min(content.lessons.length - 1, Math.max(0, selectedLessonIndex + offset));
    setSelectedLessonId(content.lessons[nextIndex]?.id ?? null);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <CourseLearningShell
        title={content?.course.title ?? "The Resonant Dowsing Course"}
        summary={content?.course.description[0] ?? "Resonant Dowsing course content."}
        badge={`${content?.course.moduleCount ?? 13} Modules · ${content?.progress.totalLessons ?? 14} Lessons`}
        statusPill={{ label: "Admin Access", value: "All lessons unlocked" }}
        lessons={content?.lessons ?? []}
        selectedLesson={selectedLesson}
        selectedLessonId={selectedLessonId}
        completedCount={content?.progress.completedCount ?? 0}
        totalLessons={content?.progress.totalLessons ?? 14}
        isLoadingLesson={loadingLesson || !content}
        isCompleting={Boolean(completingLessonId)}
        backHref="/admin/courses"
        error={error}
        onSelectLesson={setSelectedLessonId}
        onMarkComplete={markLessonComplete}
        onSelectPrevious={selectedLessonIndex > 0 ? () => goToOffset(-1) : undefined}
        onSelectNext={content && selectedLessonIndex < content.lessons.length - 1 ? () => goToOffset(1) : undefined}
      />
    </motion.div>
  );
}
