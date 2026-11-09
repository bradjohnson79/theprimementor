import SessionLandingPage from "../components/public/SessionLandingPage";
import GuestPayFirstButton from "../components/guest/GuestPayFirstButton";
import { starInitiationSessionLandingContent } from "../data/starInitiationSessionLanding";
import { usePageMeta } from "../hooks/usePageMeta";
import { STAR_INITIATION_LANDING_PATH } from "../lib/sessionLandingPaths";
import { pageCanonical } from "../lib/siteMeta";

export default function StarInitiationSessionPage() {
  usePageMeta({
    title: "Star Initiation Session | The Prime Mentor",
    description:
      "A private 20–30 minute Star Initiation with Adronis. Cosmic Soul Retrieval on Zoom or by phone. $99 CAD.",
    canonical: pageCanonical(STAR_INITIATION_LANDING_PATH),
  });

  return (
    <SessionLandingPage
      content={starInitiationSessionLandingContent}
      renderPurchaseCta={() => (
        <GuestPayFirstButton
          visibleWhenSignedIn
          label="Book Your Star Initiation — $99 CAD"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:from-cyan-200 hover:via-sky-200 hover:to-violet-200"
          endpoint="/guest/bookings"
          itemLabel="Star Initiation Session"
          extraBody={{ bookingTypeId: "star-initiation-session", deferIntake: true }}
        />
      )}
    />
  );
}
