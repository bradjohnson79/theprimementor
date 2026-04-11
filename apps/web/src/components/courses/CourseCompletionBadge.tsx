import { motion } from "framer-motion";

interface CourseCompletionBadgeProps {
  completedCount: number;
  totalLessons: number;
}

export default function CourseCompletionBadge({
  completedCount,
  totalLessons,
}: CourseCompletionBadgeProps) {
  return (
    <section className="glass-card relative overflow-hidden rounded-2xl border border-amber-300/25 p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.16),transparent_42%),radial-gradient(circle_at_bottom,rgba(168,85,247,0.18),transparent_48%)]" />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <motion.div
            className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-amber-300/40 bg-[radial-gradient(circle,rgba(245,158,11,0.32),rgba(109,40,217,0.18)_64%,rgba(15,23,42,0.9)_100%)] shadow-[0_0_40px_rgba(245,158,11,0.18)]"
            animate={{ scale: [1, 1.03, 1], opacity: [0.92, 1, 0.92] }}
            transition={{ duration: 3.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          >
            <motion.div
              className="absolute inset-2 rounded-full border border-white/10"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 18, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            />
            <div className="relative text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-amber-100/80">Graduate</p>
              <p className="mt-1 text-2xl text-amber-100">✦</p>
            </div>
          </motion.div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-100/65">Course Completed</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Trauma Transcendence Graduate</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
              You have completed the full Trauma Transcendence Technique.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/70">
          Progress: {completedCount} / {totalLessons} Completed
        </div>
      </div>
    </section>
  );
}
