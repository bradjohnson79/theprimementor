import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  DIVIN8_REPORT_PRICE_CENTS_BY_PRODUCT,
  REPORT_PRODUCTS,
  divin8ReportProductListPrice,
} from "@wisdom/utils";
import ReportCover from "../components/reports/ReportCover";
import ReportOrderLink from "../components/reports/ReportOrderLink";
import ReportSampleAction from "../components/reports/ReportSampleAction";
import SampleReportDialog from "../components/reports/SampleReportDialog";
import { GoldDivider } from "../components/reports/CelestialMarks";
import {
  REPORT_COVERS,
  REPORT_DELIVERY_SENTENCE,
  REPORT_HOW_IT_WORKS,
  REPORT_LANDING_OG_IMAGE,
  REPORT_PRODUCT_LANDINGS,
  REPORT_REQUIRED_INFO,
  getReportSample,
  getReportSystems,
} from "../data/reportLanding";
import { usePageMeta } from "../hooks/usePageMeta";
import { withCurrentSearch } from "../lib/reportAttribution";
import { trackReportView, type ReportLandingPageSource } from "../lib/reportLandingAnalytics";
import "../styles/reportsLanding.css";

const CTA_PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-5 py-3 text-center text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(228,195,106,0.18)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200";

export default function ReportProductLanding() {
  const location = useLocation();
  const [sampleOpen, setSampleOpen] = useState(false);
  const landing = REPORT_PRODUCT_LANDINGS.find((item) => item.path === location.pathname);

  if (!landing) {
    return <Navigate to="/reports" replace />;
  }

  return <ReportProductLandingView landing={landing} search={location.search} sampleOpen={sampleOpen} setSampleOpen={setSampleOpen} />;
}

