import { useAuth } from "@clerk/react";
import { useEffect, useMemo, useState } from "react";
import { useAdminSettings } from "../context/AdminSettingsContext";
import { api } from "../lib/api";

type AnalyticsRange = "24h" | "7d" | "30d";
type AnalyticsStatus = "ok" | "degraded";
type TrendDirection = "up" | "down" | "neutral";

interface TrendMetric {
  current: number;
  previous: number;
  delta: number;
  deltaLabel: string;
  direction: TrendDirection;
}

interface SummaryResponse {
  range: AnalyticsRange;
  status: AnalyticsStatus;
  warning?: string;
  traffic: {
    visitors: number;
    pageviews: number;
    sessions: number;
    bounces: number;
    totalTimeSeconds: number;
    averageSessionSeconds: number;
    activeVisitors: number;
  };
  trends: {
    visitors: TrendMetric;
    pageviews: TrendMetric;
    sessions: TrendMetric;
  };
  umami: {
    websiteId: string;
    dashboardUrl: string;
    connected: boolean;
  };
}

interface PageviewsResponse {
  range: AnalyticsRange;
  status: AnalyticsStatus;
  warning?: string;
  series: {
    pageviews: Array<{ timestamp: string; value: number }>;
    sessions: Array<{ timestamp: string; value: number }>;
  };
  topPages: Array<{
    path: string;
    visitors: number;
    pageviews: number;
    visits: number;
    bounceRate: number;
  }>;
}

interface EventsResponse {
  range: AnalyticsRange;
  status: AnalyticsStatus;
  warning?: string;
  totals: {
    events: number;
    visitors: number;
    visits: number;
    uniqueEvents: number;
    comparison: {
      events: number;
      visitors: number;
      visits: number;
      uniqueEvents: number;
    };
  };
  items: Array<{
    name: string;
    total: number;
    share: number;
  }>;
  series: Array<{
    name: string;
    timestamp: string;
    value: number;
  }>;
  recent: Array<{
    id: string;
    eventName: string;
    createdAt: string;
    path: string;
    title: string;
    referrer: string;
  }>;
}

interface ReferrersResponse {
  range: AnalyticsRange;
  status: AnalyticsStatus;
  warning?: string;
  items: Array<{
    referrer: string;
    visitors: number;
    pageviews: number;
    visits: number;
    share: number;
  }>;
}

interface OverviewResponse {
  range: AnalyticsRange;
  status: AnalyticsStatus;
  businessMetrics: {
    revenue: {
      currency: string;
      value: number;
      trend: TrendMetric;
    };
    orders: {
      value: number;
      trend: TrendMetric;
    };
    activeSubscriptions: {
      value: number;
      trend: TrendMetric;
    };
    sessionsBooked: {
      value: number;
      trend: TrendMetric;
    };
  };
  recentActivity: Array<{
    id: string;
    kind: "purchase" | "booking" | "signup";
    title: string;
    detail: string;
    createdAt: string;
  }>;
  conversionInsights: {
    ordersToday: number;
    ordersThisWeek: number;
    revenueThisMonth: number;
    totalUsers: number;
    totalClients: number;
  };
}

interface AnalyticsDashboardState {
  summary: SummaryResponse;
  pageviews: PageviewsResponse;
  events: EventsResponse;
  referrers: ReferrersResponse;
  overview: OverviewResponse;
}

const RANGE_OPTIONS: Array<{ id: AnalyticsRange; label: string }> = [
  { id: "24h", label: "Last 24 hours" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
];

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-CA").format(value);
}

