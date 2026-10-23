import { useState } from "react";
import { useAuth } from "@clerk/react";
import SessionLandingPage from "../components/public/SessionLandingPage";
import { regenerationSessionLandingContent } from "../data/regenerationSessionLanding";
import { usePageMeta } from "../hooks/usePageMeta";
import { REGENERATION_LANDING_PATH } from "../lib/sessionLandingPaths";
import GuestCheckoutModal from "../components/guest/GuestCheckoutModal";

export default function RegenerationSessionPage() {
  const { isSignedIn } = useAuth();
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  usePageMeta({
    title: "Manifestation Monthly Package | The Prime Mentor",
    description:
      "A $99 CAD/month manifestation package with two consultations, a personal ideogram circuit created by Brad Johnson, and manifestation safeguarding.",
    canonical: `https://theprimementor.com${REGENERATION_LANDING_PATH}`,
    // BRAD-ANSWERS.md Round 3 #3: this route previously had no og:image.
    // Use the same product artwork already shown on this page.
    ogImage: "https://theprimementor.com/images/manifestation-monthly-package.png",
  });
  return (
    <>
      <SessionLandingPage
        content={regenerationSessionLandingContent}
        heroCtaAdjacentContent={!isSignedIn ? (
          <button
            type="button"
            onClick={() => setGuestModalOpen(true)}
            className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Continue as guest
          </button>
        ) : undefined}
      />
      <GuestCheckoutModal
        open={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
        endpoint="/guest/regeneration-subscription/checkout"
        title="Continue as guest"
        itemLabel="Manifestation Monthly Package — $99 CAD/month"
      />
    </>
  );
}
