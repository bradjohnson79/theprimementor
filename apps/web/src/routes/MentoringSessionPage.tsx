import SessionLandingPage from "../components/public/SessionLandingPage";
import { mentoringSessionLandingContent } from "../data/mentoringSessionLanding";
import { usePageMeta } from "../hooks/usePageMeta";
import { MENTORING_LANDING_PATH } from "../lib/sessionLandingPaths";
import { pageCanonical } from "../lib/siteMeta";

export default function MentoringSessionPage() {
  usePageMeta({
    title: "Mentoring Session | The Prime Mentor",
    description:
      "A 45 or 90-minute mentoring session with Brad Johnson to untangle the pattern that keeps repeating, and leave with a plan to change it. $199 or $299 CAD.",
    canonical: pageCanonical(MENTORING_LANDING_PATH),
    ogImage: pageCanonical("/images/mentoring-session.webp"),
  });
  return <SessionLandingPage content={mentoringSessionLandingContent} />;
}
