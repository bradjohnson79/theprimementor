import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MEMBER_PRICING, annualSavingsLabel, divin8ReportTierListPrice } from "@wisdom/utils";
import Card from "../components/Card";
import { useAdminSettings } from "../context/AdminSettingsContext";

type ServiceSection = "sessions" | "reports" | "subscriptions";

interface ServiceItem {
  id: string;
  title: string;
  price: string;
  tag: string;
  description: string;
  features: string[];
}

const sectionTabs: Array<{ id: ServiceSection; label: string; eyebrow: string }> = [
  { id: "sessions", label: "Personal Sessions", eyebrow: "Live and offline experiences" },
  { id: "reports", label: "Reports", eyebrow: "Structured Divin8 offerings" },
  { id: "subscriptions", label: "Subscriptions", eyebrow: "Access and continuity layers" },
];

const serviceGroups: Record<ServiceSection, ServiceItem[]> = {
  sessions: [
    {
      id: "prime-mentor-session",
      title: "Prime Mentor Session",
      price: "$299 CAD",
      tag: "1:1 Experience",
      description:
        "In-depth mentoring session with pre-screening intake designed to focus the live Zoom experience before the call begins.",
      features: [
        "90 minute live Zoom session",
        "Birth data collection",
        "Goal setting",
        "Blockage identification",
        "Manifestation mindset guidance",
      ],
    },
    {
      id: "offline-regeneration-session",
      title: "Offline Regeneration Session",
      price: "$129 CAD",
      tag: "Energy Work",
      description:
        "Offline regenerative session using deep-state Theta and Delta frequency work to support reset, clarity, and nervous-system restoration.",
      features: [
        "Pre-screening intake",
        "Up to 3 focus areas",
        "Personalized clarity glyph",
        "MP3 7-day regeneration plan",
        "7 days email support",
      ],
    },
  ],
  reports: [
    {
      id: "divin8-introductory-report",
      title: "Divin8 Introductory Report",
      price: divin8ReportTierListPrice("intro"),
      tag: "Entry Level",
      description:
        "A lighter entry point into the Divin8 system for first-time clients who want orientation, patterns, and a clean starting read.",
      features: [
        "Overview of core energetic themes",
        "Beginner-friendly interpretation",
        "Structured written delivery",
        "Future-ready for checkout and download flow",
      ],
    },
    {
      id: "divin8-deep-dive-report",
      title: "Divin8 Deep Dive Report",
      price: divin8ReportTierListPrice("deep_dive"),
      tag: "Advanced",
      description:
        "Expanded multi-system interpretation for clients ready to go beyond the entry read and explore practical depth.",
      features: [
        "Broader Divin8 synthesis",
        "Deeper pattern interpretation",
        "Designed for premium report delivery",
        "Ready for future regeneration and upsell paths",
      ],
    },
    {
      id: "divin8-initiates-report",
      title: "Divin8 Initiate's Report",
      price: divin8ReportTierListPrice("initiate"),
      tag: "Full Synthesis",
      description:
        "The most complete report layer, intended for high-context clients who want a full synthesis reading and long-form guidance.",
      features: [
        "Full-system synthesis",
        "Long-form interpretive structure",
        "Ready for future glyph and premium fulfillment layers",
        "Designed for member-dashboard access later",
      ],
    },
  ],
  subscriptions: [
    {
      id: "free-member-dashboard",
      title: "Free Member Dashboard",
      price: "Free",
      tag: "Starter Access",
      description:
        "Lightweight dashboard access so members can return to saved sessions, reports, and future portal experiences.",
      features: [
        "Access saved sessions",
        "Access saved reports",
        "Future-ready member profile foundation",
      ],
    },
    {
      id: "seeker-subscription",
      title: "Seeker Subscription",
      price: `${MEMBER_PRICING.seeker.monthly.label} · ${MEMBER_PRICING.seeker.annual.label}`,
      tag: "Most Popular",
      description:
        "Balanced recurring access for members who want consistent Divin8 support without unlocking the full Initiate layer.",
      features: [
        "150 prompts per month",
        "Divin8 Chat access",
        `Annual plan ${annualSavingsLabel("seeker").toLowerCase()}`,
      ],
    },
    {
      id: "initiate-subscription",
      title: "Initiate Subscription",
      price: `${MEMBER_PRICING.initiate.monthly.label} · ${MEMBER_PRICING.initiate.annual.label}`,
      tag: "Full Access",
      description:
        "Full recurring access tier built to support deeper usage, broader system entry points, and future premium member experiences.",
      features: [
        "Unlimited Divin8 prompts",
        "Includes monthly Mentor Circle",
        "Full Divin8 system access",
        `Annual plan ${annualSavingsLabel("initiate").toLowerCase()}`,
      ],
    },
  ],
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function Services() {
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const [activeSection, setActiveSection] = useState<ServiceSection>("sessions");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(() =>
    Object.values(serviceGroups)
      .flat()
      .reduce<Record<string, boolean>>((accumulator, item) => {
        accumulator[item.id] = true;
        return accumulator;
      }, {}),
  );

  const currentItems = useMemo(() => serviceGroups[activeSection], [activeSection]);

  const containerClass = isLightTheme ? "text-slate-900" : "text-white";
  const mutedClass = isLightTheme ? "text-slate-500" : "text-white/60";
  const subtleBorder = isLightTheme ? "border-slate-200" : "border-glass-border";
  const subtleSurface = isLightTheme ? "bg-slate-50" : "bg-white/5";
  const buttonSecondary = classNames(
    "rounded-lg border px-3 py-2 text-sm transition",
    isLightTheme
      ? "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      : "border-glass-border text-white/80 hover:border-white/40 hover:text-white",
  );

  function handlePlaceholderAction(item: ServiceItem, action: "view" | "edit") {
    const label = action === "view" ? "View Details" : "Edit";
    setStatusMessage(`${label} is staged for ${item.title}. Wiring comes in the future booking and checkout pass.`);
  }

  function handleToggle(item: ServiceItem) {
    setEnabledMap((current) => {
      const nextEnabled = !current[item.id];
      setStatusMessage(`${item.title} is now ${nextEnabled ? "enabled" : "disabled"} in the admin showcase.`);
      return { ...current, [item.id]: nextEnabled };
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={classNames("space-y-6", containerClass)}
    >
      <div>
        <h2 className="text-2xl font-bold">Services</h2>
        <p className={classNames("mt-1 max-w-3xl", mutedClass)}>
          Structural catalog for sessions, reports, and recurring access plans. This pass is UI-only
          and keeps the surface ready for future bookings, Stripe, intake forms, and fulfillment flows.
        </p>
      </div>

      {statusMessage ? (
        <div
          className={classNames(
            "rounded-xl border px-4 py-3 text-sm",
            isLightTheme
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
          )}
        >
          {statusMessage}
        </div>
      ) : null}

      <Card className={isLightTheme ? "!bg-white !shadow-[0_14px_34px_rgba(15,23,42,0.08)]" : ""}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-accent-cyan">Offer Structure</p>
            <h3 className="mt-2 text-xl font-semibold">Ready for product, booking, and member growth</h3>
            <p className={classNames("mt-2 max-w-2xl text-sm", mutedClass)}>
              Services are grouped into clear offering lanes so future pricing, checkout, and delivery
              logic can attach without reworking the admin information architecture.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={classNames("rounded-xl border px-4 py-3", subtleBorder, subtleSurface)}>
              <p className={classNames("text-xs uppercase tracking-[0.18em]", mutedClass)}>Sessions</p>
              <p className="mt-2 text-2xl font-semibold text-accent-cyan">{serviceGroups.sessions.length}</p>
            </div>
            <div className={classNames("rounded-xl border px-4 py-3", subtleBorder, subtleSurface)}>
              <p className={classNames("text-xs uppercase tracking-[0.18em]", mutedClass)}>Reports</p>
              <p className="mt-2 text-2xl font-semibold text-accent-violet">{serviceGroups.reports.length}</p>
            </div>
            <div className={classNames("rounded-xl border px-4 py-3", subtleBorder, subtleSurface)}>
              <p className={classNames("text-xs uppercase tracking-[0.18em]", mutedClass)}>Subscriptions</p>
              <p className="mt-2 text-2xl font-semibold text-accent-teal">{serviceGroups.subscriptions.length}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className={isLightTheme ? "!bg-white !shadow-[0_14px_34px_rgba(15,23,42,0.08)]" : ""}>
        <div className="flex flex-wrap gap-3">
          {sectionTabs.map((section) => {
            const active = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={classNames(
                  "rounded-xl border px-4 py-3 text-left transition",
                  active
                    ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                    : isLightTheme
                      ? "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      : "border-glass-border bg-white/5 text-white/70 hover:border-white/30 hover:text-white",
                )}
              >
                <p className="text-sm font-semibold">{section.label}</p>
                <p className={classNames("mt-1 text-xs", active ? "text-accent-cyan/80" : mutedClass)}>
                  {section.eyebrow}
                </p>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {currentItems.map((item) => {
          const isEnabled = enabledMap[item.id];
          return (
            <Card
              key={item.id}
              className={isLightTheme ? "!bg-white !shadow-[0_14px_34px_rgba(15,23,42,0.08)]" : ""}
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-accent-cyan/10 px-3 py-1 text-xs font-semibold text-accent-cyan">
                        {item.tag}
                      </span>
                      <span
                        className={classNames(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          isEnabled
                            ? isLightTheme
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-emerald-500/10 text-emerald-200"
                            : isLightTheme
                              ? "bg-slate-100 text-slate-500"
                              : "bg-white/10 text-white/45",
                        )}
                      >
                        {isEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
                    <p className={classNames("mt-2 text-sm", mutedClass)}>{item.description}</p>
                  </div>
                  <div className="md:text-right">
                    <p className={classNames("text-xs uppercase tracking-[0.18em]", mutedClass)}>Price</p>
                    <p className="mt-2 text-2xl font-bold">{item.price}</p>
                  </div>
                </div>

                <div className={classNames("rounded-2xl border p-4", subtleBorder, subtleSurface)}>
                  <p className="text-sm font-semibold">Included</p>
                  <ul className={classNames("mt-3 space-y-2 text-sm", mutedClass)}>
                    {item.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <span className="text-accent-cyan">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={buttonSecondary}
                    onClick={() => handlePlaceholderAction(item, "view")}
                  >
                    View Details
                  </button>
                  <button
                    type="button"
                    className={buttonSecondary}
                    onClick={() => handlePlaceholderAction(item, "edit")}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-accent-cyan px-3 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
                    onClick={() => handleToggle(item)}
                  >
                    {isEnabled ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </motion.div>
  );
}
