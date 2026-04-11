import { NavLink, useLocation } from "react-router-dom";
import { useAdminSettings } from "../context/AdminSettingsContext";
import { useI18n } from "../i18n";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  disabled?: boolean;
  indent?: boolean;
  matchPrefix?: string;
}

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: "◆" },
  { to: "/clients", label: "Clients", icon: "◇" },
  { to: "/admin/orders", label: "Orders", icon: "◈", matchPrefix: "/admin/orders" },
  { to: "/services", label: "Services", icon: "◫" },
  { to: "/events", label: "Events", icon: "◌" },
  { to: "/bookings", label: "Bookings", icon: "▦" },
  { to: "/payments", label: "Payments", icon: "▣" },
  { to: "/reports", label: "Reports", icon: "▤" },
  { to: "/blueprint", label: "Divin8 Engine", icon: "✦" },
  { to: "/admin/divin8-chat", label: "Divin8 Chat", icon: "✺", matchPrefix: "/admin/divin8-chat" },
  { to: "/admin/divin8-chat/prompt", label: "Prompt", icon: "↳", indent: true },
  { to: "/admin/settings", label: "Settings", icon: "⚙" },
];

function SidebarToggleButton({
  collapsed,
  onClick,
  isLightTheme,
}: {
  collapsed: boolean;
  onClick: () => void;
  isLightTheme: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-pressed={collapsed}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition ${
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

function navLabelKey(label: string) {
  switch (label) {
    case "Divin8 Engine":
      return "nav.divin8Engine";
    case "Divin8 Chat":
      return "nav.divin8Chat";
    default:
      return `nav.${label.toLowerCase()}`;
  }
}

export default function Sidebar({
  collapsed,
  onToggle,
  className = "",
}: {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const location = useLocation();
  const { resolvedTheme } = useAdminSettings();
  const { t } = useI18n();
  const isLightTheme = resolvedTheme === "light";

  return (
    <aside
      className={`z-10 flex h-full min-h-0 shrink-0 flex-col border-r backdrop-blur-md transition-[width] duration-300 ${
        collapsed ? "w-16" : "w-64"
      } ${
        isLightTheme
          ? "border-slate-200 bg-white/85 shadow-[0_12px_40px_rgba(15,23,42,0.08)]"
          : "border-glass-border bg-navy-medium/80"
      } ${className}`}
    >
      <div
        className={`flex h-16 shrink-0 items-center ${
          collapsed ? "justify-center px-2" : "justify-between px-4"
        }`}
      >
        {collapsed ? null : (
          <div className="min-w-0">
            <span
              className={`truncate text-lg font-semibold tracking-tight ${
                isLightTheme ? "text-slate-900" : "text-white"
              }`}
            >
              {t("sidebar.brand")}
            </span>
            <span className="ml-1 text-lg font-light text-accent-cyan">
              {t("sidebar.admin")}
            </span>
          </div>
        )}
        <SidebarToggleButton collapsed={collapsed} onClick={onToggle} isLightTheme={isLightTheme} />
      </div>

      {collapsed ? <div className="flex-1" /> : (
        <nav className="mt-4 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-y-contain px-3 pb-4">
          {navItems.map((item) =>
            item.disabled ? (
              <span
                key={item.label}
                className={`flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                  isLightTheme ? "text-slate-400" : "text-white/30"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {t(navLabelKey(item.label))}
              </span>
            ) : (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) => {
                  const matchesPrefix = item.matchPrefix
                    ? location.pathname.startsWith(item.matchPrefix)
                    : false;
                  const active = isActive || matchesPrefix;

                  return (
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                      item.indent ? "ml-5 pl-4" : ""
                    } ${
                      active
                        ? "bg-accent-cyan/10 text-accent-cyan glow-cyan"
                        : isLightTheme
                          ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          : "text-white/70 hover:bg-glass-hover hover:text-white"
                    }`
                  );
                }}
              >
                <span className="text-base">{item.icon}</span>
                {t(navLabelKey(item.label))}
              </NavLink>
            ),
          )}
        </nav>
      )}
    </aside>
  );
}
