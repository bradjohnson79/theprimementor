import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth, UserButton, useUser } from "@clerk/react";
import { LayoutDashboard } from "lucide-react";
import PublicEnergyBackground from "../components/background/PublicEnergyBackground";
import pmLogo from "../assets/prime-mentor-logo.webp";
import { getUmamiScriptUrl, getUmamiWebsiteId } from "../lib/analytics";
import { useUserSync } from "../hooks/useUserSync";
import {
  FOCUS_LANDING_PATH,
  MENTORING_LANDING_PATH,
  REGENERATION_LANDING_PATH,
} from "../lib/sessionLandingPaths";

interface NavItem {
  label: string;
  href?: string;
  external?: boolean;
}

interface NavGroup {
  label: string;
  href: string;
  items?: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Sessions",
    href: "/#sessions",
    items: [
      { label: "Regeneration Session", href: REGENERATION_LANDING_PATH },
      { label: "Focus Session", href: FOCUS_LANDING_PATH },
      { label: "Mentoring Session", href: MENTORING_LANDING_PATH },
    ],
  },
  {
    label: "Reports",
    href: "/#reports",
    items: [
      { label: "Introductory Report", href: "/reports/intro" },
      { label: "Deep Dive Report", href: "/reports/deep-dive" },
      { label: "Initiate Report", href: "/reports/initiate" },
    ],
  },
  {
    label: "Subscriptions",
    href: "/#subscriptions",
    items: [
      { label: "Seeker", href: "/subscriptions/seeker" },
      { label: "Initiate", href: "/subscriptions/initiate" },
    ],
  },
  {
    label: "Events",
    href: "/#events",
    items: [
      { label: "Mentoring Circle", href: "/events/mentoring-circle" },
    ],
  },
  {
    label: "Links",
    href: "/#links",
    items: [
      { label: "Trauma Transcendence Technique Book", href: "https://traumatranscendence.com", external: true },
      { label: "RAYD8", href: "https://rayd8.com", external: true },
      { label: "AetherX", href: "https://aetherx.app", external: true },
    ],
  },
  { label: "About", href: "/#about" },
  { label: "Contact", href: "/#contact" },
];

function clerkNavDisplayName(user: {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}) {
  const full = user.fullName?.trim();
  if (full) return full;
  const firstLast = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (firstLast) return firstLast;
  const username = user.username?.trim();
  if (username) return username;
  return "Member";
}

