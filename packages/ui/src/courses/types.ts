import type { ReactNode } from "react";

export interface CourseCatalogCardProps {
  title: string;
  description: string;
  badge: string;
  badgeTone?: "free" | "paid" | "owned";
  ctaLabel: string;
  thumbnailUrl: string;
  href?: string;
  onAction?: () => void;
  disabled?: boolean;
  meta?: string;
}

export interface CourseLearningLesson {
  id: string;
  sequence: number;
  moduleTitle: string;
  title: string;
  status: "locked" | "unlocked" | "completed";
}

export interface CourseLearningResource {
  id: string;
  title: string;
  url: string;
}

export interface CourseLearningSelectedLesson {
  id: string;
  sequence: number;
  moduleTitle: string;
  title: string;
  description: string[];
  videoUrl: string;
  resources: CourseLearningResource[];
}

export interface CourseLearningShellProps {
  title: string;
  summary: string;
  thumbnailUrl?: string;
  badge: string;
  lessons: CourseLearningLesson[];
  selectedLesson: CourseLearningSelectedLesson | null;
  selectedLessonId: string | null;
  completedCount: number;
  totalLessons: number;
  isLoadingLesson?: boolean;
  isCompleting?: boolean;
  completionDisabled?: boolean;
  backHref: string;
  backLabel?: string;
  message?: ReactNode;
  error?: ReactNode;
  onSelectLesson: (lessonId: string) => void;
  onMarkComplete: (lessonId: string) => void;
  onSelectNext?: () => void;
  onSelectPrevious?: () => void;
}
