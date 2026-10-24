import { Suspense, lazy, useEffect } from "react";
import { STAR_FAMILY_ON_DEMAND_WEBINAR_ID } from "@wisdom/utils";
import { initGoogleAdsGlobalSiteTag } from "./lib/googleAdsTag";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { installGoatCounterScript, trackPageview } from "./lib/analytics";
import RootLayout from "./layouts/RootLayout";
import ProtectedLayout from "./layouts/ProtectedLayout";
import MemberLayout from "./layouts/MemberLayout";
import Home from "./routes/Home";
import SupportWidget from "./components/support/SupportWidget";
import {
  EMAIL_SESSION_BOOKING_PATH,
  EMAIL_SESSION_LANDING_PATH,
  FOCUS_BOOKING_PATH,
  FOCUS_LANDING_PATH,
  MENTORING_BOOKING_PATH,
  MENTORING_LANDING_PATH,
  PAST_LIFE_AKASHIC_BOOKING_PATH,
  PAST_LIFE_AKASHIC_LANDING_PATH,
  PRIME_BODY_HEALING_BOOKING_PATH,
  PRIME_BODY_HEALING_LANDING_PATH,
  QA_BOOKING_PATH,
  QA_LANDING_PATH,
  REGENERATION_BOOKING_PATH,
  REGENERATION_LANDING_PATH,
} from "./lib/sessionLandingPaths";
import { TTT_COURSE_ROUTE } from "./lib/courses.config";

// Performance (BRAD-ANSWERS.md Round 3 #1c): only Home and the layout shells
// are needed for the first paint of "/". Every other route is loaded on
// demand with React.lazy so the main JS chunk no longer bundles dashboard,
// shop, session-landing, webinar, and admin-ish pages that most visitors to
// "/" never open. No feature, animation, or visual behavior is removed —
// each lazy route renders exactly as before once its chunk loads, behind the
// same shared <Suspense> fallback already used for Courses/Dashboard pages.
const StartHerePage = lazy(() => import("./routes/StartHerePage"));
const SignInPage = lazy(() => import("./routes/SignInPage"));
const SignUpPage = lazy(() => import("./routes/SignUpPage"));
const ContactPublic = lazy(() => import("./routes/ContactPublic"));
const About = lazy(() => import("./routes/About"));
const Media = lazy(() => import("./routes/Media"));
const Privacy = lazy(() => import("./routes/Privacy"));
const Terms = lazy(() => import("./routes/Terms"));
const NotFoundPage = lazy(() => import("./routes/NotFoundPage"));
const Dashboard = lazy(() => import("./routes/Dashboard"));
const MemberDivin8Chat = lazy(() => import("./routes/MemberDivin8Chat"));
const Bookings = lazy(() => import("./routes/Bookings"));
const Recordings = lazy(() => import("./routes/Recordings"));
const MentoringCircle = lazy(() => import("./routes/MentoringCircle"));
const AdronisWebinarCheckout = lazy(() => import("./routes/AdronisWebinarCheckout"));
const AdronisWebinarThankYou = lazy(() => import("./routes/AdronisWebinarThankYou"));
const PrimeAlchemyWebinarLearnMore = lazy(() => import("./routes/PrimeAlchemyWebinarLearnMore"));
const PrimeAlchemyWebinarThankYou = lazy(() => import("./routes/PrimeAlchemyWebinarThankYou"));
const OnDemandWebinarCheckout = lazy(() => import("./routes/OnDemandWebinarCheckout"));
const OnDemandWebinarThankYou = lazy(() => import("./routes/OnDemandWebinarThankYou"));
const MentorTraining = lazy(() => import("./routes/MentorTraining"));
const Settings = lazy(() => import("./routes/Settings"));
const Contact = lazy(() => import("./routes/Contact"));
const ReportOrder = lazy(() => import("./routes/ReportOrder"));
const ReportsLanding = lazy(() => import("./routes/ReportsLanding"));
const ReportProductLanding = lazy(() => import("./routes/ReportProductLanding"));
const ShopLanding = lazy(() => import("./routes/ShopLanding"));
const ShopProduct = lazy(() => import("./routes/ShopProduct"));
const ShopSuccess = lazy(() => import("./routes/ShopSuccess"));
const MemberPurchases = lazy(() => import("./routes/MemberPurchases"));
const MembershipSignup = lazy(() => import("./routes/MembershipSignup"));
const WebsiteErrorPage = lazy(() => import("./routes/WebsiteErrorPage"));
const GuestOrderPage = lazy(() => import("./routes/GuestOrderPage"));
const GuestThankYouPage = lazy(() => import("./routes/GuestThankYouPage"));
const GuestServicesIntakePage = lazy(() => import("./routes/GuestServicesIntakePage"));
const GuestReportsIntakePage = lazy(() => import("./routes/GuestReportsIntakePage"));
const RegenerationSessionPage = lazy(() => import("./routes/RegenerationSessionPage"));
const RegenerationSuccess = lazy(() => import("./routes/RegenerationSuccess"));
const RegenerationOfferPage = lazy(() => import("./routes/RegenerationOfferPage"));
const RegenerationOfferSuccess = lazy(() => import("./routes/RegenerationOfferSuccess"));
const QASessionPage = lazy(() => import("./routes/QASessionPage"));
const MentoringSessionPage = lazy(() => import("./routes/MentoringSessionPage"));
const PrimeBodyHealingPage = lazy(() => import("./routes/PrimeBodyHealingPage"));
const PrimeBodyHealingBook = lazy(() => import("./routes/PrimeBodyHealingBook"));
const OfflineSessionPage = lazy(() => import("./routes/OfflineSessionPage"));
const OfflineSessionBook = lazy(() => import("./routes/OfflineSessionBook"));
const Courses = lazy(() => import("./routes/Courses"));
const DashboardWebinars = lazy(() => import("./routes/DashboardWebinars"));
const OnDemandWebinarPlayer = lazy(() => import("./routes/OnDemandWebinarPlayer"));
const CourseTTT = lazy(() => import("./routes/CourseTTT"));
const CourseResonantDowsing = lazy(() => import("./routes/CourseResonantDowsing"));

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
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    return installGoatCounterScript();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    trackPageview(`${pathname}${search}${hash}`);
  }, [pathname, search, hash]);

  return null;
}

