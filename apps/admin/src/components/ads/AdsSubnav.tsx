import { NavLink } from "react-router-dom";
import { useAdminSettings } from "../../context/AdminSettingsContext";
import { ADS_NAV } from "../../pages/ads/adsNav";

export default function AdsSubnav() {
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";

  return (
    <nav
      data-ads-subnav
      className={`shrink-0 overflow-x-auto border-b px-4 py-2 ${
        isLightTheme ? "border-slate-200 bg-white/80" : "border-white/10 bg-navy-medium/60"
      }`}
    >
      <div className="flex min-w-max gap-1">
        {ADS_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `rounded-full px-3 py-1.5 text-xs font-medium transition ${
                isActive
                  ? "border border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                  : isLightTheme
                    ? "border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    : "border border-transparent text-white/65 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
