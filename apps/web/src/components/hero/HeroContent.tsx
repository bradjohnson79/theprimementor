import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

interface HeroContentProps {
  onExploreReports?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

const CTA_CLASS_NAME = [
  "inline-flex items-center justify-center",
  "rounded-xl border border-white/22 bg-black/35 px-6 py-3 text-white shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md transition",
  "hover:border-white/30 hover:bg-black/45 hover:shadow-[0_0_24px_rgba(255,255,255,0.12)]",
].join(" ");

export default function HeroContent({ onExploreReports }: HeroContentProps) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.65, ease: "easeOut" as const };

  return (
    <div className="relative z-20 max-w-[36rem] text-left">
      <motion.p
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition}
        className="text-[0.74rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/85"
      >
        The Prime Mentor
      </motion.p>

      <motion.h1
        id="hero-heading"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: prefersReducedMotion ? 0 : 0.08 }}
        className="hero-headline mt-5 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-[4.3rem] lg:leading-[0.94]"
      >
        Step Into Your
        <br />
        Prime Alignment
      </motion.h1>

      <motion.p
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: prefersReducedMotion ? 0 : 0.18 }}
        className="mt-5 max-w-[31rem] text-sm leading-7 text-white/88 sm:text-base [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]"
      >
        Precision mentoring, advanced reports, and guided transformation built as one structured system for real clarity, real integration, and real forward motion.
      </motion.p>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: prefersReducedMotion ? 0 : 0.3 }}
        className="mt-8 flex flex-col gap-3 sm:flex-row"
      >
        <Link to="/sign-up" className={`${CTA_CLASS_NAME} min-w-[11rem] font-medium`}>
          Book a Session
        </Link>
        <Link
          to="/#reports"
          onClick={onExploreReports}
          className={`${CTA_CLASS_NAME} min-w-[11rem] text-white/88`}
        >
          Explore Reports
        </Link>
      </motion.div>
    </div>
  );
}
