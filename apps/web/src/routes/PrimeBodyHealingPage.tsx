import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";
import { trackCtaClick } from "../lib/analytics";
import {
  PRIME_BODY_HEALING_BOOKING_PATH,
  PRIME_BODY_HEALING_LANDING_PATH,
} from "../lib/sessionLandingPaths";

const LEVEL_1_IMAGE = "/images/prime-body-healing-level-1.png";
const LEVEL_2_IMAGE = "/images/prime-body-healing-level-2.png";
const CANONICAL = `https://theprimementor.com${PRIME_BODY_HEALING_LANDING_PATH}`;

const FAQ_ITEMS = [
  {
    question: "What is Prime Body Healing?",
    answer:
      "Prime Body Healing is an energetic and intuitive wellness service offered by Brad Johnson. It works with physical-body energetic imbalances, subtle-body states, emotional accumulation, vital-energy states, and causal patterns to support rejuvenation and greater internal alignment.",
  },
  {
    question: "What kinds of areas can I submit for Level 1?",
    answer:
      "You may submit up to five areas. These can include physical areas, emotional concerns, energetic imbalances, recurring patterns, or anything you intuitively feel needs attention, clearing, balancing, or rejuvenation. A compromised area does not need to be a diagnosed condition.",
  },
  {
    question: "Do I need to have a medical condition?",
    answer:
      "No. Prime Body Healing is not medical diagnosis or treatment. People often come with intuitively felt heaviness, stagnation, or a desire for deeper energetic alignment.",
  },
  {
    question: "Can Level 1 be done without attending live?",
    answer:
      "Yes. Level 1 can be received as a personalized pre-recorded MP3 instead of a live 15-minute session.",
  },
  {
    question: "What is included in the Level 2 scan?",
    answer:
      "Level 2 includes a deeper intuitive energetic scan across physical, subtle, emotional, vital, and causal levels, with relevant natal-pattern consideration when birth details are provided. Healing work is then performed on stagnant or compromised areas identified through the scan. You receive a personalized MP3 and a PDF scan report.",
  },
  {
    question: "Why does Level 2 ask for my birth information?",
    answer:
      "Birth date, optional birth time, and birth location allow Brad to consider relevant natal-chart patterns when examining persistent themes or stagnant areas of life.",
  },
  {
    question: "Do I need to know my exact birth time?",
    answer:
      "No. An exact birth time improves natal analysis, but you may continue if the time is unknown.",
  },
  {
    question: "How will my MP3 be delivered?",
    answer:
      "After purchase, Brad emails you with next steps. Pre-recorded Level 1 and Level 2 MP3s are delivered to the email on your order.",
  },
  {
    question: "How will I receive my Level 2 PDF report?",
    answer:
      "The Level 2 scan report is delivered to the email on your order after Brad completes the scan and healing work.",
  },
  {
    question: "How long does delivery take?",
    answer:
      "After purchase, Brad emails a booking window for Level 1 Live, or a delivery turnaround based on available dates for Level 1 Pre-Recorded and Level 2. Timing depends on current availability.",
  },
  {
    question: "Is Prime Body Healing medical treatment?",
    answer:
      "No. Prime Body Healing is an energetic and intuitive wellness service and is not intended to diagnose, treat, cure, or prevent medical conditions. It is not a substitute for licensed healthcare.",
  },
];

const COMPARISON_ROWS = [
  ["Focus", "Targeted", "Comprehensive"],
  ["Selected areas", "Up to 5", "Full energetic scan"],
  ["Physical energetic work", "Yes", "Yes"],
  ["Subtle energetic work", "Yes", "Yes"],
  ["Emotional analysis", "Focused", "Deep scan"],
  ["Vital-level scan", "—", "Yes"],
  ["Causal-level scan", "Focused", "Yes"],
  ["Natal pattern analysis", "—", "Yes"],
  ["Live session option", "Yes", "—"],
  ["Personalized MP3", "Optional format", "Yes"],
  ["PDF Scan Report", "—", "Yes"],
  ["Price", "$79 CAD", "$179 CAD"],
] as const;

