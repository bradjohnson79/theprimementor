import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

interface HeroContentProps {
  onExploreReports?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

const CTA_CLASS_NAME = [
  "inline-flex items-center justify-center",
  "rounded-xl border px-5 py-3 text-sm shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md transition",
  "sm:min-w-[10.5rem]",
].join(" ");

const PRIMARY_CTA_CLASS_NAME = [
  CTA_CLASS_NAME,
  "border-cyan-200/40 bg-gradient-to-r from-cyan-300 to-teal-300 font-semibold text-slate-950",
  "hover:border-cyan-100/70 hover:brightness-110 hover:shadow-[0_0_28px_rgba(34,211,238,0.22)]",
].join(" ");

const SECONDARY_CTA_CLASS_NAME = [
  CTA_CLASS_NAME,
  "border-white/22 bg-black/35 text-white/88",
  "hover:border-white/30 hover:bg-black/45 hover:text-white hover:shadow-[0_0_24px_rgba(255,255,255,0.12)]",
].join(" ");

const MEMBERSHIP_BENEFITS = [
  "Full Access to Divin8 Chat (200 prompts/month)",
  "20% Off Monthly Mentoring Circle Webinars",
  "Exclusive Discounts on Upcoming Prime Mentor E-Courses",
];

export default function HeroContent({ onExploreReports }: HeroContentProps) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.65, ease: "easeOut" as const };

  return (
    <div className="relative z-20 max-w-[39rem] text-left">
      <motion.p
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition}
        className="text-[0.74rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/85"
      >
        The Prime Mentor Membership
      </motion.p>

      <motion.h1
        id="hero-heading"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: prefersReducedMotion ? 0 : 0.08 }}
        className="hero-headline mt-5 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-[4.05rem] lg:leading-[0.96]"
      >
        Unlock Your Premium Path to Guidance, Insight & Growth
      </motion.h1>

      <motion.p
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: prefersReducedMotion ? 0 : 0.18 }}
        className="mt-5 max-w-[31rem] text-sm leading-7 text-white/88 sm:text-base [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]"
      >
        Get full access to Divin8 Chat, member savings, webinar discounts, and exclusive course pricing — designed to help you move forward with greater clarity and direction.
      </motion.p>

      <motion.ul
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: prefersReducedMotion ? 0 : 0.24 }}
        className="mt-5 max-w-[34rem] space-y-2 text-sm text-white/82"
      >
        {MEMBERSHIP_BENEFITS.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2.5 leading-snug">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-200/10 text-xs font-semibold text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.12)]">
              ✓
            </span>
            <span>{benefit}</span>
          </li>
        ))}
      </motion.ul>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: prefersReducedMotion ? 0 : 0.3 }}
        className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
      >
        <Link to="/subscriptions/seeker" className={`${PRIMARY_CTA_CLASS_NAME} w-full sm:w-auto`}>
          Join Premium
        </Link>
        <Link to="/#sessions" className={`${SECONDARY_CTA_CLASS_NAME} w-full sm:w-auto`}>
          Explore Sessions
        </Link>
        <Link
          to="/#reports"
          onClick={onExploreReports}
          className={`${SECONDARY_CTA_CLASS_NAME} w-full sm:w-auto`}
        >
          Explore Reports
        </Link>
      </motion.div>

      <motion.p
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: prefersReducedMotion ? 0 : 0.38 }}
        className="mt-3 text-sm font-medium text-cyan-100/76 [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]"
      >
        Only $14.99/month or $144/year
      </motion.p>
    </div>
  );
}
