import { useState } from "react";
import { motion } from "framer-motion";
import Card from "../components/Card";
import { useAdminSettings } from "../context/AdminSettingsContext";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function Events() {
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const [isEnabled, setIsEnabled] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const containerClass = isLightTheme ? "text-slate-900" : "text-white";
  const mutedClass = isLightTheme ? "text-slate-500" : "text-white/60";
  const subtleBorder = isLightTheme ? "border-slate-200" : "border-glass-border";
  const subtleSurface = isLightTheme ? "bg-slate-50" : "bg-white/5";
  const secondaryButtonClass = classNames(
    "rounded-lg border px-3 py-2 text-sm transition",
    isLightTheme
      ? "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      : "border-glass-border text-white/80 hover:border-white/40 hover:text-white",
  );

  function handlePlaceholderAction(action: "view" | "edit") {
    const label = action === "view" ? "View Details" : "Edit";
    setStatusMessage(`${label} is staged for Prime Mentor Circle Monthly Webinar. Registration and Zoom wiring come in a later pass.`);
  }

  function handleToggle() {
    setIsEnabled((current) => {
      const nextValue = !current;
      setStatusMessage(`Prime Mentor Circle Monthly Webinar is now ${nextValue ? "enabled" : "disabled"} in the admin events catalog.`);
      return nextValue;
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
        <h2 className="text-2xl font-bold">Events</h2>
        <p className={classNames("mt-1 max-w-3xl", mutedClass)}>
          Recurring event structure for future registration, scheduling, Zoom delivery, and replay
          distribution. This pass is presentation-only and keeps the event layer ready for expansion.
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
        <div className="grid gap-6 xl:grid-cols-[1.3fr,0.7fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-accent-violet/15 px-3 py-1 text-xs font-semibold text-accent-violet">
                Upcoming Session
              </span>
              <span className="rounded-full bg-accent-cyan/10 px-3 py-1 text-xs font-semibold text-accent-cyan">
                Monthly Recurring Event
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

            <div>
              <h3 className="text-3xl font-bold">Prime Mentor Circle Monthly Webinar</h3>
              <p className="mt-3 text-lg font-semibold text-accent-cyan">$25 CAD per person</p>
              <p className={classNames("mt-4 max-w-3xl text-sm leading-7", mutedClass)}>
                A full-circle knowledge webinar combining deep mentoring teachings, guided insight work,
                and interactive Divin8 breakdowns with attendees in a live group setting.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className={classNames("rounded-2xl border p-4", subtleBorder, subtleSurface)}>
                <p className={classNames("text-xs uppercase tracking-[0.18em]", mutedClass)}>Schedule</p>
                <p className="mt-2 text-base font-semibold">Last Sunday monthly</p>
              </div>
              <div className={classNames("rounded-2xl border p-4", subtleBorder, subtleSurface)}>
                <p className={classNames("text-xs uppercase tracking-[0.18em]", mutedClass)}>Pacific</p>
                <p className="mt-2 text-base font-semibold">9:00 AM</p>
              </div>
              <div className={classNames("rounded-2xl border p-4", subtleBorder, subtleSurface)}>
                <p className={classNames("text-xs uppercase tracking-[0.18em]", mutedClass)}>Eastern</p>
                <p className="mt-2 text-base font-semibold">12:00 PM</p>
              </div>
              <div className={classNames("rounded-2xl border p-4", subtleBorder, subtleSurface)}>
                <p className={classNames("text-xs uppercase tracking-[0.18em]", mutedClass)}>Duration</p>
                <p className="mt-2 text-base font-semibold">2.5 to 3 hours</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => handlePlaceholderAction("view")}
              >
                View Details
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => handlePlaceholderAction("edit")}
              >
                Edit
              </button>
              <button
                type="button"
                className="rounded-lg bg-accent-cyan px-3 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
                onClick={handleToggle}
              >
                {isEnabled ? "Disable" : "Enable"}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className={classNames("rounded-2xl border p-5", subtleBorder, subtleSurface)}>
              <p className="text-sm font-semibold">Included Experience</p>
              <ul className={classNames("mt-4 space-y-2 text-sm", mutedClass)}>
                <li className="flex gap-2">
                  <span className="text-accent-cyan">•</span>
                  <span>Live Zoom session</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-cyan">•</span>
                  <span>Group interaction</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-cyan">•</span>
                  <span>Teaching plus applied insight</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent-cyan">•</span>
                  <span>Recording available after session</span>
                </li>
              </ul>
            </div>

            <div className={classNames("rounded-2xl border p-5", subtleBorder, subtleSurface)}>
              <p className="text-sm font-semibold">Access</p>
              <p className={classNames("mt-3 text-sm leading-7", mutedClass)}>
                Recording available in member dashboard for all tiers.
              </p>
            </div>

            <div className={classNames("rounded-2xl border p-5", subtleBorder, subtleSurface)}>
              <p className="text-sm font-semibold">Future Ready</p>
              <p className={classNames("mt-3 text-sm leading-7", mutedClass)}>
                This event surface is prepared for recurring scheduling logic, registrations, Zoom
                auto-link generation, and replay-library delivery once those systems are added.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
