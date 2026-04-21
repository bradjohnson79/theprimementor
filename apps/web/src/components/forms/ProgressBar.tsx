import { motion } from "framer-motion";
import { FRIENDLY_HELPER_MESSAGE } from "../../lib/forms/validationEngine";

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  steps: Array<{
    id: string;
    title: string;
    complete?: boolean;
  }>;
  helperText?: string;
}

export default function ProgressBar({
  currentStep,
  totalSteps,
  steps,
  helperText = FRIENDLY_HELPER_MESSAGE,
}: ProgressBarProps) {
  const progress = totalSteps > 1 ? ((currentStep + 1) / totalSteps) * 100 : 100;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/62">
            Step {currentStep + 1} of {totalSteps} - You're doing great
          </p>
          <p className="mt-2 text-sm text-white/60">{helperText}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55">
          {steps[currentStep]?.title}
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-300 shadow-[0_0_24px_rgba(34,211,238,0.35)]"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isComplete = step.complete && index <= currentStep;
          return (
            <div
              key={step.id}
              className={[
                "rounded-xl border px-3 py-2 transition-all duration-200 ease-out",
                isActive
                  ? "border-cyan-300/40 bg-cyan-400/10 text-white shadow-[0_0_22px_rgba(34,211,238,0.15)]"
                  : isComplete
                    ? "border-emerald-400/20 bg-emerald-500/5 text-white/80"
                    : "border-white/8 bg-white/[0.03] text-white/45",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <span
                  className={[
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
                    isActive
                      ? "bg-cyan-300/20 text-cyan-100"
                      : isComplete
                        ? "bg-emerald-400/15 text-emerald-100"
                        : "bg-white/8 text-white/45",
                  ].join(" ")}
                >
                  {isComplete ? "✓" : index + 1}
                </span>
                <span className="text-xs font-medium">{step.title}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
