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
      heroCtaAdjacentContent={(
        <GuestPayFirstButton
          endpoint="/guest/bookings"
          itemLabel="Star Initiation Session"
          extraBody={{ bookingTypeId: "star-initiation-session", deferIntake: true }}
        />
      )}
    />
  );
}
