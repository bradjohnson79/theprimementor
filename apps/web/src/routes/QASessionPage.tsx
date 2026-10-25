import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SessionLandingPage from "../components/public/SessionLandingPage";
import { qaSessionLandingContent } from "../data/qaSessionLanding";
import { usePageMeta } from "../hooks/usePageMeta";
import { QA_LANDING_PATH } from "../lib/sessionLandingPaths";
import { pageCanonical } from "../lib/siteMeta";
import GuestPayFirstButton from "../components/guest/GuestPayFirstButton";
import {
  buildGuidedSessionBookingPath,
  formatGuidedSessionDisplayPrice,
  getSessionOfferingsByType,
  type GuidedSessionDurationOption,
} from "../lib/sessionCatalog";
import { sessionServiceLd } from "../lib/structuredData";

const QA_DURATION_SUMMARIES: Record<string, string> = {
  "qa-session-30": "One focused question or quick clarity",
  "qa-session-45": "Several connected questions or a deeper conversation",
  "qa-session-60": "A larger situation, transition, or extended exploration",
};

function getFallbackOffering(offerings: GuidedSessionDurationOption[]) {
  return offerings[0] ?? null;
}

function getOfferingByQuery(offerings: GuidedSessionDurationOption[], searchParams: URLSearchParams) {
  const bookingTypeId = searchParams.get("bookingTypeId")?.trim();
  const productKey = (searchParams.get("productKey") ?? searchParams.get("product"))?.trim();
  const rawMinutes = (searchParams.get("minutes") ?? searchParams.get("duration"))?.trim();
  const minutes = rawMinutes && /^\d+$/.test(rawMinutes) ? Number(rawMinutes) : null;

  for (const offering of offerings) {
    if (
      (bookingTypeId && offering.bookingTypeId === bookingTypeId)
      || (productKey && offering.productKey === productKey)
      || (minutes !== null && offering.minutes === minutes)
    ) {
      return offering;
    }
  }

  return getFallbackOffering(offerings);
}

function buildQaBookingPath(offering: GuidedSessionDurationOption | null) {
  if (!offering) {
    return qaSessionLandingContent.hero.cta.href;
  }

  return buildGuidedSessionBookingPath({
    intakeType: "qa",
    minutes: offering.minutes,
    bookingTypeId: offering.bookingTypeId,
    productKey: offering.productKey,
  });
}

function QaDurationSelector({
  offerings,
  selectedOffering,
  onSelect,
}: {
  offerings: GuidedSessionDurationOption[];
  selectedOffering: GuidedSessionDurationOption | null;
  onSelect: (offering: GuidedSessionDurationOption) => void;
}) {
  if (offerings.length === 0) {
    return null;
  }

  return (
    <div aria-label="Choose Q&A session duration" className="max-w-3xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/72">
        Choose Your Session Length
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {offerings.map((offering) => {
          const isSelected = selectedOffering?.bookingTypeId === offering.bookingTypeId;
          const summary = QA_DURATION_SUMMARIES[offering.productKey]
            ?? QA_DURATION_SUMMARIES[offering.bookingTypeId]
            ?? "Flexible open-format Q&A support";
          return (
            <button
              key={offering.productKey}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(offering)}
              className={[
                "rounded-2xl border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/55",
                isSelected
                  ? "border-amber-300/70 bg-amber-300/12 shadow-[0_0_28px_rgba(251,191,36,0.16)]"
                  : "border-white/10 bg-white/[0.045] hover:border-amber-200/35 hover:bg-white/[0.07]",
              ].join(" ")}
            >
              <span className="block text-base font-semibold tracking-[-0.03em] text-white">
                {offering.minutes} Minutes
              </span>
              <span className="mt-1 block text-sm font-medium text-amber-100">
                {formatGuidedSessionDisplayPrice(offering)}
              </span>
              <span className="mt-3 block text-xs leading-5 text-white/62">
                {summary}
              </span>
            </button>
          );
        })}
      </div>
      {selectedOffering ? (
        <div className="mt-4">
          <GuestPayFirstButton
            endpoint="/guest/bookings"
            extraBody={{ bookingTypeId: selectedOffering.bookingTypeId, deferIntake: true }}
            itemLabel={`Q&A Session — ${selectedOffering.minutes} minutes · ${formatGuidedSessionDisplayPrice(selectedOffering)}`}
          />
        </div>
      ) : null}
    </div>
  );
}

export default function QASessionPage() {
  const [searchParams] = useSearchParams();
  const qaOfferings = useMemo(() => getSessionOfferingsByType("qa"), []);
  const [selectedOffering, setSelectedOffering] = useState<GuidedSessionDurationOption | null>(() => (
    getOfferingByQuery(qaOfferings, searchParams)
  ));

  useEffect(() => {
    setSelectedOffering(getOfferingByQuery(qaOfferings, searchParams));
  }, [qaOfferings, searchParams]);

  const bookingPath = buildQaBookingPath(selectedOffering);

  usePageMeta({
    title: "Q&A Session | The Prime Mentor",
    description:
      "Bring your biggest question. Leave with a clear answer. Live Q&A on Zoom with Brad Johnson or Adronis, from $139 CAD, recording included.",
    canonical: pageCanonical(QA_LANDING_PATH),
    ogImage: pageCanonical("/images/Q&A Session.png"),
    jsonLd: [sessionServiceLd({
      name: "Q&A Session",
      path: QA_LANDING_PATH,
      sessionType: "qa_session",
      description: "A live Q&A session on Zoom or by phone with Brad Johnson or Adronis. Bring your biggest question and leave with a clear answer. Recording included.",
    })],
  });

  return (
    <SessionLandingPage
      content={qaSessionLandingContent}
      ctaHrefOverride={bookingPath}
      heroCtaAdjacentContent={(
        <QaDurationSelector
          offerings={qaOfferings}
          selectedOffering={selectedOffering}
          onSelect={setSelectedOffering}
        />
      )}
    />
  );
}