export default function RootLayout() {
  const { isSignedIn } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileDropdown, setMobileDropdown] = useState<string | null>(null);
  const isMarketingSurface =
    location.pathname === "/"
    || location.pathname === "/membership-signup"
    || location.pathname.startsWith("/subscriptions/")
    || location.pathname === REGENERATION_LANDING_PATH
    || location.pathname === FOCUS_LANDING_PATH
    || location.pathname === MENTORING_LANDING_PATH;

  useUserSync();

  useEffect(() => {
    const scriptId = "prime-mentor-umami";
    if (document.getElementById(scriptId)) {
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.defer = true;
    script.src = getUmamiScriptUrl();
    script.setAttribute("data-website-id", getUmamiWebsiteId());
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  function toggleMobileDropdown(label: string) {
    setMobileDropdown((current) => (current === label ? null : label));
  }

  function closeMobileMenus() {
    setMobileMenuOpen(false);
    setMobileDropdown(null);
  }

  function toNavHref(href: string) {
    if (!href.startsWith("/#")) return href;
    return location.pathname === "/" ? href.replace("/", "") : href;
  }

  function renderNavLink(item: NavGroup | NavItem, className: string, onClick?: () => void) {
    const href = toNavHref(item.href ?? "/");
    if ("external" in item && item.external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>
          {item.label}
        </a>
      );
    }

    return (
      <a href={href} className={className} onClick={onClick}>
        {item.label}
      </a>
    );
  }

  return (
    <div className={`relative flex min-h-screen flex-col ${isMarketingSurface ? "bg-[#04050f] text-white" : "bg-gray-50 text-gray-900"}`}>
      {isMarketingSurface ? <PublicEnergyBackground /> : null}

      <header
        className={`sticky top-0 z-50 shrink-0 border-b ${
          isMarketingSurface
            ? "border-white/10 bg-[#04050f]/90 backdrop-blur-2xl"
            : "border-gray-200 bg-white/95 backdrop-blur"
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid h-20 grid-cols-[auto_1fr_auto] items-center gap-4">
            <a
              href="/"
              onClick={closeMobileMenus}
              className="flex min-w-0 items-center gap-3"
            >
              <img src={pmLogo} alt="Prime Mentor" className="h-10 w-10 rounded-full object-contain" />
              <div>
                <p className={`text-sm font-semibold tracking-[0.08em] ${isMarketingSurface ? "text-white" : "text-gray-900"}`}>
                  The Prime Mentor
                </p>
                <p className={`text-[11px] uppercase tracking-[0.28em] ${isMarketingSurface ? "text-cyan-100/55" : "text-gray-500"}`}>
                  Brad Johnson
                </p>
              </div>
            </a>

            <div className="flex min-w-0 items-center justify-center">
              <nav className="hidden lg:block" aria-label="Primary navigation">
                <ul className="flex items-center gap-1">
                  {NAV_GROUPS.map((group) => (
                    <li key={group.label} className="relative group">
                      <div className="flex items-center">
                        {renderNavLink(
                          group,
                          `rounded-full px-3 py-2 text-[13px] transition ${
                            isMarketingSurface
                              ? "text-white/72 hover:bg-white/8 hover:text-white"
                              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                          }`,
                        )}
                        {group.items?.length ? (
                          <span
                            className={`pointer-events-none -ml-2 pr-3 text-xs ${
                              isMarketingSurface ? "text-white/50" : "text-gray-400"
                            }`}
                            aria-hidden="true"
                          >
                            ▾
                          </span>
                        ) : null}
                      </div>
                      {group.items?.length ? (
                        <div
                          className="invisible absolute left-0 top-full z-50 min-w-[15rem] pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100"
                        >
                          <div
                            className={`rounded-2xl border py-2 shadow-2xl ${
                              isMarketingSurface
                                ? "border-white/10 bg-[#090d19]/94 backdrop-blur-2xl"
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            {group.items.map((item) => (
                              <div key={`${group.label}-${item.label}`}>
                                {renderNavLink(
                                  item,
                                  `block px-4 py-2.5 text-[13px] transition ${
                                    isMarketingSurface
                                      ? "text-white/72 hover:bg-white/8 hover:text-white"
                                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                  }`,
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="relative lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((open) => !open)}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition ${
                    isMarketingSurface
                      ? "border-white/15 bg-white/8 text-white hover:bg-white/12"
                      : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
                  }`}
                  aria-expanded={mobileMenuOpen}
                  aria-controls="mobile-primary-nav"
                  aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="h-5 w-5">
                    <path d="M4 7h16" />
                    <path d="M4 12h16" />
                    <path d="M4 17h16" />
                  </svg>
                </button>

                {mobileMenuOpen ? (
                  <div
                    id="mobile-primary-nav"
                    className={`absolute left-1/2 top-full z-50 mt-3 w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border p-3 shadow-2xl ${
                      isMarketingSurface
                        ? "border-white/10 bg-[#090d19]/96 backdrop-blur-2xl"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <nav aria-label="Mobile navigation">
                      <div className="mb-3 border-b border-white/10 pb-3">
                        {isSignedIn ? (
                          <Link
                            to="/dashboard"
                            onClick={closeMobileMenus}
                            className={`block rounded-xl px-3 py-2 text-sm font-medium transition ${
                              isMarketingSurface
                                ? "text-white/85 hover:bg-white/8 hover:text-white"
                                : "text-gray-800 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                          >
                            Dashboard
                          </Link>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <Link
                              to="/sign-in"
                              onClick={closeMobileMenus}
                              className={`rounded-xl px-3 py-2 text-center text-sm transition ${
                                isMarketingSurface
                                  ? "text-white/80 hover:bg-white/8 hover:text-white"
                                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                              }`}
                            >
                              Sign In
                            </Link>
                            <Link
                              to="/sign-up"
                              onClick={closeMobileMenus}
                              className={`rounded-xl px-3 py-2 text-center text-sm transition ${
                                isMarketingSurface
                                  ? "border border-white/18 bg-white/10 text-white hover:bg-white/18"
                                  : "bg-gray-900 text-white hover:bg-gray-800"
                              }`}
                            >
                              Sign Up
                            </Link>
                          </div>
                        )}
                      </div>
                      <ul className="space-y-2">
                        {NAV_GROUPS.map((group) => (
                          <li key={group.label} className="rounded-xl border border-transparent">
                            <div className="flex items-center justify-between gap-2">
                              {renderNavLink(
                                group,
                                `min-w-0 flex-1 rounded-xl px-3 py-2 text-left text-sm transition ${
                                  isMarketingSurface
                                    ? "text-white/80 hover:bg-white/8 hover:text-white"
                                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                                }`,
                                closeMobileMenus,
                              )}
                              {group.items?.length ? (
                                <button
                                  type="button"
                                  onClick={() => toggleMobileDropdown(group.label)}
                                  className={`rounded-lg px-3 py-2 text-sm transition ${
                                    isMarketingSurface
                                      ? "text-white/70 hover:bg-white/8 hover:text-white"
                                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                                  }`}
                                  aria-expanded={mobileDropdown === group.label}
                                >
                                  {mobileDropdown === group.label ? "−" : "+"}
                                </button>
                              ) : null}
                            </div>
                            {group.items?.length && mobileDropdown === group.label ? (
                              <div
                                className={`mt-2 rounded-xl border py-2 ${
                                  isMarketingSurface ? "border-white/10 bg-white/[0.03]" : "border-gray-200 bg-gray-50"
                                }`}
                              >
                                {group.items.map((item) => (
                                  <div key={`${group.label}-${item.label}`}>
                                    {renderNavLink(
                                      item,
                                      `block px-4 py-2 text-sm transition ${
                                        isMarketingSurface
                                          ? "text-white/72 hover:bg-white/8 hover:text-white"
                                          : "text-gray-600 hover:bg-white hover:text-gray-900"
                                      }`,
                                      closeMobileMenus,
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </nav>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-3">
              {isSignedIn ? (
                <>
                  {userLoaded && user ? (
                    <Link
                      to="/dashboard"
                      title={clerkNavDisplayName(user)}
                      aria-label="Go to dashboard"
                      className={`max-w-[10rem] truncate text-sm sm:max-w-[14rem] cursor-pointer rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 ${
                        isMarketingSurface
                          ? "text-white/85 hover:text-white focus-visible:ring-white/40 focus-visible:ring-offset-[#04050f]"
                          : "font-medium text-gray-900 hover:text-gray-700 focus-visible:ring-gray-400 focus-visible:ring-offset-white"
                      }`}
                    >
                      {clerkNavDisplayName(user)}
                    </Link>
                  ) : (
                    <span
                      className={`inline-block h-4 w-28 animate-pulse rounded ${
                        isMarketingSurface ? "bg-white/15" : "bg-gray-200"
                      }`}
                      aria-hidden
                    />
                  )}
                  <UserButton>
                    <UserButton.MenuItems>
                      <UserButton.Action
                        label="Dashboard"
                        labelIcon={<LayoutDashboard className="h-4 w-4" aria-hidden />}
                        onClick={() => navigate("/dashboard")}
                      />
                      <UserButton.Action label="manageAccount" />
                      <UserButton.Action label="signOut" />
                    </UserButton.MenuItems>
                  </UserButton>
                </>
              ) : (
                <>
                  <Link
                    to="/sign-in"
                    className={`hidden text-sm lg:inline ${isMarketingSurface ? "text-white/72 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/sign-up"
                    className={`hidden rounded-xl px-4 py-2 text-sm transition lg:inline-flex ${
                      isMarketingSurface
                        ? "border border-white/18 bg-white/10 text-white backdrop-blur-md hover:bg-white/18"
                        : "bg-gray-900 text-white hover:bg-gray-800"
                    }`}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className={`relative z-10 flex flex-1 flex-col ${isMarketingSurface ? "bg-transparent" : ""}`}>
        <Outlet />
      </main>
    </div>
  );
}
