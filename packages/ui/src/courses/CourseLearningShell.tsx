import type { CourseLearningLesson, CourseLearningShellProps } from "./types";

function lessonStatusLabel(lesson: CourseLearningLesson) {
  if (lesson.status === "completed") return "Completed";
  if (lesson.status === "unlocked") return "Unlocked";
  return "Locked";
}

function isValidEmbedUrl(videoUrl: string) {
  try {
    const parsed = new URL(videoUrl);
    return parsed.protocol === "https:" && parsed.hostname.includes("youtube") && parsed.pathname.includes("/embed/");
  } catch {
    return false;
  }
}

export default function CourseLearningShell({
  title,
  summary,
  thumbnailUrl,
  badge,
  lessons,
  selectedLesson,
  selectedLessonId,
  completedCount,
  totalLessons,
  isLoadingLesson = false,
  isCompleting = false,
  completionDisabled = false,
  backHref,
  backLabel = "Back to Courses",
  message,
  error,
  onSelectLesson,
  onMarkComplete,
  onSelectNext,
  onSelectPrevious,
}: CourseLearningShellProps) {
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const currentLessonStatus = selectedLesson
    ? lessons.find((lesson) => lesson.id === selectedLesson.id)?.status
    : null;
  const canMarkComplete = Boolean(selectedLesson && currentLessonStatus !== "completed" && !completionDisabled && !isCompleting);

  return (
    <div className="dashboard-shell">
      <div className="mx-auto max-w-6xl space-y-6">
        <a href={backHref} className="text-sm font-medium text-cyan-100/75 hover:text-cyan-100">
          {"<-"} {backLabel}
        </a>

        <section className="dashboard-panel relative overflow-hidden">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/60">{badge}</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{title}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/68 sm:text-base">{summary}</p>
            </div>
            {thumbnailUrl ? (
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40">
                <img src={thumbnailUrl} alt="" className="aspect-video h-full w-full object-cover" />
              </div>
            ) : null}
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3 text-sm text-white/72">
              <span>Progress: {completedCount} / {totalLessons} Completed</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-teal-300 to-violet-300 transition-[width] duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </section>

        {message ? <div className="dashboard-panel border border-cyan-200/15 bg-cyan-200/5 text-sm text-cyan-50/80">{message}</div> : null}
        {error ? <div className="dashboard-panel border border-red-300/20 bg-red-500/10 text-sm text-red-100">{error}</div> : null}

        <section className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="dashboard-panel p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">Lesson Navigation</p>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
              {lessons.map((lesson) => {
                const isActive = lesson.id === selectedLessonId;
                const isCompleted = lesson.status === "completed";
                const isLocked = lesson.status === "locked";
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    disabled={isLocked}
                    onClick={() => onSelectLesson(lesson.id)}
                    className={`relative flex min-w-56 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition duration-200 md:min-w-0 ${
                      isActive
                        ? "border-cyan-300/40 bg-cyan-300/12 text-white shadow-[0_0_22px_rgba(103,232,249,0.16)]"
                        : isCompleted
                          ? "border-teal-300/30 bg-teal-400/10 text-white/95 shadow-[0_0_20px_rgba(45,212,191,0.12)]"
                          : isLocked
                            ? "cursor-not-allowed border-white/8 bg-white/[0.025] text-white/35"
                            : "border-white/10 bg-white/[0.04] text-white/75 hover:border-white/20 hover:bg-white/[0.08]"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold tracking-wide">{lesson.moduleTitle}</p>
                      <p className="mt-1 text-xs text-white/60">{lesson.title}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-white/45">{lessonStatusLabel(lesson)}</p>
                    </div>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/15">
                      {isCompleted ? (
                        <span className="text-xs font-semibold text-teal-200">OK</span>
                      ) : isLocked ? (
                        <span className="text-xs font-semibold text-white/45">L</span>
                      ) : (
                        <span className="text-xs font-semibold text-white/70">{lesson.sequence}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="space-y-5">
            {isLoadingLesson ? (
              <section className="dashboard-panel text-sm text-white/60">Loading lesson...</section>
            ) : selectedLesson ? (
              <>
                <div className="glass-card overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-[0_24px_80px_rgba(8,15,30,0.32)]">
                  <div className="aspect-video w-full bg-slate-950">
                    {isValidEmbedUrl(selectedLesson.videoUrl) ? (
                      <iframe
                        src={selectedLesson.videoUrl}
                        title={selectedLesson.title}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/60">
                        A valid lesson video is not available.
                      </div>
                    )}
                  </div>
                </div>

                <section className="dashboard-panel">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/60">Current Lesson</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">{selectedLesson.title}</h2>
                  <div className="mt-3 space-y-2">
                    {selectedLesson.description.map((paragraph) => (
                      <p key={paragraph} className="text-sm leading-relaxed text-white/70">{paragraph}</p>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => selectedLesson && onMarkComplete(selectedLesson.id)}
                      disabled={!canMarkComplete}
                      className={`rounded-md px-4 py-2.5 text-sm font-medium transition ${
                        currentLessonStatus === "completed"
                          ? "dashboard-action-secondary cursor-default border-teal-300/20 bg-teal-300/10 text-teal-100 hover:bg-teal-300/10 hover:text-teal-100"
                          : "dashboard-action-primary disabled:cursor-not-allowed disabled:opacity-50"
                      }`}
                    >
                      {currentLessonStatus === "completed" ? "Completed" : isCompleting ? "Saving..." : "Mark as Complete"}
                    </button>
                    <button type="button" onClick={onSelectPrevious} className="dashboard-action-secondary" disabled={!onSelectPrevious}>
                      Previous
                    </button>
                    <button type="button" onClick={onSelectNext} className="dashboard-action-secondary" disabled={!onSelectNext}>
                      Continue to Next Lesson
                    </button>
                  </div>
                </section>

                {selectedLesson.resources.length ? (
                  <section className="dashboard-panel">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">Resources</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {selectedLesson.resources.map((resource) => (
                        <a
                          key={resource.id}
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-cyan-100/85 hover:border-cyan-200/30 hover:text-cyan-50"
                        >
                          {resource.title}
                        </a>
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              <section className="dashboard-panel text-sm text-white/60">Select an unlocked lesson to begin.</section>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
