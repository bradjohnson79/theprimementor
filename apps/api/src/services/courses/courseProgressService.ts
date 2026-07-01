import { and, eq } from "drizzle-orm";
import { courseLessonProgress, type Database } from "@wisdom/db";
import { createHttpError } from "../booking/errors.js";
import {
  RESONANT_DOWSING_COURSE_SLUG,
  canAccessCourseContent,
  getCourseEntitlement,
} from "./courseEntitlementService.js";
import {
  RESONANT_DOWSING_TOTAL_LESSONS,
  getCurrentUnlockedLessonId,
  getNextLessonId,
  getResonantDowsingLessonById,
  getResonantDowsingLessonSummaries,
  getResonantDowsingPublicCourse,
} from "./resonantDowsingCourse.js";

export interface CourseAccessPolicyInput {
  userId: string;
  role: string;
}

export async function listCompletedResonantLessonIds(db: Database, userId: string) {
  const rows = await db
    .select({ lessonId: courseLessonProgress.lesson_id })
    .from(courseLessonProgress)
    .where(and(
      eq(courseLessonProgress.user_id, userId),
      eq(courseLessonProgress.course_slug, RESONANT_DOWSING_COURSE_SLUG),
    ));
  return new Set(rows.map((row) => row.lessonId));
}

async function resolveCourseAccess(db: Database, input: CourseAccessPolicyInput) {
  const entitlement = await getCourseEntitlement(db, {
    userId: input.userId,
    courseSlug: RESONANT_DOWSING_COURSE_SLUG,
  });
  const isAdmin = input.role === "admin";
  const hasAccess = canAccessCourseContent({ role: input.role, entitlement });
  return { entitlement, isAdmin, hasAccess };
}

export async function getResonantDowsingAccessState(db: Database, input: CourseAccessPolicyInput) {
  const access = await resolveCourseAccess(db, input);
  return {
    course: {
      ...getResonantDowsingPublicCourse(),
      ...(access.hasAccess ? { moduleCount: 13, totalLessons: RESONANT_DOWSING_TOTAL_LESSONS } : {}),
    },
    hasAccess: access.hasAccess,
    accessSource: access.isAdmin ? "admin" as const : access.hasAccess ? "entitlement" as const : "locked" as const,
  };
}

export async function getResonantDowsingProgressOutline(db: Database, input: CourseAccessPolicyInput) {
  const access = await resolveCourseAccess(db, input);
  if (!access.hasAccess) {
    throw createHttpError(403, "The Resonant Dowsing Course requires purchase before viewing the curriculum.");
  }

  const completedLessonIds = await listCompletedResonantLessonIds(db, input.userId);
  const unlockedLessonId = getCurrentUnlockedLessonId(completedLessonIds);
  return {
    course: {
      ...getResonantDowsingPublicCourse(),
      moduleCount: 13,
      totalLessons: RESONANT_DOWSING_TOTAL_LESSONS,
    },
    accessSource: access.isAdmin ? "admin" as const : "entitlement" as const,
    progress: {
      completedLessonIds: [...completedLessonIds],
      unlockedLessonId,
      completedCount: completedLessonIds.size,
      totalLessons: RESONANT_DOWSING_TOTAL_LESSONS,
    },
    lessons: getResonantDowsingLessonSummaries({
      completedLessonIds,
      unlockedLessonId,
      admin: access.isAdmin,
    }),
  };
}

export async function getResonantDowsingLessonDetail(
  db: Database,
  input: CourseAccessPolicyInput & { lessonId: string },
) {
  const outline = await getResonantDowsingProgressOutline(db, input);
  const summary = outline.lessons.find((lesson) => lesson.id === input.lessonId);
  if (!summary) {
    throw createHttpError(404, "Lesson not found.");
  }
  if (summary.status === "locked") {
    throw createHttpError(403, "This lesson is locked until the previous lesson is complete.");
  }

  const lesson = getResonantDowsingLessonById(input.lessonId);
  if (!lesson) {
    throw createHttpError(404, "Lesson not found.");
  }

  return {
    lesson,
    progress: outline.progress,
    accessSource: outline.accessSource,
  };
}

export async function markResonantDowsingLessonComplete(
  db: Database,
  input: CourseAccessPolicyInput & { lessonId: string },
) {
  const access = await resolveCourseAccess(db, input);
  if (!access.hasAccess) {
    throw createHttpError(403, "The Resonant Dowsing Course requires purchase before marking lessons complete.");
  }

  const completedLessonIds = await listCompletedResonantLessonIds(db, input.userId);
  const lesson = getResonantDowsingLessonById(input.lessonId);
  if (!lesson) {
    throw createHttpError(404, "Lesson not found.");
  }

  const currentUnlockedLessonId = getCurrentUnlockedLessonId(completedLessonIds);
  if (!access.isAdmin && input.lessonId !== currentUnlockedLessonId && !completedLessonIds.has(input.lessonId)) {
    throw createHttpError(403, "Only the currently unlocked lesson can be marked complete.");
  }

  await db
    .insert(courseLessonProgress)
    .values({
      user_id: input.userId,
      course_slug: RESONANT_DOWSING_COURSE_SLUG,
      lesson_id: input.lessonId,
      completed_at: new Date(),
      updated_at: new Date(),
    })
    .onConflictDoNothing({
      target: [
        courseLessonProgress.user_id,
        courseLessonProgress.course_slug,
        courseLessonProgress.lesson_id,
      ],
    });

  const nextCompletedLessonIds = await listCompletedResonantLessonIds(db, input.userId);
  const unlockedLessonId = getCurrentUnlockedLessonId(nextCompletedLessonIds);
  return {
    completedLessonIds: [...nextCompletedLessonIds],
    unlockedLessonId,
    nextLessonId: getNextLessonId(input.lessonId),
    completedCount: nextCompletedLessonIds.size,
    totalLessons: RESONANT_DOWSING_TOTAL_LESSONS,
  };
}
