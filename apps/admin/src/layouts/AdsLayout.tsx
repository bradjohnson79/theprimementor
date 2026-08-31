import { Outlet } from "react-router-dom";
import AdsAgentDrawer from "../components/ads/AdsAgentDrawer";
import AdsSubnav from "../components/ads/AdsSubnav";
import { AdsAgentProvider } from "../context/AdsAgentProvider";
import AppShell from "./AppShell";

export default function AdsLayout() {
  return (
    <AppShell>
      <AdsAgentProvider>
        <div data-ads-workspace className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <AdsSubnav />
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-6 md:p-8">
              <Outlet />
            </div>
          </div>
          <AdsAgentDrawer />
        </div>
      </AdsAgentProvider>
    </AppShell>
  );
}