export default function App() {
  useEffect(() => {
    initGoogleAdsGlobalSiteTag();
  }, []);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route index element={<Home />} />
            <Route path="/start-here" element={<StartHerePage />} />
            <Route path="/sign-in/*" element={<SignInPage />} />
            <Route path="/sign-up/*" element={<SignUpPage />} />
            <Route path="/contact" element={<ContactPublic />} />
            <Route path="/about" element={<About />} />
            <Route path="/media" element={<Media />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/reports" element={<ReportsLanding />} />
            <Route path="/reports/introductory" element={<ReportProductLanding />} />
            <Route path="/reports/compatibility" element={<ReportProductLanding />} />
            <Route path="/shop" element={<ShopLanding />} />
            <Route path="/shop/order/success" element={<ShopSuccess />} />
            <Route path="/shop/success" element={<ShopSuccess />} />
            <Route path="/shop/:slug" element={<ShopProduct />} />
            <Route path="/error" element={<WebsiteErrorPage />} />
            <Route path="/order/thank-you" element={<GuestThankYouPage />} />
            <Route path="/order/:token" element={<GuestOrderPage />} />
            <Route path="/intake/services/:token" element={<GuestServicesIntakePage />} />
            <Route path="/intake/reports/:token" element={<GuestReportsIntakePage />} />
            <Route path="/membership-signup" element={<MembershipSignup />} />
            <Route path="/subscriptions" element={<Navigate to="/subscriptions/seeker" replace />} />
            <Route path="/subscriptions/seeker" element={<MembershipSignup />} />
            <Route path="/subscriptions/initiate" element={<MembershipSignup />} />
            <Route path={REGENERATION_LANDING_PATH} element={<RegenerationSessionPage />} />
            <Route path="/sessions/regeneration" element={<Navigate to={REGENERATION_LANDING_PATH} replace />} />
            <Route path="/regeneration-offer" element={<RegenerationOfferPage />} />
            <Route path="/regeneration-offer/success" element={<RegenerationOfferSuccess />} />
            <Route path={QA_LANDING_PATH} element={<QASessionPage />} />
            <Route path={FOCUS_LANDING_PATH} element={<Navigate to="/#sessions" replace />} />
            <Route path={FOCUS_BOOKING_PATH} element={<Navigate to="/#sessions" replace />} />
            <Route path={MENTORING_LANDING_PATH} element={<MentoringSessionPage />} />
            <Route path={PRIME_BODY_HEALING_LANDING_PATH} element={<PrimeBodyHealingPage />} />
            <Route path={EMAIL_SESSION_LANDING_PATH} element={<OfflineSessionPage product="email" />} />
            <Route path={PAST_LIFE_AKASHIC_LANDING_PATH} element={<OfflineSessionPage product="pastLife" />} />
            <Route path="/webinars/prime-alchemy-teachings" element={<PrimeAlchemyWebinarLearnMore />} />
            <Route path="/webinars/prime-alchemy-teachings/thank-you" element={<PrimeAlchemyWebinarThankYou />} />
            <Route path="/webinars/adronis-star-family-communion" element={<Navigate to="/" replace />} />
            <Route path="/webinars/adronis-star-family-communion/thank-you" element={<Navigate to="/" replace />} />
            <Route path="/webinars/adronis-star-family-communion/on-demand" element={<OnDemandWebinarCheckout webinarId={STAR_FAMILY_ON_DEMAND_WEBINAR_ID} />} />
            <Route path="/webinars/adronis-star-family-communion/on-demand/thank-you" element={<OnDemandWebinarThankYou webinarId={STAR_FAMILY_ON_DEMAND_WEBINAR_ID} />} />
            <Route path="/webinars/adronis-disclosure-to-contact" element={<AdronisWebinarCheckout />} />
            <Route path="/webinars/adronis-disclosure-to-contact/thank-you" element={<AdronisWebinarThankYou />} />
            <Route path="/webinars/adronis-disclosure-to-contact/on-demand" element={<OnDemandWebinarCheckout />} />
            <Route path="/webinars/adronis-disclosure-to-contact/on-demand/thank-you" element={<OnDemandWebinarThankYou />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route element={<ProtectedLayout />}>
            <Route element={<MemberLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/divin8" element={<MemberDivin8Chat />} />
              <Route path="/dashboard/recordings" element={<Recordings />} />
              <Route path="/dashboard/purchases" element={<MemberPurchases />} />
              <Route path="/sessions" element={<Bookings />} />
              <Route path="/sessions/live/book" element={<Bookings />} />
              <Route path={REGENERATION_BOOKING_PATH} element={<Bookings />} />
              <Route path="/sessions/regeneration/success" element={<RegenerationSuccess />} />
              <Route path={QA_BOOKING_PATH} element={<Bookings />} />
              <Route path={MENTORING_BOOKING_PATH} element={<Bookings />} />
              <Route path={PRIME_BODY_HEALING_BOOKING_PATH} element={<PrimeBodyHealingBook />} />
              <Route path={EMAIL_SESSION_BOOKING_PATH} element={<OfflineSessionBook product="email" />} />
              <Route path={PAST_LIFE_AKASHIC_BOOKING_PATH} element={<OfflineSessionBook product="pastLife" />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/dashboard/reports/:reportType" element={<ReportOrder />} />
              <Route path="/reports/intro" element={<Navigate to="/dashboard/reports/intro" replace />} />
              <Route path="/reports/deep-dive" element={<Navigate to="/dashboard/reports/deep-dive" replace />} />
              <Route path="/reports/initiate" element={<Navigate to="/dashboard/reports/initiate" replace />} />
              <Route path="/mentoring-circle" element={<MentoringCircle />} />
              <Route path="/events/mentoring-circle" element={<MentoringCircle />} />
              <Route path="/mentor-training" element={<MentorTraining />} />
              <Route path="/dashboard/webinars" element={<DashboardWebinars />} />
              <Route path="/dashboard/webinars/:webinarId" element={<OnDemandWebinarPlayer />} />
              <Route path="/dashboard/courses" element={<Courses />} />
              <Route path="/dashboard/courses/resonant-dowsing" element={<CourseResonantDowsing />} />
              <Route path={TTT_COURSE_ROUTE} element={<CourseTTT />} />
              <Route path="/dashboard/courses/ttt" element={<CourseTTT />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/member/contact" element={<Contact />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      <SupportWidget />
    </BrowserRouter>
  );
}
