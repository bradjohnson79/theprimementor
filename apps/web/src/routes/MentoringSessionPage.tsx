import SessionLandingPage from "../components/public/SessionLandingPage";
import { mentoringSessionLandingContent } from "../data/mentoringSessionLanding";
import { usePageMeta } from "../hooks/usePageMeta";
import { MENTORING_LANDING_PATH } from "../lib/sessionLandingPaths";
import { pageCanonical } from "../lib/siteMeta";
import GuestPayFirstButton from "../components/guest/GuestPayFirstButton";
import { formatGuidedSessionDisplayPrice, getSessionOfferingsByType } from "../lib/sessionCatalog";
import { sessionServiceLd } from "../lib/structuredData";

const MENTORING_GUEST_CHOICES = getSessionOfferingsByType("mentoring").map((offering) => ({
  label: `${offering.minutes} minutes — ${formatGuidedSessionDisplayPrice(offering)}`,
  extraBody: { bookingTypeId: offering.bookingTypeId, deferIntake: true },
}));

export default function MentoringSessionPage() {
  usePageMeta({
    title: "Mentoring Session | The Prime Mentor",
    description:
      "A 45 or 90-minute mentoring session with Brad Johnson to untangle the pattern that keeps repeating, and leave with a plan to change it. $199 or $299 CAD.",
    canonical: pageCanonical(MENTORING_LANDING_PATH),
    ogImage: pageCanonical("/images/mentoring-session.webp"),
    jsonLd: [sessionServiceLd({
      name: "Mentoring Session",
      path: MENTORING_LANDING_PATH,
      sessionType: "mentoring",
      description: "A 45 or 90-minute private mentoring session with Brad Johnson to untangle the pattern that keeps repeating and leave with a plan to change it.",
    })],
  });
  return (
    <SessionLandingPage
      content={mentoringSessionLandingContent}
      renderPurchaseCta={MENTORING_GUEST_CHOICES.length > 0 ? () => (
        <GuestPayFirstButton
          visibleWhenSignedIn
          label="Book Your Mentoring Session"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:from-violet-400 hover:via-fuchsia-400 hover:to-indigo-400"
          endpoint="/guest/bookings"
          choices={MENTORING_GUEST_CHOICES}
          choiceLabel="Session length"
          itemLabel="Mentoring Session"
        />
      ) : undefined}
    />
  );
}
