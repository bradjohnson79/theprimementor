import { useState } from "react";
import { Link } from "react-router-dom";
import { QA_LANDING_PATH, MENTORING_LANDING_PATH } from "../../lib/sessionLandingPaths";

export const HOME_FAQS = [
  {
    question: "What's the difference between a report, a Q&A, and mentoring?",
    answer:
      "A report is written guidance from your birth information, usually in your dashboard within 24 hours Monday–Friday. A Q&A is a live Zoom conversation about the questions you bring. Mentoring is the deepest live session: Brad works with your full Divin8 blueprint and you leave with a plan.",
  },
  {
    question: "Which one should I buy first?",
    answer:
      "If you want something you can read today, start with the $39 3 Questions Report or the $69 Introductory Report. If you want to talk it through, book a Q&A from $139. Mentoring is for when you are ready to work the pattern, not just name it.",
  },
  {
    question: "Do I need an account before I can look around?",
    answer:
      "No. Sales pages, prices, and sample reports are public. You create a free account when you are ready to purchase so recordings and reports have a place to live.",
  },
  {
    question: "What happens after I book a session?",
    answer:
      "You complete a short intake, then checkout. Live sessions are scheduled on Zoom and include a recording in your dashboard. Offline sessions and reports are delivered by email or dashboard — reports within 24 hours Monday–Friday.",
  },
  {
    question: "Are sessions medical or income advice?",
    answer:
      "No. Prime Mentor work is spiritual mentoring, written reports, and energetic practice. It is not medical, psychological, or financial advice, and results vary.",
  },
] as const;
const FAQS = HOME_FAQS;

export default function HomeFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">FAQ</p>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-white">
          Common questions before the first purchase
        </h2>
      </div>
      <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
        {FAQS.map((item, index) => {
          const isOpen = open === index;
          return (
            <div key={item.question}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : index)}
                className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-sm font-semibold text-white sm:text-base">{item.question}</span>
                <span className="text-white/50" aria-hidden="true">{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen ? (
                <p className="px-5 pb-5 text-sm leading-7 text-white/68">{item.answer}</p>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="text-sm text-white/55">
        Still choosing? Compare a{" "}
        <Link to={QA_LANDING_PATH} className="text-cyan-100 underline-offset-4 hover:underline">Q&A</Link>
        {" "}and{" "}
        <Link to={MENTORING_LANDING_PATH} className="text-cyan-100 underline-offset-4 hover:underline">Mentoring</Link>,
        or open the{" "}
        <Link to="/start-here" className="text-cyan-100 underline-offset-4 hover:underline">Start here</Link> guide.
      </p>
    </div>
  );
}