function ReportProductLandingView({
  landing,
  search,
  sampleOpen,
  setSampleOpen,
}: {
  landing: (typeof REPORT_PRODUCT_LANDINGS)[number];
  search: string;
  sampleOpen: boolean;
  setSampleOpen: (open: boolean) => void;
}) {
  const product = REPORT_PRODUCTS[landing.productKey];
  const priceLabel = divin8ReportProductListPrice(landing.productKey);
  const sample = getReportSample(landing.productKey);
  const pageSource = landing.pageSource as ReportLandingPageSource;
  const systems = getReportSystems(landing.productKey);

  const jsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.displayName,
      description: landing.description,
      image: REPORT_LANDING_OG_IMAGE,
      offers: {
        "@type": "Offer",
        priceCurrency: "CAD",
        price: (DIVIN8_REPORT_PRICE_CENTS_BY_PRODUCT[landing.productKey] / 100).toFixed(2),
        availability: "https://schema.org/InStock",
        url: `https://theprimementor.com${landing.path}`,
      },
    }),
    [landing, product.displayName],
  );

  usePageMeta({
    title: landing.title,
    description: landing.description,
    canonical: landing.canonical,
    ogImage: REPORT_LANDING_OG_IMAGE,
    jsonLd: [jsonLd],
  });

  useEffect(() => {
    trackReportView(landing.productKey, pageSource);
  }, [landing.productKey, pageSource]);

  useEffect(() => {
    const font = document.createElement("link");
    font.rel = "stylesheet";
    font.href =
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&display=swap";
    document.head.appendChild(font);
    return () => {
      font.remove();
    };
  }, []);

  return (
    <main className="reports-landing reports-product-landing relative min-h-screen overflow-x-hidden pb-28 text-white md:pb-0">
      <div className="reports-aurora pointer-events-none absolute inset-0" aria-hidden="true" />

      <section className="relative px-6 pb-12 pt-24 md:pt-32">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <ReportCover
            cover={REPORT_COVERS[landing.productKey]}
            eager
            sizes="(max-width: 1024px) 280px, 360px"
            imgClassName="rounded-3xl shadow-[0_28px_80px_rgba(228,195,106,0.18)] ring-1 ring-amber-200/35"
          />
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-amber-200/80">
              Divin8 Written Report
            </p>
            <h1 className="reports-display mt-4 text-4xl leading-tight text-white sm:text-5xl">
              {landing.headline}
            </h1>
            <p className="mt-3 text-lg font-semibold tabular-nums text-amber-100">{priceLabel}</p>
            <p className="mt-5 max-w-xl text-base leading-8 text-white/74">{product.shortDescription}</p>
            <p className="mt-4 text-sm leading-6 text-white/62">
              A written digital report, personalized from the intake information below, priced in CAD.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-start">
              <ReportOrderLink
                reportKey={landing.productKey}
                pageSource={pageSource}
                search={search}
                className={CTA_PRIMARY}
              />
              <ReportSampleAction
                reportKey={landing.productKey}
                pageSource={pageSource}
                onOpen={() => setSampleOpen(true)}
              />
            </div>
            <p className="mt-3 text-xs text-white/55">Create a Free Account or Sign-in to Purchase</p>
          </div>
        </div>
      </section>

      <section className="relative px-6 py-12">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          <article className="glass-card rounded-3xl p-6">
            <h2 className="reports-display text-2xl text-white">What you provide</h2>
            <GoldDivider className="mt-4 max-w-[8rem]" />
            <p className="mt-4 text-sm leading-7 text-white/72">
              {REPORT_REQUIRED_INFO[landing.productKey]}
            </p>
          </article>
          <article className="glass-card rounded-3xl p-6">
            <h2 className="reports-display text-2xl text-white">Systems included</h2>
            <GoldDivider className="mt-4 max-w-[8rem]" />
            <p className="mt-4 text-sm leading-7 text-white/72">{systems.join(" · ")}</p>
          </article>
          <article className="glass-card rounded-3xl p-6">
            <h2 className="reports-display text-2xl text-white">What you receive</h2>
            <GoldDivider className="mt-4 max-w-[8rem]" />
            <p className="mt-4 text-sm leading-7 text-white/72">
              A written digital report prepared for your member dashboard. {REPORT_DELIVERY_SENTENCE}
            </p>
          </article>
        </div>
      </section>

      <section className="relative px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="reports-display text-3xl text-white md:text-4xl">How it works</h2>
          <GoldDivider className="mt-6 max-w-xs" />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {REPORT_HOW_IT_WORKS.map((step, index) => (
              <article key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-amber-200/70">
                  Step {index + 1}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-7 text-white/68">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-6 pb-24">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-amber-200/20 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.16),_transparent_42%),linear-gradient(180deg,rgba(8,10,22,0.96),rgba(4,6,14,0.96))] px-6 py-12 md:px-12">
          <h2 className="reports-display text-3xl text-white md:text-4xl">{product.displayName}</h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-white/72">
            {sample.available
              ? "Open the anonymized sample to see the written format, or continue to order."
              : "A Partner Compatibility sample is not published yet. The report is available to order now."}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-start">
            <ReportOrderLink
              reportKey={landing.productKey}
              pageSource={pageSource}
              search={search}
              className={CTA_PRIMARY}
            />
            <Link
              to={withCurrentSearch("/reports", search)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-200/25 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-white/10"
            >
              See all Divin8 Reports
            </Link>
          </div>
        </div>
      </section>

      <div className="reports-sticky-cta md:hidden">
        <div>
          <p className="text-sm font-semibold text-white">{product.displayName}</p>
          <p className="text-xs font-semibold tabular-nums text-amber-100">{priceLabel}</p>
        </div>
        <ReportOrderLink
          reportKey={landing.productKey}
          pageSource={pageSource}
          search={search}
          className={CTA_PRIMARY}
        />
      </div>

      <SampleReportDialog
        open={sampleOpen && sample.available && Boolean(sample.samplePdfUrl)}
        onClose={() => setSampleOpen(false)}
        title={product.displayName}
        pdfUrl={sample.samplePdfUrl ?? ""}
        orderPath={product.orderPath}
        ctaLabel={product.ctaLabel}
        reportKey={landing.productKey}
        pageSource={pageSource}
      />
    </main>
  );
}
