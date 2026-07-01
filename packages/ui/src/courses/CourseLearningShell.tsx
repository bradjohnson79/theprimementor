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
  nextDisabled = false,
  statusPill,
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
  const canSelectNext = Boolean(onSelectNext && !nextDisabled);
  const descriptionAsList = Boolean(selectedLesson && selectedLesson.description.length > 1);

  return (
    <div className="dashboard-shell">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="dashboard-panel relative overflow-hidden border border-white/10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-end">
            <div>
              <a href={backHref} className="text-sm font-medium text-cyan-100/75 hover:text-cyan-100">
                {"<-"} {backLabel}
              </a>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/60">{badge}</p>
                {statusPill ? (
                  <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50/85">
                    {statusPill.label}: {statusPill.value}
                  </span>
                ) : null}
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/68 sm:text-base">{summary}</p>
              <div className="mt-5 max-w-3xl">
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
            </div>
            {thumbnailUrl ? (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 shadow-[0_18px_44px_rgba(8,15,30,0.32)]">
                <img src={thumbnailUrl} alt="" className="aspect-video h-full w-full object-cover" />
              </div>
            ) : null}
          </div>
        </section>

        {message ? <div className="dashboard-panel border border-cyan-200/15 bg-cyan-200/5 text-sm text-cyan-50/80">{message}</div> : null}
        {error ? <div className="dashboard-panel border border-red-300/20 bg-red-500/10 text-sm text-red-100">{error}</div> : null}

        <section className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="dashboard-panel h-fit p-4 sm:p-5 xl:sticky xl:top-24">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">Lesson Navigation</p>
            <div className="mt-4 flex max-h-[calc(100vh-12rem)] flex-col gap-3 overflow-y-auto pr-1">
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
                    className={`relative flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition duration-200 ${
                      isActive
                        ? "border-cyan-300/55 bg-cyan-300/12 text-white shadow-[0_0_24px_rgba(103,232,249,0.2)]"
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
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20">
                      {isCompleted ? (
                        <svg className="h-4 w-4 text-teal-200" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M3.5 8.2 6.5 11 12.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : isLocked ? (
                        <svg className="h-4 w-4 text-white/45" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <rect x="3.5" y="7" width="9" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M5.5 7V5.4a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
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
                  <div className="aspect-video min-h-[220px] w-full bg-slate-950 lg:min-h-[420px]">
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

                <section className="dashboard-panel border border-white/10 bg-slate-950/55 shadow-[0_24px_80px_rgba(8,15,30,0.28)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/60">Current Lesson</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">{selectedLesson.moduleTitle}</h2>
                  {descriptionAsList ? (
                    <ul className="mt-4 space-y-2 text-sm leading-relaxed text-white/72">
                      {selectedLesson.description.map((point) => (
                        <li key={point} className="flex gap-3">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-200/70" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {selectedLesson.description.map((paragraph) => (
                        <p key={paragraph} className="text-sm leading-relaxed text-white/70">{paragraph}</p>
                      ))}
                    </div>
                  )}
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => selectedLesson && onMarkComplete(selectedLesson.id)}
                      disabled={!canMarkComplete}
                      className={`inline-flex items-center rounded-md px-4 py-2.5 text-sm font-medium transition ${
                        currentLessonStatus === "completed"
                          ? "dashboard-action-secondary cursor-default border-teal-300/20 bg-teal-300/10 text-teal-100 hover:bg-teal-300/10 hover:text-teal-100"
                          : "dashboard-action-primary disabled:cursor-not-allowed disabled:opacity-50"
                      }`}
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M3.5 8.2 6.5 11 12.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {currentLessonStatus === "completed" ? "Completed" : isCompleting ? "Saving..." : "Mark as Complete"}
                    </button>
                    <button type="button" onClick={onSelectPrevious} className="dashboard-action-secondary" disabled={!onSelectPrevious}>
                      Previous
                    </button>
                    <button type="button" onClick={onSelectNext} className="dashboard-action-secondary disabled:cursor-not-allowed disabled:opacity-45" disabled={!canSelectNext}>
                      Continue to Next Lesson
                      <svg className="ml-2 h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>

                  {selectedLesson.resources.length ? (
                    <div className="mt-7 border-t border-white/10 pt-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">Resources</p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {selectedLesson.resources.map((resource) => (
                        <a
                          key={resource.id}
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-cyan-100/85 transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.06] hover:text-cyan-50"
                        >
                          <span className="flex min-w-0 items-start gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-cyan-100/80">
                              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M4 2.5h5l3 3V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" />
                                <path d="M9 2.5V6h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                              </svg>
                            </span>
                            <span className="min-w-0">
                              <span className="block font-semibold text-white/90">{resource.title}</span>
                              <span className="mt-1 block text-xs text-white/48">{resource.helperText ?? "Downloadable course resource"}</span>
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
                            Open
                            <svg className="ml-1 inline h-3.5 w-3.5 transition group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                              <path d="M6 4h6v6M12 4 5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        </a>
                      ))}
                      </div>
                    </div>
                  ) : null}
                </section>
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
