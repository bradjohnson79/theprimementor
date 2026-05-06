import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import {
  CASUAL_REPORT_PRODUCT_KEYS,
  PREMIUM_REPORT_PRODUCT_KEYS,
  REPORT_PRODUCTS,
  type ReportProductKey,
} from "@wisdom/utils";

const NAV_LINKS = [
  ["Introduction", "#introduction"],
  ["How the Reports Work", "#how-reports-work"],
  ["Casual Divin8 Reports", "#casual-reports"],
  ["Premium Divin8 Reports", "#premium-reports"],
  ["Compare Reports", "#compare-reports"],
  ["Begin Your Report", "#begin-report"],
] as const;

const DIVIN8_SYSTEM_LABELS = [
  "Astrology",
  "Numerology",
  "Tarot",
  "I Ching",
  "Kabbalah",
  "Human Systems",
];

const BEST_FOR: Record<ReportProductKey, string[]> = {
  three_questions: ["Personal questions", "Life direction", "Career or financial clarity", "Relationship questions", "Spiritual guidance", "Decision-making support"],
  compatibility: ["Romantic partners", "Business partners", "Creative collaborators", "Friendships", "Family relationships", "Future partnership insight"],
  annual_12_month: ["Annual planning", "Personal growth", "Business planning", "Financial timing", "Relationship cycles", "Spiritual development"],
  intro: ["Foundational self-understanding", "Core identity", "Direction", "Accessible synthesis"],
  deep_dive: ["Deeper personal insight", "Life path", "Karma", "Relationships", "Career"],
  initiate: ["Full-spectrum synthesis", "Advanced spiritual analysis", "Timing", "Life path", "Initiatory insight"],
};

const COMPARISON = [
  ["3 Questions Report", "Specific questions", "Light to moderate", "Focused answers"],
  ["Compatibility Report", "Relationship or partnership insight", "Moderate", "Two-person synthesis"],
  ["12 Month Annual Report", "Planning the year ahead", "Moderate", "Month-by-month timing"],
  ["Introductory Report", "Foundational self-understanding", "Moderate", "Core identity and direction"],
  ["Deep Dive Report", "Deeper personal insight", "High", "Life path, karma, relationships, career"],
  ["Initiate Report", "Full-spectrum metaphysical synthesis", "Highest", "Advanced spiritual and life-path analysis"],
];

const REPORT_WORKFLOW_STEPS: { title: string; helper?: string }[] = [
  { title: "Choose your report" },
  { title: "Create a free account", helper: "Save reports, purchases, and future activity" },
  { title: "Submit your intake information" },
  { title: "Complete checkout" },
  { title: "Your report is generated and prepared" },
  { title: "Receive your report within 48 hours Monday–Friday" },
];

function BackToTop() {
  return <a href="#top" className="mt-8 inline-flex text-sm font-medium text-accent-cyan hover:text-white">Back to Top</a>;
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 border-t border-white/10 py-16">
      <div className="mx-auto max-w-6xl px-6">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent-cyan">{eyebrow}</p> : null}
        <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">{title}</h2>
        <div className="mt-6">{children}</div>
        <BackToTop />
      </div>
    </section>
  );
}

function ReportCard({ reportKey }: { reportKey: ReportProductKey }) {
  const product = REPORT_PRODUCTS[reportKey];
  return (
    <article className="glass-card flex h-full flex-col rounded-3xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">{product.type === "casual" ? "Casual Report" : "Premium Report"}</p>
      <h3 className="mt-3 text-xl font-semibold text-white">{product.displayName}</h3>
      <p className="mt-3 flex-1 text-sm leading-7 text-white/68">{product.shortDescription}</p>
      <div className="mt-5">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/40">Best for</p>
        <ul className="mt-2 space-y-1 text-sm text-white/65">
          {BEST_FOR[reportKey].map((item) => <li key={item}>• {item}</li>)}
        </ul>
      </div>
      <Link to={product.orderPath} className="mt-6 inline-flex justify-center rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-4 py-2.5 text-sm font-semibold text-slate-950">
        {product.ctaLabel}
      </Link>
    </article>
  );
}

