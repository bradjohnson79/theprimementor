import type { CourseLessonDefinition } from "../../lib/courses.config";

interface CourseDaySelectorProps {
  lessons: readonly CourseLessonDefinition[];
  selectedDay: number;
  completedLessons: Set<number>;
  lastViewedLesson: number;
  onSelect: (day: number) => void;
}

function getStatusLabel(
  day: number,
  completedLessons: Set<number>,
  lastViewedLesson: number,
  selectedDay: number,
) {
  if (completedLessons.has(day)) {
    return "Completed";
  }
  if (day === selectedDay || day === lastViewedLesson) {
    return "In Progress";
  }
  return "Not Started";
}

export default function CourseDaySelector({
  lessons,
  selectedDay,
  completedLessons,
  lastViewedLesson,
  onSelect,
}: CourseDaySelectorProps) {
  return (
    <div className="overflow-x-auto pb-1 md:overflow-visible md:pb-0">
      <div className="flex gap-3 md:flex-col">
        {lessons.map((lesson) => {
          const isActive = lesson.day === selectedDay;
          const isCompleted = completedLessons.has(lesson.day);
          const status = getStatusLabel(lesson.day, completedLessons, lastViewedLesson, selectedDay);

          return (
            <div key={lesson.day} className="group relative shrink-0">
              <button
                type="button"
                onClick={() => onSelect(lesson.day)}
                className={`relative flex min-w-28 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition duration-200 hover:-translate-y-0.5 hover:brightness-110 md:min-w-0 ${
                  isActive
                    ? "border-cyan-300/40 bg-cyan-300/12 text-white shadow-[0_0_22px_rgba(103,232,249,0.16)]"
                    : isCompleted
                      ? "border-teal-300/30 bg-teal-400/10 text-white/95 shadow-[0_0_20px_rgba(45,212,191,0.12)]"
                      : "border-white/10 bg-white/[0.04] text-white/75 hover:border-white/20 hover:bg-white/[0.08]"
                }`}
                aria-pressed={isActive}
              >
                <div>
                  <p className="text-sm font-semibold tracking-wide">Day {lesson.day}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-white/45">{status}</p>
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/15">
                  {isCompleted ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-teal-200">
                      <path d="M3.5 8.25L6.5 11.25L12.5 5.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span className="text-xs font-semibold text-white/55">{lesson.day}</span>
                  )}
                </div>
              </button>
              <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-950/95 px-2 py-1 text-[11px] font-medium text-white/80 shadow-xl group-hover:block">
                {status}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
