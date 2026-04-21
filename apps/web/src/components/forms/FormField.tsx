import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { OPTIONAL_FIELD_MESSAGE } from "../../lib/forms/validationEngine";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  helperText?: string;
  errorText?: string | null;
  successText?: string;
  isComplete?: boolean;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

export default function FormField({
  label,
  htmlFor,
  helperText,
  errorText,
  successText = "Perfect, we've got what we need here.",
  isComplete = false,
  optional = false,
  className = "",
  children,
}: FormFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const showHelper = Boolean(helperText) && (isFocused || (!errorText && !isComplete));
  const showSuccess = isComplete && !errorText;

  return (
    <label className={["block text-sm text-white/70", className].join(" ")} htmlFor={htmlFor}>
      <span className="flex flex-wrap items-center gap-2">
        <span>{label}</span>
        {optional ? (
          <span className="text-xs font-medium text-white/40">{OPTIONAL_FIELD_MESSAGE}</span>
        ) : null}
      </span>

      <div
        onFocusCapture={() => setIsFocused(true)}
        onBlurCapture={() => setIsFocused(false)}
        className={[
          "relative mt-1 rounded-2xl transition-all duration-200 ease-out",
          isFocused ? "shadow-[0_0_0_1px_rgba(34,211,238,0.28),0_0_24px_rgba(34,211,238,0.12)]" : "",
          showSuccess ? "shadow-[0_0_0_1px_rgba(74,222,128,0.28),0_0_20px_rgba(74,222,128,0.1)]" : "",
          errorText ? "shadow-[0_0_0_1px_rgba(251,191,36,0.28),0_0_20px_rgba(251,191,36,0.08)]" : "",
          optional ? "opacity-90" : "",
        ].join(" ")}
      >
        {children}

        <AnimatePresence>
          {showSuccess ? (
            <motion.span
              initial={{ opacity: 0, scale: 0.85, y: 2 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200"
            >
              ✓
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {errorText ? (
          <motion.span
            key="error"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mt-2 block text-sm text-amber-200"
          >
            {errorText}
          </motion.span>
        ) : showSuccess ? (
          <motion.span
            key="success"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mt-2 block text-sm text-emerald-200"
          >
            {successText}
          </motion.span>
        ) : showHelper ? (
          <motion.span
            key="helper"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mt-2 block text-xs text-white/45"
          >
            {helperText}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </label>
  );
}
