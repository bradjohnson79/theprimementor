import SessionLandingPage from "../components/public/SessionLandingPage";
import { qaSessionLandingContent } from "../data/qaSessionLanding";

export default function QASessionPage() {
  return <SessionLandingPage content={qaSessionLandingContent} />;
}
