import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

interface FormStepCardProps {
  title: string;
  guidance: string;
  stepLabel: string;
  isComplete?: boolean;
  children: ReactNode;
}

export default function FormStepCard({
  title,
  guidance,
  stepLabel,
  isComplete = false,
  children,
}: FormStepCardProps) {
  return (
    <div className="glass-card cosmic-motion relative overflow-hidden rounded-2xl p-5 sm:p-6">
      <AnimatePresence>
        {isComplete ? (
          <motion.div
            key={`${title}-completion`}
            initial={{ opacity: 0, x: "-120%" }}
            animate={{ opacity: 1, x: "120%" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-emerald-300/12 to-transparent"
          />
        ) : null}
      </AnimatePresence>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-white/50">{stepLabel}</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">{guidance}</p>
        </div>

        <AnimatePresence initial={false}>
          {isComplete ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-100"
            >
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/20">✓</span>
              <span>Perfect, we've got what we need here.</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
