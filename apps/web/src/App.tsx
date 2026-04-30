import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";
import ProtectedLayout from "./layouts/ProtectedLayout";
import MemberLayout from "./layouts/MemberLayout";
import Home from "./routes/Home";
import SignInPage from "./routes/SignInPage";
import SignUpPage from "./routes/SignUpPage";
import ContactPublic from "./routes/ContactPublic";
import Privacy from "./routes/Privacy";
import Terms from "./routes/Terms";
import NotFoundPage from "./routes/NotFoundPage";
import Dashboard from "./routes/Dashboard";
import MemberDivin8Chat from "./routes/MemberDivin8Chat";
import Bookings from "./routes/Bookings";
import Recordings from "./routes/Recordings";
import MentoringCircle from "./routes/MentoringCircle";
import MentorTraining from "./routes/MentorTraining";
import Settings from "./routes/Settings";
import Contact from "./routes/Contact";
import Reports from "./routes/Reports";
import MembershipSignup from "./routes/MembershipSignup";
import WebsiteErrorPage from "./routes/WebsiteErrorPage";
import SupportWidget from "./components/support/SupportWidget";
import RegenerationSessionPage from "./routes/RegenerationSessionPage";
import QASessionPage from "./routes/QASessionPage";
import FocusSessionPage from "./routes/FocusSessionPage";
import MentoringSessionPage from "./routes/MentoringSessionPage";
import {
  FOCUS_BOOKING_PATH,
  FOCUS_LANDING_PATH,
  MENTORING_BOOKING_PATH,
  MENTORING_LANDING_PATH,
  QA_BOOKING_PATH,
  QA_LANDING_PATH,
  REGENERATION_BOOKING_PATH,
  REGENERATION_LANDING_PATH,
} from "./lib/sessionLandingPaths";
import { TTT_COURSE_ROUTE } from "./lib/courses.config";

const Courses = lazy(() => import("./routes/Courses"));
const CourseTTT = lazy(() => import("./routes/CourseTTT"));

function RouteFallback() {
  return (
    <div className="dashboard-shell">
      <div className="mx-auto max-w-5xl">
        <div className="dashboard-panel text-sm text-white/60">Loading...</div>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<RootLayout />}>
          <Route index element={<Home />} />
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
          <Route path="/contact" element={<ContactPublic />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/error" element={<WebsiteErrorPage />} />
          <Route path="/membership-signup" element={<MembershipSignup />} />
          <Route path="/subscriptions/seeker" element={<MembershipSignup />} />
          <Route path="/subscriptions/initiate" element={<MembershipSignup />} />
          <Route path={REGENERATION_LANDING_PATH} element={<RegenerationSessionPage />} />
          <Route path={QA_LANDING_PATH} element={<QASessionPage />} />
          <Route path={FOCUS_LANDING_PATH} element={<FocusSessionPage />} />
          <Route path={MENTORING_LANDING_PATH} element={<MentoringSessionPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route element={<ProtectedLayout />}>
          <Route element={<MemberLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/divin8" element={<MemberDivin8Chat />} />
            <Route path="/dashboard/recordings" element={<Recordings />} />
            <Route path="/sessions" element={<Bookings />} />
            <Route path={FOCUS_BOOKING_PATH} element={<Bookings />} />
            <Route path={REGENERATION_BOOKING_PATH} element={<Bookings />} />
            <Route path={QA_BOOKING_PATH} element={<Bookings />} />
            <Route path={MENTORING_BOOKING_PATH} element={<Bookings />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/intro" element={<Reports />} />
            <Route path="/reports/deep-dive" element={<Reports />} />
            <Route path="/reports/initiate" element={<Reports />} />
            <Route path="/mentoring-circle" element={<MentoringCircle />} />
            <Route path="/events/mentoring-circle" element={<MentoringCircle />} />
            <Route path="/mentor-training" element={<MentorTraining />} />
            <Route
              path="/dashboard/courses"
              element={(
                <Suspense fallback={<RouteFallback />}>
                  <Courses />
                </Suspense>
              )}
            />
            <Route
              path={TTT_COURSE_ROUTE}
              element={(
                <Suspense fallback={<RouteFallback />}>
                  <CourseTTT />
                </Suspense>
              )}
            />
            <Route
              path="/dashboard/courses/ttt"
              element={(
                <Suspense fallback={<RouteFallback />}>
                  <CourseTTT />
                </Suspense>
              )}
            />
            <Route path="/settings" element={<Settings />} />
            <Route path="/member/contact" element={<Contact />} />
          </Route>
        </Route>
      </Routes>
      <SupportWidget />
    </BrowserRouter>
  );
}
