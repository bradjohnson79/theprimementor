import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  DIVIN8_REPORT_PRICE_CENTS_BY_PRODUCT,
  REPORT_PRODUCTS,
  divin8ReportProductListPrice,
  type ReportProductKey,
} from "@wisdom/utils";
import ReportCover from "../components/reports/ReportCover";
import SampleReportDialog from "../components/reports/SampleReportDialog";
import ReportsFaq from "../components/reports/ReportsFaq";
import { GoldDivider, SystemsConstellation } from "../components/reports/CelestialMarks";
import {
  PATHWAY_A_KEYS,
  PATHWAY_B_ANNUAL_KEY,
  PATHWAY_B_COMPATIBILITY_KEY,
  PATHWAY_B_QUESTION_KEY,
  REPORT_BEST_FOR,
  REPORT_COMPARISON,
  REPORT_COVERS,
  REPORT_LANDING_CANONICAL,
  REPORT_LANDING_DESCRIPTION,
  REPORT_LANDING_FAQS,
  REPORT_LANDING_OG_IMAGE,
  REPORT_LANDING_TITLE,
  getReportSample,
  getReportSystems,
  hasAnyReportSample,
} from "../data/reportLanding";
import { HOME_TESTIMONIALS } from "../data/homeTestimonials";
import { usePageMeta } from "../hooks/usePageMeta";
import "../styles/reportsLanding.css";

const CTA_PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-5 py-3 text-center text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(228,195,106,0.18)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200";
const CTA_SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-200/25 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200";

const TRUST_ITEMS = [
  {
    title: "Personalized Natal Calculations",
    body: "Each report begins with your unique birth information.",
  },
  {
    title: "Multiple Systems Combined",
    body: "Included calculations vary by report and are read together.",
  },
  {
    title: "Detailed Written Interpretation",
    body: "Findings are synthesized into one readable personal report.",
  },
  {
    title: "Created From Your Birth Information",
    body: "Birth date and location are required; birth time is optional.",
  },
] as const;

const METHOD_STEPS = [
  {
    title: "Your Information",
    body: "Birth date, birth location, optional birth time, and any report-specific questions or partner information.",
  },
  {
    title: "Independent Calculations",
    body: "The systems included in your chosen report calculate different aspects of the personal blueprint.",
  },
  {
    title: "Cross-Referenced Themes",
    body: "Repeating patterns and correspondences are identified across the included systems.",
  },
  {
    title: "Integrated Interpretation",
    body: "The findings are organized into one personalized and readable report.",
  },
] as const;

const ACCURACY_POINTS = [
  "Calculated from personal birth information",
  "Multiple interpretive systems, varying by report",
  "Recurring themes cross-examined across included systems",
  "Report-specific analysis for questions, relationships, or the year ahead",
  "Written as an integrated personal interpretation",
  "Designed to provide clarity rather than a generic sun-sign statement",
] as const;

function reportJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: (Object.keys(REPORT_PRODUCTS) as ReportProductKey[]).map((key, index) => {
      const product = REPORT_PRODUCTS[key];
      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Product",
          name: product.displayName,
          description: product.shortDescription,
          image: REPORT_LANDING_OG_IMAGE,
          offers: {
            "@type": "Offer",
            priceCurrency: "CAD",
            price: (DIVIN8_REPORT_PRICE_CENTS_BY_PRODUCT[key] / 100).toFixed(2),
            availability: "https://schema.org/InStock",
            url: `https://theprimementor.com${product.orderPath}`,
          },
        },
      };
    }),
  };
}

function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: REPORT_LANDING_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

