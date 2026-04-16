import SessionLandingPage from "../components/public/SessionLandingPage";
import { focusSessionLandingContent } from "../data/focusSessionLanding";

export default function FocusSessionPage() {
  return <SessionLandingPage content={focusSessionLandingContent} />;
}
