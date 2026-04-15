import { useState } from "react";
import { Home } from "lucide-react";
import { NavLink, Link, Outlet } from "react-router-dom";
import { UserButton } from "@clerk/react";
import CosmicBackground from "../components/ui/CosmicBackground";
import { useCurrentUser } from "../hooks/useCurrentUser";

function SidebarToggleButton({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-pressed={collapsed}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-white/80 transition hover:bg-white/5 hover:text-white"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M4 12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M4 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export default function MemberLayout() {
  type MemberNavItem = {
    to: string;
    label: string;
    icon: string;
    end?: boolean;
  };

  const { tierState } = useCurrentUser();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isTierLoading = tierState === "loading";
  const dashboardTier = tierState === "free"
    ? "Free"
    : tierState === "initiate"
      ? "Initiate"
      : "Seeker";
  const dashboardTierBadgeClassName = tierState === "free"
    ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-200"
    : tierState === "initiate"
      ? "border-violet-400/30 bg-violet-400/12 text-violet-200"
      : "border-sky-400/30 bg-sky-400/12 text-sky-200";
  const navItems: MemberNavItem[] = [
    { to: "/dashboard", label: "Dashboard", icon: "◆", end: true },
    ...(isTierLoading || tierState === "free" ? [] : [{ to: "/dashboard/divin8", label: "Divin8 Chat", icon: "✺" }]),
    { to: "/dashboard/recordings", label: "Recordings", icon: "◉" },
    { to: "/sessions", label: "Sessions", icon: "◌" },
    { to: "/reports", label: "Reports", icon: "▤" },
    { to: "/mentoring-circle", label: "Mentoring Circle", icon: "◎" },
    ...(tierState === "initiate" ? [{ to: "/mentor-training", label: "Mentor Training", icon: "◇" }] : []),
    { to: "/dashboard/courses", label: "Courses", icon: "▧" },
    { to: "/settings", label: "Settings", icon: "⚙" },
    { to: "/member/contact", label: "Contact", icon: "✉" },
  ];

  return (
    <div className="relative isolate flex min-h-screen bg-navy text-white">
      <CosmicBackground />
      <aside
        className={`sticky top-0 z-10 hidden h-screen shrink-0 flex-col border-r border-glass-border bg-navy-medium/80 backdrop-blur-md transition-[width] duration-300 md:flex ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div
          className={`shrink-0 border-b border-glass-border ${
            sidebarCollapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          <div className={`flex ${sidebarCollapsed ? "h-16 items-center justify-center" : "min-h-16 items-center justify-between py-3"} `}>
            {sidebarCollapsed ? null : (
              <div className="min-w-0">
                <span className="truncate text-lg font-semibold tracking-tight text-white">Prime Mentor</span>
                <div className="mt-1">
                  {isTierLoading ? (
                    <span className="inline-flex h-5 w-16 animate-pulse rounded-full bg-white/10" aria-hidden="true" />
                  ) : (
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${dashboardTierBadgeClassName}`}
                    >
                      {dashboardTier}
                    </span>
                  )}
                </div>
              </div>
            )}
            <SidebarToggleButton
              collapsed={sidebarCollapsed}
              onClick={() => setSidebarCollapsed((current) => !current)}
            />
          </div>
        </div>
        {sidebarCollapsed ? <div className="flex-1" /> : (
          <>
            <nav className="mt-4 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-y-contain px-3 pb-4">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                      isActive
                        ? "bg-accent-cyan/10 text-accent-cyan glow-cyan"
                        : "text-white/70 hover:bg-glass-hover hover:text-white"
                    }`
                  }
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
              <Link
                to="/"
                className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/45 transition-all hover:bg-white/[0.04] hover:text-white/70"
              >
                <Home className="h-4 w-4 shrink-0 opacity-90" strokeWidth={1.75} aria-hidden />
                Back to Home
              </Link>
            </nav>
            <div className="border-t border-glass-border px-4 py-4">
              <UserButton />
            </div>
          </>
        )}
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-glass-border bg-navy/85 px-4 py-3 backdrop-blur-md md:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold tracking-tight text-white">Prime Mentor</p>
              <div className="mt-1">
                {isTierLoading ? (
                  <span className="inline-flex h-5 w-16 animate-pulse rounded-full bg-white/10" aria-hidden="true" />
                ) : (
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${dashboardTierBadgeClassName}`}
                  >
                    {dashboardTier}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <UserButton />
              <SidebarToggleButton
                collapsed={!mobileSidebarOpen}
                onClick={() => setMobileSidebarOpen((current) => !current)}
              />
            </div>
          </div>
        </header>
        <main className="flex min-h-[100dvh] w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
          <Outlet />
        </main>
      </div>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-30 md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r border-glass-border bg-navy-medium/95 shadow-2xl backdrop-blur-xl">
            <div className="flex min-h-16 items-center justify-between border-b border-glass-border px-4 py-3">
              <div className="min-w-0">
                <span className="truncate text-lg font-semibold tracking-tight text-white">Prime Mentor</span>
                <div className="mt-1">
                  {isTierLoading ? (
                    <span className="inline-flex h-5 w-16 animate-pulse rounded-full bg-white/10" aria-hidden="true" />
                  ) : (
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${dashboardTierBadgeClassName}`}
                    >
                      {dashboardTier}
                    </span>
                  )}
                </div>
              </div>
              <SidebarToggleButton collapsed={false} onClick={() => setMobileSidebarOpen(false)} />
            </div>
            <nav className="mt-4 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-y-contain px-3 pb-4">
              {navItems.map((item) => (
                <NavLink
                  key={`mobile-${item.to}`}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-all ${
                      isActive
                        ? "bg-accent-cyan/10 text-accent-cyan glow-cyan"
                        : "text-white/70 hover:bg-glass-hover hover:text-white"
                    }`
                  }
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
              <Link
                to="/"
                onClick={() => setMobileSidebarOpen(false)}
                className="mt-1 flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-white/45 transition-all hover:bg-white/[0.04] hover:text-white/70"
              >
                <Home className="h-4 w-4 shrink-0 opacity-90" strokeWidth={1.75} aria-hidden />
                Back to Home
              </Link>
            </nav>
            <div className="border-t border-glass-border px-4 py-4">
              <UserButton />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
