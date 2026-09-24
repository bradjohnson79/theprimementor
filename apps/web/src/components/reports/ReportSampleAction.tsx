import type { ReportProductKey } from "@wisdom/utils";
import { getReportSample } from "../../data/reportLanding";
import {
  trackReportSampleView,
  type ReportLandingPageSource,
} from "../../lib/reportLandingAnalytics";

const SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-200/25 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200";

export default function ReportSampleAction({
  reportKey,
  pageSource,
  onOpen,
}: {
  reportKey: ReportProductKey;
  pageSource: ReportLandingPageSource;
  onOpen: (key: ReportProductKey) => void;
}) {
  const sample = getReportSample(reportKey);
  if (sample.available) {
    return (
      <button
        type="button"
        onClick={() => {
          trackReportSampleView(reportKey, pageSource);
          onOpen(reportKey);
        }}
        className={SECONDARY}
      >
        View Sample
      </button>
    );
  }

  return (
    <p className="text-sm leading-6 text-white/58">
      <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-amber-200/70">
        Sample in preparation
      </span>
      {reportKey === "compatibility"
        ? "A Partner Compatibility sample is not published yet. You can still order the report."
        : "A sample is not published yet. You can still order the report."}
    </p>
  );
}
