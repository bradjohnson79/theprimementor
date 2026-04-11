import { useState, type ReactNode } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { useAdminSettings } from "../context/AdminSettingsContext";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div
      className={
        isLightTheme
          ? "relative flex h-[100dvh] min-h-0 overflow-hidden bg-slate-100"
          : "relative flex h-[100dvh] min-h-0 overflow-hidden bg-navy"
      }
    >
      <div className="aurora-bg" aria-hidden />
      <Sidebar
        className="hidden md:flex"
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((current) => !current)}
      />
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileSidebarOpen(true)} />
        <main id="admin-shell-main" className="flex min-h-0 flex-1 flex-col">
          {children}
        </main>
      </div>
      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-30 md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <Sidebar
            className="absolute inset-y-0 left-0 w-80 max-w-[85vw] shadow-2xl"
            collapsed={false}
            onToggle={() => setMobileSidebarOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