function bookPath(level: 1 | 2) {
  return `${PRIME_BODY_HEALING_BOOKING_PATH}?level=${level}`;
}

function trackPbh(label: string, href: string) {
  trackCtaClick(label, "prime_body_healing", { href, title: "Prime Body Healing" });
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-medium text-white sm:text-base">{question}</span>
        <span className="text-amber-200/80" aria-hidden="true">{open ? "–" : "+"}</span>
      </button>
      {open ? <p className="pb-4 text-sm leading-7 text-white/65">{answer}</p> : null}
    </div>
  );
}

export default function PrimeBodyHealingPage() {
  const jsonLd = useMemo(() => [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Prime Body Healing",
      description:
        "Explore Prime Body Healing with Brad Johnson — personalized energetic rejuvenation through focused Level 1 healing or the comprehensive Level 2 energetic scan, healing and report.",
      url: CANONICAL,
      areaServed: "CA",
      offers: [
        { "@type": "Offer", name: "Prime Body Healing Level 1", price: "79.00", priceCurrency: "CAD" },
        { "@type": "Offer", name: "Prime Body Healing Level 2", price: "179.00", priceCurrency: "CAD" },
      ],
    },
  ], []);

  usePageMeta({
    title: "Prime Body Healing | The Prime Mentor",
    description:
      "Explore Prime Body Healing with Brad Johnson — personalized energetic rejuvenation through focused Level 1 healing or the comprehensive Level 2 energetic scan, healing and report.",
    canonical: CANONICAL,
    ogImage: `https://theprimementor.com${LEVEL_2_IMAGE}`,
    jsonLd,
  });

  return (
    <div className="relative isolate overflow-hidden text-white">
      <section className="relative px-6 pb-16 pt-16 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_36%),radial-gradient(circle_at_top_right,rgba(167,139,250,0.16),transparent_34%),radial-gradient(circle_at_bottom,rgba(34,211,238,0.08),transparent_40%)]" />
        <div className="relative mx-auto max-w-6xl">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-amber-200/72">Prime Body Healing</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
            Deep Energetic Rejuvenation for Body, Mind & Being
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-white/68 sm:text-lg">
            Prime Body Healing offers deeper levels of energetic, intuitive and restorative rejuvenation across the physical and subtle body. Release accumulated emotional heaviness, restore greater energetic harmony, and move into a more uplifted state of alignment.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#level-1" onClick={() => trackPbh("explore_level_1", "#level-1")} className="inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200">
              Explore Level 1
            </a>
            <a href="#level-2" onClick={() => trackPbh("explore_level_2", "#level-2")} className="inline-flex rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400">
              Explore Level 2
            </a>
            <a href="#which-level" onClick={() => trackPbh("which_level", "#which-level")} className="inline-flex rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/5">
              Which Level Is Right for Me?
            </a>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <figure className="overflow-hidden rounded-[1.6rem] border border-amber-200/20 bg-white/[0.03] p-2">
              <img src={LEVEL_1_IMAGE} alt="Prime Body Healing Level 1 artwork" className="h-full w-full object-contain" />
            </figure>
            <figure className="overflow-hidden rounded-[1.6rem] border border-violet-200/20 bg-white/[0.03] p-2">
              <img src={LEVEL_2_IMAGE} alt="Prime Body Healing Level 2 artwork" className="h-full w-full object-contain" />
            </figure>
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-16">
        <div className="mx-auto max-w-4xl space-y-5">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">Introduction</p>
          <h2 className="text-3xl font-semibold tracking-[-0.03em]">Work beyond a single energetic layer</h2>
          <p className="text-base leading-8 text-white/68">
            Prime Body Healing works beyond a single energetic layer. The work may involve attention to the Physical Level, Subtle Level, Emotional Level, Vital Level, and Causal Level.
          </p>
          <p className="text-base leading-8 text-white/68">
            Accumulated energetic and emotional patterns may leave someone feeling stagnant, depleted, disconnected, or out of alignment. This work is intended to help facilitate energetic rejuvenation, emotional release, greater internal balance, deeper intuitive alignment, renewed vitality, an uplifted internal state, and stronger alignment with personal intentions.
          </p>
        </div>
      </section>

      <section id="level-1" className="scroll-mt-28 border-t border-white/8 px-6 py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <figure className="overflow-hidden rounded-[1.6rem] border border-amber-200/20 bg-white/[0.03] p-2">
            <img src={LEVEL_1_IMAGE} alt="Prime Body Healing Level 1 artwork" className="h-full w-full object-contain" />
          </figure>
          <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-amber-200/72">Level 1</p>
            <h2 className="mt-2 text-3xl font-semibold">Focused Energetic Rejuvenation</h2>
            <p className="mt-2 text-lg font-medium text-amber-100">$79 CAD</p>
            <p className="mt-4 text-sm leading-7 text-white/68">
              Level 1 is the more focused service. Select up to five compromised areas you would like Brad to work with — physical body, subtle body, emotional state, causal level, or personal energetic alignment.
            </p>
            <p className="mt-3 text-sm leading-7 text-white/60">
              Choose a live 15-minute session or a personalized pre-recorded MP3. After purchase, Brad emails a booking window for live sessions, or a delivery turnaround based on available dates for pre-recorded work.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-white/75">
              <li>✓ Work on up to five selected areas</li>
              <li>✓ Physical, subtle and causal energetic attention</li>
              <li>✓ Personalized Prime Body Healing</li>
              <li>✓ Choice of live or pre-recorded delivery</li>
              <li>✓ Focus on rejuvenation and greater energetic alignment</li>
            </ul>
            <Link
              to={bookPath(1)}
              onClick={() => trackPbh("book_level_1", bookPath(1))}
              className="mt-6 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
            >
              Book Level 1 — $79 CAD
            </Link>
          </div>
        </div>
      </section>

      <section id="level-2" className="scroll-mt-28 border-t border-white/8 px-6 py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-[1.6rem] border border-violet-200/20 bg-white/[0.04] p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-violet-200/72">Level 2</p>
              <span className="rounded-full border border-amber-200/30 bg-amber-300/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-amber-100">
                Most Comprehensive
              </span>
            </div>
            <h2 className="mt-2 text-3xl font-semibold">Comprehensive Energetic Scan, Healing & Life-Pattern Rejuvenation</h2>
            <p className="mt-2 text-lg font-medium text-violet-100">$179 CAD</p>
            <p className="mt-4 text-sm leading-7 text-white/68">
              Brad performs a deeper intuitive energetic scan across Physical, Subtle, Emotional, Vital, and Causal levels, with relevant natal-pattern consideration. Healing work is then performed on stagnant or compromised areas identified through the scan.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-white/75">
              <li>✓ Personalized Prime Body Healing from the scan</li>
              <li>✓ Detailed MP3 covering areas worked, observations, and guidance</li>
              <li>✓ PDF Prime Body Healing Scan Report</li>
              <li>✓ Physical, subtle, emotional, vital, and causal layers</li>
              <li>✓ Natal pattern analysis when birth details are provided</li>
            </ul>
            <Link
              to={bookPath(2)}
              onClick={() => trackPbh("order_level_2", bookPath(2))}
              className="mt-6 inline-flex rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
            >
              Order Level 2 — $179 CAD
            </Link>
          </div>
          <figure className="overflow-hidden rounded-[1.6rem] border border-violet-200/20 bg-white/[0.03] p-2">
            <img src={LEVEL_2_IMAGE} alt="Prime Body Healing Level 2 artwork" className="h-full w-full object-contain" />
          </figure>
        </div>
      </section>

      <section id="comparison" className="border-t border-white/8 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-semibold tracking-[-0.03em]">Compare the levels</h2>
          <div className="mt-6 hidden overflow-hidden rounded-2xl border border-white/10 md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-white/70">
                <tr>
                  <th className="px-4 py-3 font-medium">Feature</th>
                  <th className="px-4 py-3 font-medium">Level 1</th>
                  <th className="px-4 py-3 font-medium">Level 2</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map(([label, level1, level2]) => (
                  <tr key={label} className="border-t border-white/8">
                    <td className="px-4 py-3 text-white/80">{label}</td>
                    <td className="px-4 py-3 text-white/65">{level1}</td>
                    <td className="px-4 py-3 text-white/65">{level2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 grid gap-4 md:hidden">
            {COMPARISON_ROWS.map(([label, level1, level2]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="mt-2 text-sm text-amber-100/80">Level 1: {level1}</p>
                <p className="mt-1 text-sm text-violet-100/80">Level 2: {level2}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="which-level" className="scroll-mt-28 border-t border-white/8 px-6 py-16">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          <div className="rounded-[1.6rem] border border-amber-200/15 bg-amber-300/5 p-6">
            <h2 className="text-2xl font-semibold">Choose Level 1 if...</h2>
            <ul className="mt-4 space-y-2 text-sm leading-7 text-white/70">
              <li>you have specific areas you want Brad to work with</li>
              <li>you want a focused energetic session</li>
              <li>you prefer a short live experience</li>
              <li>you want an accessible introduction to Prime Body Healing</li>
            </ul>
          </div>
          <div className="rounded-[1.6rem] border border-violet-200/15 bg-violet-400/5 p-6">
            <h2 className="text-2xl font-semibold">Choose Level 2 if...</h2>
            <ul className="mt-4 space-y-2 text-sm leading-7 text-white/70">
              <li>you want Brad to look at the larger picture</li>
              <li>you feel several areas of life or energy may be interconnected</li>
              <li>you want deeper physical, subtle, vital, and causal scanning</li>
              <li>you want natal patterns considered, plus an MP3 and PDF report</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-16">
        <div className="mx-auto max-w-4xl space-y-4">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">Manifestation</p>
          <h2 className="text-3xl font-semibold">Clear. Rejuvenate. Realign.</h2>
          <p className="text-base leading-8 text-white/68">
            Unresolved emotional or energetic heaviness can contribute to a sense of stagnation. Prime Body Healing works toward replacing heavier internal states with more uplifting and empowering states of being, so actions, intentions, and desired manifestations can emerge from a clearer foundation.
          </p>
          <p className="text-sm leading-7 text-white/50">
            This is not a promise that any desired manifestation will occur.
          </p>
        </div>
      </section>

      <section id="faq" className="border-t border-white/8 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-semibold">Frequently asked questions</h2>
          <div className="mt-6">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.question} {...item} />
            ))}
          </div>
          <p className="mt-8 text-xs leading-6 text-white/45">
            Prime Body Healing is an energetic and intuitive wellness service and is not intended to diagnose, treat, cure or prevent medical conditions. It is not a substitute for licensed healthcare.
          </p>
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-16">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_42%),linear-gradient(180deg,rgba(10,8,24,0.96),rgba(5,4,15,0.96))] p-8">
          <h2 className="text-3xl font-semibold">Begin Your Prime Body Healing Experience</h2>
          <p className="mt-3 max-w-2xl text-white/65">Choose the level of support that feels most appropriate for you.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-amber-200/20 bg-white/[0.03] p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-amber-200/70">Level 1</p>
              <p className="mt-1 text-xl font-semibold">Focused rejuvenation</p>
              <p className="mt-1 text-white/70">$79 CAD</p>
              <Link
                to={bookPath(1)}
                onClick={() => trackPbh("final_book_level_1", bookPath(1))}
                className="mt-4 inline-flex rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
              >
                Book Level 1
              </Link>
            </div>
            <div className="rounded-2xl border border-violet-200/20 bg-white/[0.03] p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-violet-200/70">Level 2</p>
              <p className="mt-1 text-xl font-semibold">Comprehensive scan + healing</p>
              <p className="mt-1 text-white/70">$179 CAD</p>
              <Link
                to={bookPath(2)}
                onClick={() => trackPbh("final_order_level_2", bookPath(2))}
                className="mt-4 inline-flex rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400"
              >
                Order Level 2
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
