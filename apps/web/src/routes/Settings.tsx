import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/react";
import { api } from "../lib/api";
import { useCurrentUser } from "../hooks/useCurrentUser";

function toDisplayTier(tier: "free" | "seeker" | "initiate") {
  if (tier === "free") return "Free Tier";
  if (tier === "initiate") return "Initiate";
  return "Seeker";
}

type MemberRecurringSubscription = {
  id: string;
  kind: "membership" | "regeneration";
  name: string;
  amountCents: number;
  currency: string;
  billingInterval: "monthly" | "annual";
  status: "active" | "cancelling" | "past_due" | "canceled";
  renewsOn: string | null;
  accessEndsOn: string | null;
  cancelAtPeriodEnd: boolean;
  cancelable: boolean;
  detail: string | null;
};

function formatSubscriptionPrice(amountCents: number, currency: string, billingInterval: "monthly" | "annual") {
  const amount = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(amountCents / 100);

  return `${amount} / ${billingInterval === "annual" ? "year" : "month"}`;
}

function formatSubscriptionDate(value: string | null) {
  if (!value) {
    return "TBD";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function statusBadgeClassName(status: MemberRecurringSubscription["status"]) {
  switch (status) {
    case "active":
      return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
    case "cancelling":
      return "border-amber-300/25 bg-amber-500/10 text-amber-100";
    case "past_due":
      return "border-rose-400/25 bg-rose-500/10 text-rose-100";
    case "canceled":
      return "border-white/15 bg-white/5 text-white/70";
  }
}

function statusLabel(status: MemberRecurringSubscription["status"]) {
  switch (status) {
    case "active":
      return "Active";
    case "cancelling":
      return "Cancelling";
    case "past_due":
      return "Past Due";
    case "canceled":
      return "Canceled";
  }
}

export default function Settings() {
  const { getToken } = useAuth();
  const { user, isLoading, tierState, refetch } = useCurrentUser();
  const [language, setLanguage] = useState("English");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [subscriptions, setSubscriptions] = useState<MemberRecurringSubscription[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(true);
  const [subscriptionsError, setSubscriptionsError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<MemberRecurringSubscription | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
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
    const remaining = Math.max(limit - used, 0);
    return `${remaining} of ${limit} prompts remaining`;
  }, [memberTier, user?.member?.capabilities.unlimitedChat, user?.member?.usage.limit, user?.member?.usage.used]);

  useEffect(() => {
    let cancelled = false;

    async function loadSubscriptions() {
      setSubscriptionsLoading(true);
      setSubscriptionsError(null);
      try {
        const token = await getToken();
        const response = await api.get("/member/subscriptions", token) as {
          data?: MemberRecurringSubscription[];
        };
        if (cancelled) {
          return;
        }
        setSubscriptions(response.data ?? []);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setSubscriptionsError(error instanceof Error ? error.message : "Subscriptions could not be loaded.");
      } finally {
        if (!cancelled) {
          setSubscriptionsLoading(false);
        }
      }
    }

    void loadSubscriptions();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => subscription.status !== "canceled"),
    [subscriptions],
  );

  const inputClassName =
    "mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus:border-accent-cyan/50 focus:outline-none focus:ring-1 focus:ring-accent-cyan/30";

  async function handleConfirmCancellation() {
    if (!cancelTarget) {
      return;
    }

    setCancelingId(cancelTarget.id);
    setSubscriptionsError(null);
    try {
      const token = await getToken();
      await api.post(
        `/member/subscriptions/${cancelTarget.kind}/${cancelTarget.id}/cancel`,
        {},
        token,
      );
      const refreshed = await api.get("/member/subscriptions", token) as {
        data?: MemberRecurringSubscription[];
      };
      setSubscriptions(refreshed.data ?? []);
      refetch();
      setCancelTarget(null);
    } catch (error) {
      setSubscriptionsError(error instanceof Error ? error.message : "Subscription could not be canceled.");
    } finally {
      setCancelingId(null);
    }
  }

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
          <h2 className="text-lg font-medium text-white">Subscriptions</h2>

          {subscriptionsLoading ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
              Loading subscriptions...
            </div>
          ) : null}

          {subscriptionsError ? (
            <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
              {subscriptionsError}
            </div>
          ) : null}

          {!subscriptionsLoading && !subscriptionsError ? (
            <div className="mt-4">
              {activeSubscriptions.length === 0 ? (
                <p className="text-sm text-white/65">No active subscriptions.</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">Active Subscriptions</p>
                  <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/5">
                    {activeSubscriptions.map((subscription) => (
                      <div key={`${subscription.kind}-${subscription.id}`} className="space-y-3 px-4 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-medium text-white">{subscription.name}</h3>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClassName(subscription.status)}`}>
                                {statusLabel(subscription.status)}
                              </span>
                            </div>
                            {subscription.detail ? (
                              <p className="mt-1 text-xs text-white/45">{subscription.detail}</p>
                            ) : null}
                          </div>

                          {subscription.cancelable ? (
                            <button
                              type="button"
                              onClick={() => setCancelTarget(subscription)}
                              className="inline-flex rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
                            >
                              Cancel Subscription
                            </button>
                          ) : null}
                        </div>

                        <div className="space-y-1 text-sm text-white/70">
                          <p className="text-white">{formatSubscriptionPrice(subscription.amountCents, subscription.currency, subscription.billingInterval)}</p>
                          {subscription.status === "active" ? (
                            <p>
                              Renews on: <span className="text-white">{formatSubscriptionDate(subscription.renewsOn)}</span>
                            </p>
                          ) : null}
                          {subscription.status === "cancelling" ? (
                            <p>
                              Access remains active until:{" "}
                              <span className="text-white">{formatSubscriptionDate(subscription.accessEndsOn)}</span>
                            </p>
                          ) : null}
                          {subscription.status === "past_due" ? (
                            <p>
                              Renewal date: <span className="text-white">{formatSubscriptionDate(subscription.renewsOn || subscription.accessEndsOn)}</span>
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
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

      {cancelTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111326] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            <h3 className="text-lg font-medium text-white">Cancel Subscription</h3>
            <p className="mt-3 text-sm leading-7 text-white/70">
              Cancel <span className="text-white">{cancelTarget.name}</span>? Your access will remain active until the
              end of the current billing period, and Stripe will stop the next renewal.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={Boolean(cancelingId)}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Keep Subscription
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmCancellation()}
                disabled={cancelingId === cancelTarget.id}
                className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelingId === cancelTarget.id ? "Canceling..." : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
