import { useMemo, useState } from "react";
import { useCurrentUser } from "../hooks/useCurrentUser";

function toDisplayTier(tier: "free" | "seeker" | "initiate") {
  if (tier === "free") return "Free Tier";
  if (tier === "initiate") return "Initiate";
  return "Seeker";
}

export default function Settings() {
  const { user, isLoading, tierState } = useCurrentUser();
  const [language, setLanguage] = useState("English");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const memberTier = tierState;

  const usageLabel = useMemo(() => {
    if (memberTier === "loading") {
      return "Loading membership...";
    }
    if (memberTier === "free") {
      return "Upgrade to unlock Divin8 chat.";
    }
    if (user?.member?.capabilities.unlimitedChat) {
      return "Unlimited prompts available.";
    }
    const used = user?.member?.usage.used ?? 0;
    const limit = user?.member?.usage.limit ?? 150;
    return `${used} / ${limit} prompts used`;
  }, [memberTier, user?.member?.capabilities.unlimitedChat, user?.member?.usage.limit, user?.member?.usage.used]);

  const inputClassName =
    "mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus:border-accent-cyan/50 focus:outline-none focus:ring-1 focus:ring-accent-cyan/30";

  return (
    <div className="px-8 py-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="glass-card rounded-2xl p-8">
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
          <p className="mt-2 text-sm text-white/70">
            Keep your profile, preferences, and security details aligned with your practice.
          </p>
        </section>

        <section className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-medium text-white">Profile</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm text-white/70">
              Name
              <input
                className={inputClassName}
                value={isLoading ? "Loading..." : (user?.email?.split("@")[0] ?? "")}
                readOnly
              />
            </label>
            <label className="text-sm text-white/70">
              Email
              <input className={inputClassName} value={isLoading ? "Loading..." : (user?.email ?? "")} readOnly />
            </label>
          </div>
        </section>

        <section className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-medium text-white">Membership</h2>
          <div className="mt-4 space-y-2 text-sm text-white/70">
            <p>
              Current tier:{" "}
              <span className="text-white">
                {memberTier === "loading" ? "Loading..." : toDisplayTier(memberTier)}
              </span>
            </p>
            <p>
              Usage: <span className="text-white">{usageLabel}</span>
            </p>
          </div>
        </section>

        <section className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-medium text-white">Preferences</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-white/70">
              Language
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className={`${inputClassName} cursor-pointer`}
              >
                <option value="English" className="bg-slate-950">English</option>
                <option value="French" className="bg-slate-950">French</option>
                <option value="Spanish" className="bg-slate-950">Spanish</option>
              </select>
            </label>

            <div className="text-sm text-white/70">
              Notifications
              <button
                type="button"
                onClick={() => setNotificationsEnabled((current) => !current)}
                className="mt-1 inline-flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 transition hover:border-white/30 hover:bg-white/10"
              >
                <span>{notificationsEnabled ? "Enabled" : "Disabled"}</span>
                <span className="text-white/60">{notificationsEnabled ? "On" : "Off"}</span>
              </button>
            </div>
          </div>
        </section>

        <section className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-medium text-white">Security</h2>
          <button
            type="button"
            className="mt-4 rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:border-white/30 hover:bg-white/5 hover:text-white"
          >
            Change password
          </button>
        </section>
      </div>
    </div>
  );
}
