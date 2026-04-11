import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { Link } from "react-router-dom";

type TeaserState = "locked" | "initiates_locked" | "eligible";

interface MentorTrainingTeaserCardProps {
  state: TeaserState;
  isLoading?: boolean;
}

function LockGlyph({ locked, hovered }: { locked: boolean; hovered: boolean }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.span
      aria-hidden="true"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[#f0d8a8] shadow-[0_0_18px_rgba(240,216,168,0.12)]"
      animate={
        locked && !prefersReducedMotion
          ? hovered
            ? {
                x: [0, -2, 2, -1, 1, 0],
                scale: 1.05,
                opacity: 1,
              }
            : {
                x: 0,
                scale: [1, 1.05, 1],
                opacity: [0.85, 1, 0.85],
              }
          : undefined
      }
      transition={
        locked && !prefersReducedMotion
          ? hovered
            ? { duration: 0.2, ease: "easeOut" }
            : {
                duration: 3.8,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }
          : undefined
      }
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M8.75 10V7.75C8.75 5.679 10.429 4 12.5 4C14.571 4 16.25 5.679 16.25 7.75V10"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="6.25"
          y="10"
          width="12.5"
          height="10"
          rx="2.5"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <circle cx="12.5" cy="15" r="1.2" fill="currentColor" />
      </svg>
    </motion.span>
  );
}

export default function MentorTrainingTeaserCard({
  state,
  isLoading = false,
}: MentorTrainingTeaserCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const locked = state !== "eligible";
  const showHelper = state === "initiates_locked";
  const hoverMicrocopy = locked
    ? "This path unlocks once your foundation is complete."
    : "Your next level is ready to open.";

  return (
    <motion.section
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: locked && !prefersReducedMotion
          ? [
              "0 20px 54px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.08), 0 0 0 rgba(0,0,0,0)",
              "0 24px 62px rgba(0,0,0,0.34), 0 0 0 1px rgba(255,255,255,0.10), 0 0 24px rgba(196,160,255,0.16)",
              "0 20px 54px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.08), 0 0 0 rgba(0,0,0,0)",
            ]
          : "0 24px 62px rgba(0,0,0,0.36), 0 0 0 1px rgba(255,255,255,0.1)",
      }}
      transition={{
        duration: prefersReducedMotion ? 0.3 : 0.55,
        ease: "easeOut",
        ...(locked && !prefersReducedMotion
          ? {
              boxShadow: {
                duration: 3.8,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              },
            }
          : {}),
      }}
      whileHover={prefersReducedMotion
        ? undefined
        : {
            y: -2,
            filter: locked ? "brightness(1.05)" : "brightness(1.03)",
            boxShadow: locked
              ? "0 28px 68px rgba(0,0,0,0.38), 0 0 0 1px rgba(255,255,255,0.13), 0 0 30px rgba(240,216,168,0.14), 0 0 46px rgba(164,120,255,0.18)"
              : "0 28px 68px rgba(0,0,0,0.38), 0 0 0 1px rgba(255,255,255,0.14), 0 0 36px rgba(34,211,238,0.18)",
          }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className={[
        "group relative overflow-hidden rounded-2xl border border-white/10 px-6 py-7 sm:px-8 sm:py-8",
        "bg-white/[0.045] backdrop-blur-md",
        locked ? "cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(240,216,168,0.12),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(148,124,255,0.14),_transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]"
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-slate-950/10 transition-opacity duration-300 ${
          locked ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[1px] rounded-[calc(1rem-1px)] border border-white/[0.06]"
      />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
        <LockGlyph locked={locked} hovered={hovered} />

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-[#d9bc83]/85">
          Exclusive to Initiate Members
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[2rem]">
          Mentor Training Pathway
        </h2>

        <div className="mt-5 max-w-3xl space-y-4 text-sm leading-relaxed text-white/72 sm:text-[0.96rem]">
          <p>
            This advanced stage of development extends beyond sessions into a more structured path of refinement,
            preparing the member to grow into a capable mentor within the Prime Mentor system.
          </p>
          <p>
            Access is opened only after a completed Mentoring Session, marking readiness, integration, and the deeper
            responsibility required to step into this level of guidance.
          </p>
        </div>

        <div className="mt-8 w-full max-w-md">
          {isLoading ? (
            <div className="mx-auto h-12 w-full animate-pulse rounded-xl border border-white/10 bg-white/[0.07]" />
          ) : locked ? (
            <div className="relative">
              <button
                type="button"
                disabled
                title="Available after completing a Mentoring Session as an Initiate Member"
                className="w-full rounded-xl border border-white/12 bg-gradient-to-r from-[#d8be8a]/18 via-[#a989ff]/14 to-[#d8be8a]/18 px-5 py-3 text-sm font-semibold text-white/62 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              >
                Unlock Through Mentoring
              </button>
              <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-3 w-full max-w-sm -translate-x-1/2 rounded-xl border border-white/10 bg-[#0b1020]/94 px-4 py-3 text-xs leading-relaxed text-white/72 opacity-0 shadow-[0_20px_44px_rgba(0,0,0,0.38)] transition duration-200 group-hover:opacity-100">
                Available after completing a Mentoring Session as an Initiate Member
              </div>
            </div>
          ) : (
            <Link
              to="/mentor-training"
              className="block w-full rounded-xl bg-gradient-to-r from-cyan-300 via-cyan-400 to-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,0.24)] transition hover:brightness-105"
            >
              Enter Mentor Training
            </Link>
          )}

          <div className="mt-3 min-h-5">
            {showHelper ? (
              <p className="text-sm text-white/62">Complete a Mentoring Session to become eligible</p>
            ) : null}
          </div>

          <p className="mt-2 text-xs text-white/0 transition duration-300 group-hover:text-white/52">
            {hoverMicrocopy}
          </p>
        </div>
      </div>
    </motion.section>
  );
}