function SectionFrame({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-32 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        {eyebrow ? (
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-amber-200/75">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="reports-display mt-3 text-3xl text-white md:text-5xl">{title}</h2>
        <GoldDivider className="mt-6 max-w-xs" />
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function SampleAction({
  reportKey,
  onOpen,
}: {
  reportKey: ReportProductKey;
  onOpen: (key: ReportProductKey) => void;
}) {
  const sample = getReportSample(reportKey);
  if (sample.available) {
    return (
      <button type="button" onClick={() => onOpen(reportKey)} className={CTA_SECONDARY}>
        {sample.samplePdfLabel}
      </button>
    );
  }
  return (
    <span className="inline-flex min-h-11 items-center text-xs uppercase tracking-[0.18em] text-white/40">
      Sample Coming Soon
    </span>
  );
}

function ReportActions({
  reportKey,
  onOpenSample,
  featured = false,
}: {
  reportKey: ReportProductKey;
  onOpenSample: (key: ReportProductKey) => void;
  featured?: boolean;
}) {
  const product = REPORT_PRODUCTS[reportKey];
  return (
    <div className={`mt-6 flex flex-col gap-3 ${featured ? "sm:flex-row" : ""}`}>
      <Link to={product.orderPath} className={CTA_PRIMARY}>
        {product.ctaLabel}
      </Link>
      <SampleAction reportKey={reportKey} onOpen={onOpenSample} />
    </div>
  );
}

function ReportMeta({ reportKey }: { reportKey: ReportProductKey }) {
  const product = REPORT_PRODUCTS[reportKey];
  const priceLabel = divin8ReportProductListPrice(reportKey);
  return (
    <>
      <h3 className="reports-display text-2xl text-white md:text-3xl">{product.displayName}</h3>
      <p className="mt-2 text-sm font-semibold tabular-nums text-amber-100">{priceLabel}</p>
      <p className="mt-3 text-sm leading-7 text-white/72">{product.shortDescription}</p>
      <div className="mt-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/40">
          Best for
        </p>
        <ul className="mt-2 space-y-1 text-sm text-white/68">
          {REPORT_BEST_FOR[reportKey].map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </div>
      <div className="mt-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/40">
          Systems included
        </p>
        <p className="mt-2 text-sm leading-6 text-white/68">
          {getReportSystems(reportKey).join(" · ")}
        </p>
      </div>
    </>
  );
}

export default function ReportsLanding() {
  const prefersReducedMotion = useReducedMotion();
  const [sampleKey, setSampleKey] = useState<ReportProductKey | null>(null);
  const samplesAvailable = hasAnyReportSample();
  const featuredTestimonial = HOME_TESTIMONIALS.find((item) => item.id === "7");
  const openSample = getReportSample(sampleKey ?? "intro");
  const openProduct = sampleKey ? REPORT_PRODUCTS[sampleKey] : null;

  const jsonLd = useMemo(() => [reportJsonLd(), faqJsonLd()], []);

  usePageMeta({
    title: REPORT_LANDING_TITLE,
    description: REPORT_LANDING_DESCRIPTION,
    canonical: REPORT_LANDING_CANONICAL,
    ogImage: REPORT_LANDING_OG_IMAGE,
    jsonLd,
  });

  useEffect(() => {
    const font = document.createElement("link");
    font.rel = "stylesheet";
    font.href =
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&display=swap";
    document.head.appendChild(font);

    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "image";
    preload.href = REPORT_COVERS.annual_12_month.webp;
    preload.type = "image/webp";
    document.head.appendChild(preload);

    return () => {
      font.remove();
      preload.remove();
    };
  }, []);

  const fade = prefersReducedMotion ? { duration: 0 } : { duration: 0.7, ease: "easeOut" as const };

  return (
    <main id="top" className="reports-landing relative min-h-screen overflow-x-hidden text-white">
      <div className="reports-aurora pointer-events-none absolute inset-0" aria-hidden="true" />

      <section className="relative overflow-x-hidden px-6 pb-16 pt-24 md:pt-32">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fade}
          >
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-amber-200/80">
              Personalized Astrology & Numerology
            </p>
            <h1 className="reports-display mt-4 max-w-xl text-4xl leading-tight text-white sm:text-5xl md:text-6xl">
              Discover the Deeper Blueprint of Your Life
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/74 md:text-lg">
              Divin8 Reports bring multiple systems of astrology and numerology together into one
              detailed, personalized interpretation—revealing the patterns, cycles, relationships
              and opportunities contained within your unique natal blueprint.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#choose-reports" className={CTA_PRIMARY}>
                Explore the Reports
              </a>
              {samplesAvailable ? (
                <a href="#choose-reports" className={CTA_SECONDARY}>
                  View Sample Reports
                </a>
              ) : null}
            </div>
          </motion.div>

          <div className="relative mx-auto mt-4 h-[20rem] w-full max-w-[22rem] sm:h-[26rem] sm:max-w-[28rem] lg:mt-0 lg:h-[32rem] lg:max-w-none">
            <div className="absolute left-[4%] top-[18%] w-[42%] -rotate-8 opacity-90 reports-cover-float-delay">
              <ReportCover
                cover={REPORT_COVERS.deep_dive}
                sizes="(max-width: 1024px) 180px, 240px"
                imgClassName="rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-1 ring-amber-200/20"
              />
            </div>
            <div className="absolute right-[2%] top-[14%] w-[42%] rotate-8 opacity-90 reports-cover-float">
              <ReportCover
                cover={REPORT_COVERS.compatibility}
                sizes="(max-width: 1024px) 180px, 240px"
                imgClassName="rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-1 ring-amber-200/20"
              />
            </div>
            <div className="absolute left-1/2 top-[8%] z-10 w-[58%] -translate-x-1/2 reports-cover-float">
              <ReportCover
                cover={REPORT_COVERS.annual_12_month}
                eager
                sizes="(max-width: 1024px) 240px, 320px"
                imgClassName="rounded-2xl shadow-[0_28px_80px_rgba(228,195,106,0.18)] ring-1 ring-amber-200/35"
              />
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Divin8 strengths" className="border-y border-white/10 bg-black/20">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_ITEMS.map((item) => (
            <div key={item.title}>
              <p className="text-sm font-semibold text-amber-100">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-white/65">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <SectionFrame
        id="more-than-horoscope"
        eyebrow="Distinction"
        title="More Than a Generic Horoscope"
      >
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-4 text-base leading-8 text-white/74">
            <p>
              Divin8 does not rely upon a single zodiac sign or a generalized interpretation. Each
              report begins with your personal information and brings multiple systems of astrology
              and numerology together to examine your life from different perspectives.
            </p>
            <p>
              These independent calculations are then interpreted as one integrated blueprint,
              helping recurring patterns, timing cycles, personal strengths, challenges and
              opportunities become easier to recognize.
            </p>
            <p className="text-sm text-white/55">
              Included calculations vary by report. The systems listed for each report are the ones
              actually calculated for that product.
            </p>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <SystemsConstellation className="h-auto w-full" />
          </div>
        </div>
      </SectionFrame>

      <SectionFrame
        id="methodology"
        eyebrow="Methodology"
        title="Multiple Systems. One Coherent Blueprint."
      >
        <p className="max-w-3xl text-base leading-8 text-white/74">
          Divin8 Reports use your personal information and synthesize the systems included in your
          chosen report into one clear interpretation. Not every report includes every system.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {METHOD_STEPS.map((step, index) => (
            <article key={step.title} className="glass-card rounded-3xl p-6">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-amber-200/70">
                Step {index + 1}
              </p>
              <h3 className="reports-display mt-2 text-2xl text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/68">{step.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-8 text-sm leading-7 text-white/60">
          After you choose a report, create a free account, submit your intake information, and
          complete checkout. Your report is then generated and prepared for delivery.
        </p>
      </SectionFrame>

      <SectionFrame id="accuracy" eyebrow="Precision" title="Accuracy Through Detail">
        <p className="max-w-3xl text-base leading-8 text-white/74">
          The depth of a Divin8 Report comes from the amount of personal calculation behind it.
          Rather than reducing a person to one sign or number, Divin8 considers multiple placements,
          cycles and numerical patterns before synthesizing the recurring themes into a unified
          interpretation.
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {ACCURACY_POINTS.map((point) => (
            <li
              key={point}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white/75"
            >
              {point}
            </li>
          ))}
        </ul>
      </SectionFrame>

      {featuredTestimonial ? (
        <SectionFrame
          id="featured-testimonial"
          eyebrow="Client Voice"
          title="What One Client Found in a Deep Dive Report"
        >
          <blockquote className="glass-card mx-auto max-w-3xl rounded-3xl p-8 md:p-10">
            <p className="reports-display text-2xl leading-snug text-white md:text-3xl">
              “{featuredTestimonial.quote}”
            </p>
            <footer className="mt-6 text-sm text-white/65">
              <cite className="not-italic font-medium text-white">{featuredTestimonial.name}</cite>
              {featuredTestimonial.role ? (
                <span className="block text-white/50">{featuredTestimonial.role}</span>
              ) : null}
            </footer>
          </blockquote>
        </SectionFrame>
      ) : null}

      <SectionFrame id="choose-reports" eyebrow="The Catalogue" title="Choose Your Divin8 Report">
        <p className="max-w-3xl text-base leading-8 text-white/74">
          Begin with a foundational look at your blueprint, explore it in greater depth, or choose a
          focused report for your questions, relationships or year ahead. These are suggested
          pathways, not a required sequence.
        </p>

        <h3 className="reports-display mt-12 text-2xl text-amber-100 md:text-3xl">
          Explore Your Personal Blueprint
        </h3>
        <p className="mt-2 text-sm text-white/55">
          Introduction → Expanded Insight → Comprehensive Exploration
        </p>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {PATHWAY_A_KEYS.map((key) => (
            <article key={key} className="glass-card flex h-full flex-col rounded-3xl p-6">
              <ReportCover cover={REPORT_COVERS[key]} imgClassName="rounded-2xl" />
              <div className="mt-5 flex flex-1 flex-col">
                <ReportMeta reportKey={key} />
                <div className="mt-auto">
                  <ReportActions reportKey={key} onOpenSample={setSampleKey} />
                </div>
              </div>
            </article>
          ))}
        </div>

        <h3 className="reports-display mt-16 text-2xl text-amber-100 md:text-3xl">
          Explore a Specific Question or Cycle
        </h3>
        <article className="glass-card mt-6 grid items-center gap-8 rounded-3xl p-6 md:grid-cols-[minmax(0,16rem)_1fr] md:p-8">
          <ReportCover cover={REPORT_COVERS[PATHWAY_B_QUESTION_KEY]} imgClassName="rounded-2xl" />
          <div>
            <ReportMeta reportKey={PATHWAY_B_QUESTION_KEY} />
            <p className="mt-4 text-sm leading-7 text-white/68">
              Ask three personally selected questions. Natal calculations from the included systems
              support a focused written response. The report does not promise a guaranteed outcome.
            </p>
            <ReportActions
              reportKey={PATHWAY_B_QUESTION_KEY}
              onOpenSample={setSampleKey}
              featured
            />
          </div>
        </article>

        <article className="glass-card mt-6 grid items-center gap-8 rounded-3xl p-6 md:grid-cols-[1fr_minmax(0,18rem)] md:p-8">
          <div className="md:order-2">
            <ReportCover
              cover={REPORT_COVERS[PATHWAY_B_COMPATIBILITY_KEY]}
              imgClassName="rounded-2xl"
            />
          </div>
          <div>
            <ReportMeta reportKey={PATHWAY_B_COMPATIBILITY_KEY} />
            <p className="mt-4 text-sm leading-7 text-white/68">
              Two personal blueprints are compared for romantic, business, creative, friendship,
              family, or other relationships. The report looks at individual patterns and the
              dynamic between them.
            </p>
            <ReportActions
              reportKey={PATHWAY_B_COMPATIBILITY_KEY}
              onOpenSample={setSampleKey}
              featured
            />
          </div>
        </article>

        <article className="relative mt-6 overflow-hidden rounded-3xl border border-amber-200/20 bg-[radial-gradient(circle_at_top,_rgba(228,195,106,0.12),_transparent_46%),linear-gradient(180deg,rgba(10,12,24,0.96),rgba(5,7,16,0.96))] p-6 md:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,20rem)_1fr]">
            <ReportCover
              cover={REPORT_COVERS[PATHWAY_B_ANNUAL_KEY]}
              sizes="(max-width: 1024px) 280px, 360px"
              imgClassName="rounded-2xl"
            />
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-amber-200/75">
                Year Ahead
              </p>
              <ReportMeta reportKey={PATHWAY_B_ANNUAL_KEY} />
              <p className="mt-4 text-sm leading-7 text-white/68">
                A personalized look at the coming twelve-month cycle, organized month by month,
                including themes, timing periods, opportunities, and challenges. It does not imply
                guaranteed event prediction.
              </p>
              <ReportActions
                reportKey={PATHWAY_B_ANNUAL_KEY}
                onOpenSample={setSampleKey}
                featured
              />
            </div>
          </div>
        </article>
      </SectionFrame>

      <SectionFrame id="compare-reports" eyebrow="Compare" title="Compare All Reports">
        <div className="hidden overflow-x-auto rounded-3xl border border-white/10 md:block">
          <table className="min-w-full text-left text-sm text-white/72">
            <thead className="bg-white/5 text-[0.65rem] uppercase tracking-[0.16em] text-white/45">
              <tr>
                <th className="px-4 py-3 font-semibold">Report</th>
                <th className="px-4 py-3 font-semibold">Best For</th>
                <th className="px-4 py-3 font-semibold">Depth</th>
                <th className="px-4 py-3 font-semibold">Primary Focus</th>
                <th className="px-4 py-3 font-semibold">Personal Information</th>
                <th className="px-4 py-3 font-semibold">Partner Information</th>
                <th className="px-4 py-3 font-semibold">Questions</th>
                <th className="px-4 py-3 font-semibold">Annual Timing</th>
              </tr>
            </thead>
            <tbody>
              {REPORT_COMPARISON.map((row) => (
                <tr key={row.key} className="border-t border-white/10">
                  <th className="px-4 py-4 font-medium text-white">
                    {REPORT_PRODUCTS[row.key].displayName}
                  </th>
                  <td className="px-4 py-4">{row.bestFor}</td>
                  <td className="px-4 py-4">{row.depth}</td>
                  <td className="px-4 py-4">{row.primaryFocus}</td>
                  <td className="px-4 py-4">{row.personalInformation}</td>
                  <td className="px-4 py-4">{row.partnerInformation}</td>
                  <td className="px-4 py-4">{row.questionsIncluded}</td>
                  <td className="px-4 py-4">{row.annualTiming}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">
          {REPORT_COMPARISON.map((row) => (
            <article
              key={row.key}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <h3 className="text-base font-semibold text-white">
                {REPORT_PRODUCTS[row.key].displayName}
              </h3>
              <dl className="mt-3 space-y-2 text-sm text-white/68">
                <div>
                  <dt className="text-white/40">Best For</dt>
                  <dd>{row.bestFor}</dd>
                </div>
                <div>
                  <dt className="text-white/40">Depth</dt>
                  <dd>{row.depth}</dd>
                </div>
                <div>
                  <dt className="text-white/40">Primary Focus</dt>
                  <dd>{row.primaryFocus}</dd>
                </div>
                <div>
                  <dt className="text-white/40">Personal Information</dt>
                  <dd>{row.personalInformation}</dd>
                </div>
                <div>
                  <dt className="text-white/40">Partner Information</dt>
                  <dd>{row.partnerInformation}</dd>
                </div>
                <div>
                  <dt className="text-white/40">Questions</dt>
                  <dd>{row.questionsIncluded}</dd>
                </div>
                <div>
                  <dt className="text-white/40">Annual Timing</dt>
                  <dd>{row.annualTiming}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </SectionFrame>

      <SectionFrame id="faq" eyebrow="Questions" title="Frequently Asked Questions">
        <ReportsFaq />
      </SectionFrame>

      <section id="begin-report" className="px-6 pb-24">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-amber-200/20 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.16),_transparent_42%),linear-gradient(180deg,rgba(8,10,22,0.96),rgba(4,6,14,0.96))] px-6 py-14 text-center md:px-16">
          <h2 className="reports-display text-3xl text-white md:text-5xl">
            Your Birth Information Contains More Than a Chart
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/72">
            It contains a living pattern of potential, timing, relationship and personal
            development. Choose the Divin8 Report that best reflects what you are ready to explore.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#choose-reports" className={CTA_PRIMARY}>
              Choose Your Divin8 Report
            </a>
            <a href="#compare-reports" className={CTA_SECONDARY}>
              Compare All Reports
            </a>
          </div>
        </div>
      </section>

      <SampleReportDialog
        open={Boolean(sampleKey && openSample.available && openSample.samplePdfUrl && openProduct)}
        onClose={() => setSampleKey(null)}
        title={openProduct?.displayName ?? "Sample Report"}
        pdfUrl={openSample.samplePdfUrl ?? ""}
        orderPath={openProduct?.orderPath ?? "/reports"}
        ctaLabel={openProduct?.ctaLabel ?? "Order this report"}
      />
    </main>
  );
}
