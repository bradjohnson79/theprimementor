import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ValidationErrors, ValidationResult } from "../../lib/forms/validationEngine";
import FormStepCard from "./FormStepCard";
import ProgressBar from "./ProgressBar";

export interface StepRenderContext {
  currentStep: number;
  goToStep: (index: number) => void;
}

export interface StepConfig<TState> {
  id: string;
  title: string;
  guidance: string;
  render: (context: StepRenderContext) => ReactNode;
  validate: (state: TState) => ValidationResult;
  isComplete?: (state: TState) => boolean;
}

interface FormStepperProps<TState> {
  steps: Array<StepConfig<TState>>;
  state: TState;
  onValidationErrors: (errors: ValidationErrors) => void;
  onComplete: () => Promise<void> | void;
  completeLabel: string;
  isSubmitting?: boolean;
  footerStart?: ReactNode;
  submitError?: string | null;
  resetKey?: string | number;
}

export default function FormStepper<TState>({
  steps,
  state,
  onValidationErrors,
  onComplete,
  completeLabel,
  isSubmitting = false,
  footerStart = null,
  submitError = null,
  resetKey,
}: FormStepperProps<TState>) {
  const [currentStep, setCurrentStep] = useState(0);
  const stepContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCurrentStep(0);
  }, [resetKey]);

  useEffect(() => {
    if (currentStep > steps.length - 1) {
      setCurrentStep(Math.max(steps.length - 1, 0));
    }
  }, [currentStep, steps.length]);

  useEffect(() => {
    stepContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentStep]);

  const currentConfig = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const stepStates = useMemo(
    () =>
      steps.map((step, index) => ({
        id: step.id,
        title: step.title,
        complete: step.isComplete ? step.isComplete(state) : index < currentStep,
      })),
    [currentStep, state, steps],
  );

  if (!currentConfig) {
    return null;
  }

  async function handleNext() {
    const result = currentConfig.validate(state);
    onValidationErrors(result.errors);
    if (!result.isValid) {
      return;
    }

    if (isLastStep) {
      await onComplete();
      return;
    }

    setCurrentStep((value) => Math.min(value + 1, steps.length - 1));
  }

  function handleBack() {
    setCurrentStep((value) => Math.max(value - 1, 0));
    onValidationErrors({});
  }

  function goToStep(index: number) {
    setCurrentStep(Math.max(0, Math.min(index, steps.length - 1)));
    onValidationErrors({});
  }

  return (
    <div className="space-y-6">
      <ProgressBar currentStep={currentStep} totalSteps={steps.length} steps={stepStates} />

      <div ref={stepContainerRef}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentConfig.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <FormStepCard
              stepLabel={`Step ${currentStep + 1} of ${steps.length}`}
              title={currentConfig.title}
              guidance={currentConfig.guidance}
              isComplete={Boolean(currentConfig.isComplete?.(state))}
            >
              {currentConfig.render({ currentStep, goToStep })}

              {submitError ? (
                <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-950/35 px-4 py-3 text-sm text-amber-100">
                  {submitError}
                </div>
              ) : null}

              <div className="mt-6 flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <div>{footerStart}</div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  {currentStep > 0 ? (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="rounded-xl border border-white/15 px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/5"
                    >
                      Back
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void handleNext()}
                    disabled={isSubmitting}
                    className="rounded-xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(255,215,0,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? "Processing..." : isLastStep ? completeLabel : "Next step"}
                  </button>
                </div>
              </div>
            </FormStepCard>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
