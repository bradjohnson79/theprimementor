import SessionLandingPage from "../components/public/SessionLandingPage";
import { regenerationSessionLandingContent } from "../data/regenerationSessionLanding";
import { usePageMeta } from "../hooks/usePageMeta";
import { REGENERATION_LANDING_PATH } from "../lib/sessionLandingPaths";
import GuestPayFirstButton from "../components/guest/GuestPayFirstButton";
import { sessionServiceLd } from "../lib/structuredData";

export default function RegenerationSessionPage() {
  usePageMeta({
    title: "Manifestation Monthly Package | The Prime Mentor",
    description:
      "A $99 CAD/month manifestation package with two consultations, a personal ideogram circuit created by Brad Johnson, and manifestation safeguarding.",
    canonical: `https://theprimementor.com${REGENERATION_LANDING_PATH}`,
    // BRAD-ANSWERS.md Round 3 #3: this route previously had no og:image.
    // Use the same product artwork already shown on this page.
    ogImage: "https://theprimementor.com/images/manifestation-monthly-package.png",
    jsonLd: [sessionServiceLd({
      name: "Manifestation Monthly Package",
      path: REGENERATION_LANDING_PATH,
      productKeys: ["regeneration-session"],
      description: "A monthly manifestation package with two consultations, a personal ideogram circuit created by Brad Johnson, and manifestation safeguarding.",
    })],
  });
  return (
    <>
      <SessionLandingPage
        content={regenerationSessionLandingContent}
        heroCtaAdjacentContent={(
          <GuestPayFirstButton
            endpoint="/guest/regeneration-subscription/checkout"
            itemLabel="Manifestation Monthly Package — $99 CAD/month"
            manifestationAddOn
          />
        )}
      />
    </>
  );
}