function formatMoney(value: number, currency = "CAD") {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function formatDate(value: string) {
  if (!value) {
    return "Just now";
  }
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function MetricSkeleton({ isLightTheme }: { isLightTheme: boolean }) {
  return (
    <div
      className={classNames(
        "animate-pulse rounded-2xl border p-5",
        isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-white/5",
      )}
    >
      <div className="h-3 w-24 rounded bg-white/10" />
      <div className="mt-4 h-8 w-28 rounded bg-white/10" />
      <div className="mt-4 h-3 w-32 rounded bg-white/10" />
    </div>
  );
}

function SectionCard({
  title,
  eyebrow,
  isLightTheme,
  children,
  action,
}: {
  title: string;
  eyebrow?: string;
  isLightTheme: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={classNames(
        "rounded-3xl border p-6 shadow-sm backdrop-blur-sm",
        isLightTheme
          ? "border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
          : "border-white/10 bg-white/5 shadow-[0_16px_40px_rgba(2,6,23,0.24)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">{eyebrow}</p> : null}
          <h2 className={classNames("mt-2 text-xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function TrendPill({ metric, isLightTheme }: { metric: TrendMetric; isLightTheme: boolean }) {
  const tone = metric.direction === "up"
    ? isLightTheme
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
    : metric.direction === "down"
      ? isLightTheme
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-rose-400/30 bg-rose-400/10 text-rose-200"
      : isLightTheme
        ? "border-slate-200 bg-slate-50 text-slate-600"
        : "border-white/10 bg-white/5 text-white/65";

  return (
    <span className={classNames("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", tone)}>
      {metric.deltaLabel}
    </span>
  );
}

export default function Analytics() {
  const { getToken } = useAuth();
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const [range, setRange] = useState<AnalyticsRange>("7d");
  const [data, setData] = useState<AnalyticsDashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const query = `?range=${encodeURIComponent(range)}`;
        const [summary, pageviews, events, referrers, overview] = await Promise.all([
          api.get(`/admin/analytics/summary${query}`, token) as Promise<{ data: SummaryResponse }>,
          api.get(`/admin/analytics/pageviews${query}`, token) as Promise<{ data: PageviewsResponse }>,
          api.get(`/admin/analytics/events${query}`, token) as Promise<{ data: EventsResponse }>,
          api.get(`/admin/analytics/referrers${query}`, token) as Promise<{ data: ReferrersResponse }>,
          api.get(`/admin/analytics/overview${query}`, token) as Promise<{ data: OverviewResponse }>,
        ]);

        if (!cancelled) {
          setData({
            summary: summary.data,
            pageviews: pageviews.data,
            events: events.data,
            referrers: referrers.data,
            overview: overview.data,
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load analytics.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [getToken, range]);

  const warnings = useMemo(() => {
    if (!data) {
      return [];
    }
    return [
      data.summary.warning,
      data.pageviews.warning,
      data.events.warning,
      data.referrers.warning,
    ].filter((value): value is string => Boolean(value));
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent-cyan">Business Intelligence</p>
          <h1 className={classNames("mt-2 text-3xl font-semibold tracking-tight", isLightTheme ? "text-slate-900" : "text-white")}>
            Analytics
          </h1>
          <p className={classNames("mt-3 max-w-3xl text-sm leading-6", isLightTheme ? "text-slate-600" : "text-white/65")}>
            Unified traffic, behavior, conversion, and business performance for Prime Mentor. Umami powers the web
            analytics layer, while internal data keeps orders, subscriptions, and bookings anchored to the database.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setRange(option.id)}
              className={classNames(
                "rounded-full border px-4 py-2 text-sm transition",
                range === option.id
                  ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                  : isLightTheme
                    ? "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                    : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {warnings.length > 0 ? (
        <div
          className={classNames(
            "rounded-2xl border px-4 py-3 text-sm",
            isLightTheme ? "border-amber-200 bg-amber-50 text-amber-800" : "border-amber-400/25 bg-amber-400/10 text-amber-100",
          )}
        >
          Umami is in degraded mode for part of this dashboard. Traffic cards are still safe to view, but short-term pageview
          discrepancies can happen during the Wix to Cloudflare transition or brief upstream API issues.
        </div>
      ) : null}

      {error ? (
        <div
          className={classNames(
            "rounded-2xl border px-4 py-3 text-sm",
            isLightTheme ? "border-rose-200 bg-rose-50 text-rose-700" : "border-rose-400/25 bg-rose-400/10 text-rose-100",
          )}
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4">
        {loading || !data ? (
          Array.from({ length: 4 }).map((_, index) => <MetricSkeleton key={`traffic-skeleton-${index}`} isLightTheme={isLightTheme} />)
        ) : (
          <>
            <SectionCard title="Visitors" eyebrow="Traffic Overview" isLightTheme={isLightTheme}>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className={classNames("text-3xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>
                    {formatNumber(data.summary.traffic.visitors)}
                  </p>
                  <p className={classNames("mt-2 text-sm", isLightTheme ? "text-slate-500" : "text-white/55")}>
                    Active now: {formatNumber(data.summary.traffic.activeVisitors)}
                  </p>
                </div>
                <TrendPill metric={data.summary.trends.visitors} isLightTheme={isLightTheme} />
              </div>
            </SectionCard>
            <SectionCard title="Pageviews" eyebrow="Traffic Overview" isLightTheme={isLightTheme}>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className={classNames("text-3xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>
                    {formatNumber(data.summary.traffic.pageviews)}
                  </p>
                  <p className={classNames("mt-2 text-sm", isLightTheme ? "text-slate-500" : "text-white/55")}>
                    Bounce count: {formatNumber(data.summary.traffic.bounces)}
                  </p>
                </div>
                <TrendPill metric={data.summary.trends.pageviews} isLightTheme={isLightTheme} />
              </div>
            </SectionCard>
            <SectionCard title="Sessions" eyebrow="Traffic Overview" isLightTheme={isLightTheme}>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className={classNames("text-3xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>
                    {formatNumber(data.summary.traffic.sessions)}
                  </p>
                  <p className={classNames("mt-2 text-sm", isLightTheme ? "text-slate-500" : "text-white/55")}>
                    Avg. session time: {formatSeconds(data.summary.traffic.averageSessionSeconds)}
                  </p>
                </div>
                <TrendPill metric={data.summary.trends.sessions} isLightTheme={isLightTheme} />
              </div>
            </SectionCard>
            <SectionCard
              title="Umami Connection"
              eyebrow="Source Health"
              isLightTheme={isLightTheme}
              action={(
                <a
                  href={data.summary.umami.dashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={classNames(
                    "rounded-full border px-3 py-2 text-xs font-medium transition",
                    isLightTheme
                      ? "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white",
                  )}
                >
                  Open Umami Dashboard
                </a>
              )}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span
                    className={classNames(
                      "inline-flex h-2.5 w-2.5 rounded-full",
                      data.summary.umami.connected ? "bg-emerald-400" : "bg-amber-300",
                    )}
                  />
                  <p className={classNames("text-sm font-medium", isLightTheme ? "text-slate-800" : "text-white")}>
                    {data.summary.umami.connected ? "Connected" : "Degraded"}
                  </p>
                </div>
                <p className={classNames("text-sm", isLightTheme ? "text-slate-600" : "text-white/60")}>
                  Website ID: {data.summary.umami.websiteId || "Not configured"}
                </p>
              </div>
            </SectionCard>
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {loading || !data ? (
          Array.from({ length: 4 }).map((_, index) => <MetricSkeleton key={`business-skeleton-${index}`} isLightTheme={isLightTheme} />)
        ) : (
          <>
            <SectionCard title="Revenue" eyebrow="Business Metrics" isLightTheme={isLightTheme}>
              <p className={classNames("text-3xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>
                {formatMoney(data.overview.businessMetrics.revenue.value, data.overview.businessMetrics.revenue.currency)}
              </p>
              <div className="mt-4">
                <TrendPill metric={data.overview.businessMetrics.revenue.trend} isLightTheme={isLightTheme} />
              </div>
            </SectionCard>
            <SectionCard title="Orders" eyebrow="Business Metrics" isLightTheme={isLightTheme}>
              <p className={classNames("text-3xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>
                {formatNumber(data.overview.businessMetrics.orders.value)}
              </p>
              <div className="mt-4">
                <TrendPill metric={data.overview.businessMetrics.orders.trend} isLightTheme={isLightTheme} />
              </div>
            </SectionCard>
            <SectionCard title="Active Subscriptions" eyebrow="Business Metrics" isLightTheme={isLightTheme}>
              <p className={classNames("text-3xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>
                {formatNumber(data.overview.businessMetrics.activeSubscriptions.value)}
              </p>
              <div className="mt-4">
                <TrendPill metric={data.overview.businessMetrics.activeSubscriptions.trend} isLightTheme={isLightTheme} />
              </div>
            </SectionCard>
            <SectionCard title="Sessions Booked" eyebrow="Business Metrics" isLightTheme={isLightTheme}>
              <p className={classNames("text-3xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>
                {formatNumber(data.overview.businessMetrics.sessionsBooked.value)}
              </p>
              <div className="mt-4">
                <TrendPill metric={data.overview.businessMetrics.sessionsBooked.trend} isLightTheme={isLightTheme} />
              </div>
            </SectionCard>
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
        <SectionCard title="Top Pages" eyebrow="Traffic Detail" isLightTheme={isLightTheme}>
          {loading || !data ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`pages-loading-${index}`} className="h-14 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : data.pageviews.topPages.length === 0 ? (
            <p className={classNames("text-sm", isLightTheme ? "text-slate-500" : "text-white/60")}>
              No pageview data available yet.
            </p>
          ) : (
            <div className="space-y-3">
              {data.pageviews.topPages.map((page) => (
                <div
                  key={page.path}
                  className={classNames(
                    "rounded-2xl border px-4 py-3",
                    isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className={classNames("font-medium", isLightTheme ? "text-slate-900" : "text-white")}>{page.path || "/"}</p>
                      <p className={classNames("mt-1 text-xs", isLightTheme ? "text-slate-500" : "text-white/50")}>
                        {formatNumber(page.pageviews)} pageviews · {formatNumber(page.visitors)} visitors
                      </p>
                    </div>
                    <span className={classNames("text-xs font-medium", isLightTheme ? "text-slate-600" : "text-white/70")}>
                      {page.bounceRate}% bounce rate
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Referrers" eyebrow="Traffic Detail" isLightTheme={isLightTheme}>
          {loading || !data ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`referrers-loading-${index}`} className="h-14 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : data.referrers.items.length === 0 ? (
            <p className={classNames("text-sm", isLightTheme ? "text-slate-500" : "text-white/60")}>
              No referrer data available yet.
            </p>
          ) : (
            <div className="space-y-3">
              {data.referrers.items.map((row) => (
                <div
                  key={row.referrer}
                  className={classNames(
                    "rounded-2xl border px-4 py-3",
                    isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={classNames("font-medium", isLightTheme ? "text-slate-900" : "text-white")}>{row.referrer}</p>
                      <p className={classNames("mt-1 text-xs", isLightTheme ? "text-slate-500" : "text-white/50")}>
                        {formatNumber(row.visitors)} visitors · {formatNumber(row.pageviews)} pageviews
                      </p>
                    </div>
                    <span className={classNames("text-xs font-medium", isLightTheme ? "text-slate-600" : "text-white/70")}>
                      {row.share}% share
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Event Tracking" eyebrow="Behavior" isLightTheme={isLightTheme}>
          {loading || !data ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`events-loading-${index}`} className="h-14 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
                  <p className="text-xs uppercase tracking-wide text-accent-cyan">Events</p>
                  <p className={classNames("mt-2 text-2xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>
                    {formatNumber(data.events.totals.events)}
                  </p>
                </div>
                <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
                  <p className="text-xs uppercase tracking-wide text-accent-cyan">Visitors</p>
                  <p className={classNames("mt-2 text-2xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>
                    {formatNumber(data.events.totals.visitors)}
                  </p>
                </div>
                <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
                  <p className="text-xs uppercase tracking-wide text-accent-cyan">Visits</p>
                  <p className={classNames("mt-2 text-2xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>
                    {formatNumber(data.events.totals.visits)}
                  </p>
                </div>
                <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
                  <p className="text-xs uppercase tracking-wide text-accent-cyan">Unique</p>
                  <p className={classNames("mt-2 text-2xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>
                    {formatNumber(data.events.totals.uniqueEvents)}
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {data.events.items.map((item) => (
                  <div
                    key={item.name}
                    className={classNames(
                      "rounded-2xl border px-4 py-3",
                      isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className={classNames("font-medium", isLightTheme ? "text-slate-900" : "text-white")}>{item.name}</p>
                        <p className={classNames("mt-1 text-xs", isLightTheme ? "text-slate-500" : "text-white/50")}>
                          {formatNumber(item.total)} tracked events
                        </p>
                      </div>
                      <span className={classNames("text-xs font-medium", isLightTheme ? "text-slate-600" : "text-white/70")}>
                        {item.share}% share
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard title="Recent Activity" eyebrow="Internal Signals" isLightTheme={isLightTheme}>
          {loading || !data ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`activity-loading-${index}`} className="h-14 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {data.overview.recentActivity.map((item) => (
                <div
                  key={item.id}
                  className={classNames(
                    "rounded-2xl border px-4 py-3",
                    isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={classNames("font-medium", isLightTheme ? "text-slate-900" : "text-white")}>{item.title}</p>
                      <p className={classNames("mt-1 text-sm", isLightTheme ? "text-slate-600" : "text-white/60")}>{item.detail}</p>
                    </div>
                    <span className={classNames("text-xs", isLightTheme ? "text-slate-500" : "text-white/45")}>
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Conversion Insights" eyebrow="Snapshot" isLightTheme={isLightTheme}>
        {loading || !data ? (
          <div className="grid gap-4 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`insight-loading-${index}`} className="h-24 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-5">
            <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
              <p className="text-xs uppercase tracking-wide text-accent-cyan">Orders Today</p>
              <p className={classNames("mt-2 text-2xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>
                {formatNumber(data.overview.conversionInsights.ordersToday)}
              </p>
            </div>
            <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
              <p className="text-xs uppercase tracking-wide text-accent-cyan">Orders This Week</p>
              <p className={classNames("mt-2 text-2xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>
                {formatNumber(data.overview.conversionInsights.ordersThisWeek)}
              </p>
            </div>
            <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
              <p className="text-xs uppercase tracking-wide text-accent-cyan">Revenue This Month</p>
              <p className={classNames("mt-2 text-2xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>
                {formatMoney(data.overview.conversionInsights.revenueThisMonth)}
              </p>
            </div>
            <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
              <p className="text-xs uppercase tracking-wide text-accent-cyan">Total Users</p>
              <p className={classNames("mt-2 text-2xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>
                {formatNumber(data.overview.conversionInsights.totalUsers)}
              </p>
            </div>
            <div className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
              <p className="text-xs uppercase tracking-wide text-accent-cyan">Client Records</p>
              <p className={classNames("mt-2 text-2xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>
                {formatNumber(data.overview.conversionInsights.totalClients)}
              </p>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