export default function ReportsLanding() {
  return (
    <main id="top" className="min-h-screen text-white">
      <section className="relative overflow-hidden px-6 pb-16 pt-24 md:pt-32">
        <div className="absolute inset-x-0 top-20 -z-10 mx-auto h-72 max-w-4xl rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">Divin8 Reports</p>
              <div className="mb-6 mt-4 flex flex-wrap gap-2">
                {DIVIN8_SYSTEM_LABELS.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs tracking-wide text-white/80 backdrop-blur-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <h1 className="max-w-4xl text-5xl font-semibold leading-tight md:text-7xl">Personalized metaphysical reports for clarity, timing, and direction.</h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-white/72">
                Divin8 Reports use natal chart systems, ancient calculation methods, and deep synthesis to help you understand yourself, your relationships, and the energetic patterns surrounding your life.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#casual-reports" className="rounded-xl bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">Explore Reports</a>
                <a href="#how-reports-work" className="rounded-xl border border-white/15 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-white/5">How It Works</a>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-yellow-500/10 blur-3xl" />
              <img
                src="/images/Divin8-Ancient-System-Reports.png"
                alt="Divin8 Ancient System Reports"
                className="relative mx-auto w-full max-w-[520px] rounded-3xl border border-white/10 shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      <nav className="mx-auto max-w-6xl px-6 pb-10">
        <div className="glass-card flex flex-wrap gap-2 rounded-2xl p-3">
          {NAV_LINKS.map(([label, href]) => (
            <a key={href} href={href} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/72 hover:bg-white/5 hover:text-white">{label}</a>
          ))}
        </div>
      </nav>

      <Section id="introduction" eyebrow="Introduction" title="A Clearer Way To Read The Pattern">
        <div className="max-w-3xl space-y-4 text-base leading-8 text-white/72">
          <p>Divin8 examines chart data, timing patterns, symbolic correspondences, and ancient calculation systems together rather than separately.</p>
          <p>Casual reports are focused and accessible for specific questions, compatibility insight, or annual timing. Premium reports are more comprehensive and provide deeper life-path interpretation, karmic insight, spiritual direction, and extensive synthesis.</p>
          <a href="#compare-reports" className="inline-flex rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/5">View Report Options</a>
        </div>
      </Section>

      <Section id="how-reports-work" eyebrow="Process" title="How The Reports Work">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_WORKFLOW_STEPS.map((step, index) => (
            <div key={step.title} className="glass-card flex h-full flex-col rounded-2xl p-4 sm:p-5">
              <p className="text-sm text-accent-cyan">Step {index + 1}</p>
              <p className="mt-2 text-sm leading-6 text-white/75">{step.title}</p>
              {step.helper ? <p className="text-xs opacity-60 mt-2">{step.helper}</p> : null}
            </div>
          ))}
        </div>
      </Section>

      <Section id="casual-reports" eyebrow="Focused Guidance" title="Casual Divin8 Reports">
        <p className="max-w-3xl text-base leading-8 text-white/72">Focused reports for specific questions, relationship clarity, and the year ahead.</p>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {CASUAL_REPORT_PRODUCT_KEYS.map((key) => <ReportCard key={key} reportKey={key} />)}
        </div>
      </Section>

      <Section id="premium-reports" eyebrow="Deeper Synthesis" title="Premium Divin8 Reports">
        <p className="max-w-3xl text-base leading-8 text-white/72">Deeper, more comprehensive reports for full-spectrum metaphysical synthesis.</p>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {PREMIUM_REPORT_PRODUCT_KEYS.map((key) => <ReportCard key={key} reportKey={key} />)}
        </div>
      </Section>

      <Section id="compare-reports" eyebrow="Compare" title="Choose The Right Report">
        <div className="overflow-hidden rounded-3xl border border-white/10">
          <div className="hidden grid-cols-4 bg-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/45 md:grid">
            <span>Report</span><span>Best For</span><span>Depth</span><span>Focus</span>
          </div>
          {COMPARISON.map(([report, bestFor, depth, focus]) => (
            <div key={report} className="grid gap-2 border-t border-white/10 px-4 py-4 text-sm text-white/72 md:grid-cols-4">
              <strong className="text-white">{report}</strong>
              <span>{bestFor}</span>
              <span>{depth}</span>
              <span>{focus}</span>
            </div>
          ))}
        </div>
        <a href="#begin-report" className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">Choose Your Divin8 Report</a>
      </Section>

      <Section id="begin-report" eyebrow="Begin" title="Begin Your Divin8 Report">
        <p className="max-w-3xl text-base leading-8 text-white/72">Choose the report that best matches the clarity you are seeking, from three specific questions to a full initiate-level synthesis.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {(["three_questions", "compatibility", "annual_12_month", "intro"] as ReportProductKey[]).map((key) => (
            <Link key={key} to={REPORT_PRODUCTS[key].orderPath} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5">
              {key === "intro" ? "View Premium Reports" : REPORT_PRODUCTS[key].ctaLabel}
            </Link>
          ))}
        </div>
      </Section>
    </main>
  );
}
