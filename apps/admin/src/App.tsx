import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminGuard from "./guards/AdminGuard";
import AdminLayout from "./layouts/AdminLayout";
import FullBleedAdminLayout from "./layouts/FullBleedAdminLayout";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Blueprint from "./pages/Blueprint";
import Bookings from "./pages/Bookings";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import Services from "./pages/Services";
import Events from "./pages/Events";
import Settings from "./pages/Settings";
import Analytics from "./pages/Analytics";
import Seo from "./pages/Seo";
import PromoCodes from "./pages/PromoCodes";
import ResonantDowsingCourse from "./pages/ResonantDowsingCourse";
import ResonantDowsingCourseLocalPreview from "./pages/ResonantDowsingCourseLocalPreview";
import Divin8Chat from "./pages/Divin8Chat";
import Divin8Prompt from "./pages/Divin8Prompt";
import Divin8KnowledgeBase from "./pages/Divin8KnowledgeBase";
import NotificationsSettings from "./routes/settings/Notifications";
import { useUserSync } from "./hooks/useUserSync";

const ADMIN_DEV_PREVIEW = import.meta.env.DEV && import.meta.env.VITE_ADMIN_DEV_PREVIEW === "true";

function PreviewApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="admin/courses/resonant-dowsing" element={<ResonantDowsingCourseLocalPreview />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function AuthenticatedApp() {
  useUserSync();

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AdminGuard />}>
          <Route element={<FullBleedAdminLayout />}>
            <Route path="admin/divin8-chat" element={<Divin8Chat />} />
          </Route>
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="admin/orders" element={<Orders />} />
            <Route path="admin/orders/:orderId" element={<OrderDetail />} />
            <Route path="services" element={<Services />} />
            <Route path="events" element={<Events />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="payments" element={<Payments />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="admin/settings" element={<Settings />} />
            <Route path="admin/settings/notifications" element={<NotificationsSettings />} />
            <Route path="admin/analytics" element={<Analytics />} />
            <Route path="admin/seo" element={<Seo />} />
            <Route path="admin/promo-codes" element={<PromoCodes />} />
            <Route path="admin/courses/resonant-dowsing" element={<ResonantDowsingCourse />} />
            <Route path="admin/divin8-chat/prompt" element={<Divin8Prompt />} />
            <Route path="admin/divin8-chat/knowledge-base" element={<Divin8KnowledgeBase />} />
            <Route path="blueprint" element={<Blueprint />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return ADMIN_DEV_PREVIEW ? <PreviewApp /> : <AuthenticatedApp />;
}
