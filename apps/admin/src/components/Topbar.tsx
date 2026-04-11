import { useUser, UserButton } from "@clerk/react";
import { useAdminSettings } from "../context/AdminSettingsContext";
import { useI18n } from "../i18n";

export default function Topbar({ onMenuClick }: { onMenuClick?: () => void } = {}) {
  return <TopbarContent onMenuClick={onMenuClick} />;
}

function MenuButton({ onClick, isLightTheme }: { onClick: () => void; isLightTheme: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open navigation menu"
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition md:hidden ${
        isLightTheme
          ? "border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          : "border-white/10 text-white/80 hover:bg-white/5 hover:text-white"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M4 12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M4 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function TopbarContent({ onMenuClick }: { onMenuClick?: () => void } = {}) {
  const { user } = useUser();
  const { resolvedTheme } = useAdminSettings();
  const { t } = useI18n();
  const isLightTheme = resolvedTheme === "light";

  return (
    <header
      className={`z-20 flex h-16 w-full shrink-0 items-center justify-between gap-3 border-b px-4 sm:px-6 lg:px-8 backdrop-blur-md ${
        isLightTheme
          ? "border-slate-200 bg-white/80"
          : "border-glass-border bg-navy/80"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {onMenuClick ? <MenuButton onClick={onMenuClick} isLightTheme={isLightTheme} /> : null}
        <h1 className={`truncate text-lg font-semibold ${isLightTheme ? "text-slate-900" : "text-white/90"}`}>
          {t("shell.adminDashboard")}
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <span className={`hidden text-sm sm:inline ${isLightTheme ? "text-slate-500" : "text-white/50"}`}>
          {user?.primaryEmailAddress?.emailAddress}
        </span>
        <UserButton />
      </div>
    </header>
  );
}
