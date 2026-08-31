import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminGuard from "./guards/AdminGuard";
import AdminLayout from "./layouts/AdminLayout";
import AdsLayout from "./layouts/AdsLayout";
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
import Courses from "./pages/Courses";
import CourseTTT from "./pages/CourseTTT";
import Settings from "./pages/Settings";
import Analytics from "./pages/Analytics";
import Seo from "./pages/Seo";
import PromoCodes from "./pages/PromoCodes";
import Emails from "./pages/Emails";
import AdsCommandCenter from "./pages/ads/CommandCenter";
import AdsSettings from "./pages/ads/Settings";
import AdsDivin8Intelligence from "./pages/ads/Divin8Intelligence";
import AdsCampaignLab from "./pages/ads/CampaignLab";
import AdsCampaigns from "./pages/ads/Campaigns";
import AdsKeywordStrategy from "./pages/ads/KeywordStrategy";
import {
  AdsAdCopy,
  AdsAdGroups,
  AdsConversions,
  AdsKeywords,
  AdsOpportunities,
  AdsSearchTerms,
} from "./pages/ads/placeholders";
import ShopList from "./pages/shop/ShopList";
import ShopProductEditor from "./pages/shop/ShopProductEditor";
import ShopTestimonialList from "./pages/shop/ShopTestimonialList";
import ShopTestimonialEditor from "./pages/shop/ShopTestimonialEditor";
import ResonantDowsingCourse from "./pages/ResonantDowsingCourse";
import Divin8Chat from "./pages/Divin8Chat";
import Divin8Prompt from "./pages/Divin8Prompt";
import Divin8KnowledgeBase from "./pages/Divin8KnowledgeBase";
import NotificationsSettings from "./routes/settings/Notifications";
import { useUserSync } from "./hooks/useUserSync";

export default function App() {
  useUserSync();

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AdminGuard />}>
          <Route element={<FullBleedAdminLayout />}>
            <Route path="admin/divin8-chat" element={<Divin8Chat />} />
          </Route>
          <Route element={<AdsLayout />}>
            <Route path="admin/ads" element={<AdsCommandCenter />} />
            <Route path="admin/ads/campaigns" element={<AdsCampaigns />} />
            <Route path="admin/ads/ad-groups" element={<AdsAdGroups />} />
            <Route path="admin/ads/ad-copy" element={<AdsAdCopy />} />
            <Route path="admin/ads/keywords" element={<AdsKeywords />} />
            <Route path="admin/ads/keyword-strategy" element={<AdsKeywordStrategy />} />
            <Route path="admin/ads/search-terms" element={<AdsSearchTerms />} />
            <Route path="admin/ads/conversions" element={<AdsConversions />} />
            <Route path="admin/ads/opportunities" element={<AdsOpportunities />} />
            <Route path="admin/ads/campaign-lab" element={<AdsCampaignLab />} />
            <Route path="admin/ads/divin8-intelligence" element={<AdsDivin8Intelligence />} />
            <Route path="admin/ads/settings" element={<AdsSettings />} />
          </Route>
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="admin/orders" element={<Orders />} />
            <Route path="admin/orders/:orderId" element={<OrderDetail />} />
            <Route path="services" element={<Services />} />
            <Route path="events" element={<Events />} />
            <Route path="admin/courses" element={<Courses />} />
            <Route path="admin/shop" element={<ShopList />} />
            <Route path="admin/shop/testimonials" element={<ShopTestimonialList />} />
            <Route path="admin/shop/testimonials/:id" element={<ShopTestimonialEditor />} />
            <Route path="admin/shop/:id" element={<ShopProductEditor />} />
            <Route path="admin/courses/ttt" element={<CourseTTT />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="payments" element={<Payments />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="admin/settings" element={<Settings />} />
            <Route path="admin/settings/notifications" element={<NotificationsSettings />} />
            <Route path="admin/analytics" element={<Analytics />} />
            <Route path="admin/seo" element={<Seo />} />
            <Route path="admin/promo-codes" element={<PromoCodes />} />
            <Route path="admin/emails" element={<Emails />} />
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
