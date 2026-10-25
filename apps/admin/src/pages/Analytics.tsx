import { useAuth } from "@clerk/react";
import { useEffect, useMemo, useState } from "react";
import AnalyticsAccordion from "../components/analytics/AnalyticsAccordion";
import AnalyticsEmptyState from "../components/analytics/AnalyticsEmptyState";
import AnalyticsMetricList, { type AnalyticsMetricListItem } from "../components/analytics/AnalyticsMetricList";
import { analyticsHelperText, getConversionRouteLabel, utmEmptyState, utmExample } from "../components/analytics/analyticsCopy";
import { useAdminSettings } from "../context/AdminSettingsContext";
import { api } from "../lib/api";
import { analyticsComparisonLabel, analyticsConnectionLabel, formatAnalyticsCount, formatAnalyticsDuration } from "../lib/analyticsDisplay";

type AnalyticsRange = "24h" | "7d" | "30d";
type AnalyticsStatus = "ok" | "degraded" | "unconfigured";
type InsightSectionStatus = "ok" | "degraded" | "unsupported";
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
    visitors: number | null;
    pageviews: number | null;
    sessions: number | null;
    bounces: number | null;
    totalTimeSeconds: number | null;
    averageSessionSeconds: number | null;
    activeVisitors: number | null;
    bounceRate?: number | null;
  };
  source?: {
    provider: "umami" | "goatcounter";
    siteUrl: string;
    dashboardUrl: string;
    connected: boolean;
    reason?: string;
    health?: {
      service: "ok" | "degraded" | "unconfigured";
      database: "ok" | "unavailable" | "unknown";
      tracking: "ok" | "unavailable" | "unknown";
      reporting: "ok" | "degraded" | "unconfigured";
      lastSuccessAt: string | null;
      authFailures: number;
    };
  };
  trends: {
    visitors: TrendMetric | null;
    pageviews: TrendMetric | null;
    sessions: TrendMetric | null;
  };
  goatcounter: {
    siteUrl: string;
    dashboardUrl: string;
    connected: boolean;
    reason?: string;
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
    bounceRate: number | null;
    share?: number;
  }>;
  landingPages?: Array<{
    path: string;
    visitors: number;
    pageviews: number;
    visits: number;
    share?: number;
  }>;
  servicePages?: Array<{
    label: string;
    visitors: number;
    pageviews: number;
    visits: number;
    share: number;
  }>;
  webinarPages?: Array<{
    label: string;
    visitors: number;
    pageviews: number;
    visits: number;
    share: number;
  }>;
}

interface EventsResponse {
  range: AnalyticsRange;
  status: AnalyticsStatus;
  warning?: string;
  totals: {
    events: number | null;
    visitors: number | null;
    visits: number | null;
    uniqueEvents: number | null;
    comparison: {
      events: number | null;
      visitors: number | null;
      visits: number | null;
      uniqueEvents: number | null;
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

interface InsightMetricRow {
  label: string;
  visitors: number;
  pageviews: number;
  visits: number;
  bounceRate: number;
  share: number;
}

interface InsightSubsection {
  status: InsightSectionStatus;
  warning?: string;
  metricType: string;
  items: InsightMetricRow[];
}

interface CampaignInsightRow extends InsightMetricRow {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  sourceType: "utm" | "channel";
}

interface ConversionPathInsightRow extends InsightMetricRow {
  path: string;
  routeLabel: string;
  note: string;
  frictionNote: string | null;
}

interface InsightsResponse {
  range: AnalyticsRange;
  status: AnalyticsStatus;
  warning?: string;
  supportedMetricTypes?: string[];
  entryPages: InsightSubsection;
  exitPages: InsightSubsection;
  devices: InsightSubsection;
  browsers: InsightSubsection;
  operatingSystems?: InsightSubsection;
  geography: {
    countries: InsightMetricRow[];
    regions: InsightMetricRow[];
    status: InsightSectionStatus;
    warning?: string;
  };
  campaigns: {
    items: CampaignInsightRow[];
    status: InsightSectionStatus;
    warning?: string;
    hasUtmData: boolean;
  };
  conversionPaths: {
    items: ConversionPathInsightRow[];
    status: InsightSectionStatus;
    warning?: string;
  };
  recommendations: {
    items: string[];
    status: "ok";
  };
}

interface AnalyticsDashboardState {
  summary: SummaryResponse;
  pageviews: PageviewsResponse;
  events: EventsResponse;
  referrers: ReferrersResponse;
  overview: OverviewResponse;
  insights: InsightsResponse | null;
  insightsWarning: string | null;
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
        "h-[124px] animate-pulse rounded-2xl border px-3.5 py-3",
        isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-white/5",
      )}
    >
      <div className="h-3 w-20 rounded bg-white/10" />
      <div className="mt-4 h-7 w-24 rounded bg-white/10" />
      <div className="mt-3 h-3 w-28 rounded bg-white/10" />
    </div>
  );
}

function LoadingRows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={`analytics-loading-${index}`} className="h-10 animate-pulse rounded-xl bg-white/5" />
      ))}
    </div>
  );
}

function KpiIcon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-accent-cyan">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const KPI_ICONS = {
  visitors: "M4 16.5V9.5M8 16.5V6.5M12 16.5V8.5M16 16.5V4.5",
  pageviews: "M4 4.5h12v11H4zM7 8h6M7 11h4",
  revenue: "M10 4.5v11M7.5 6.5c1.8-1.2 5.2-1.2 5.2.8 0 2.2-5.2 1.4-5.2 3.6 0 1.8 3.2 2.2 5.2.9",
  orders: "M4.5 6.5h11l-1 8h-9zM7.5 6.5 8.2 4.5h3.6l.7 2",
  bounce: "M5 13.5c2.2-4 7.8-4 10 0M10 6.5v.01",
  duration: "M10 4.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zM10 7.5V10l2 1.5",
  subscriptions: "M5 8.5h10v7H5zM7.5 8.5V6.8a2.5 2.5 0 0 1 5 0v1.7",
  bookings: "M5 5.5h10v10H5zM5 8.5h10M8 4.5v2M12 4.5v2",
};

function comparisonClass(metric: TrendMetric | null | undefined, isLightTheme: boolean) {
  if (!metric || metric.previous === 0 || metric.direction === "neutral") {
    return isLightTheme ? "text-slate-500" : "text-white/45";
  }
  if (metric.direction === "up") {
    return isLightTheme ? "text-emerald-700" : "text-emerald-300";
  }
  return isLightTheme ? "text-rose-700" : "text-rose-300";
}

function KpiCard({
  label,
  value,
  comparison,
  toneClass,
  tooltip,
  icon,
  isLightTheme,
}: {
  label: string;
  value: string;
  comparison: string | null;
  toneClass: string;
  tooltip: string;
  icon: string;
  isLightTheme: boolean;
}) {
  return (
    <article
      title={tooltip}
      className={classNames(
        "flex h-[124px] min-w-0 flex-col justify-between rounded-2xl border px-3.5 py-3",
        isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-slate-950/40",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <KpiIcon path={icon} />
        <h2 className={classNames("truncate text-[11px] font-medium uppercase tracking-wide", isLightTheme ? "text-slate-500" : "text-white/55")}>
          {label}
        </h2>
      </div>
      <p className={classNames("truncate text-xl font-semibold leading-none tracking-tight min-[480px]:text-2xl", isLightTheme ? "text-slate-900" : "text-white")}>
        {value}
      </p>
      <p className={classNames("truncate text-[11px] leading-4", toneClass)}>{comparison ?? " "}</p>
    </article>
  );
}

function Subsection({
  title,
  note,
  isLightTheme,
  children,
}: {
  title: string;
  note?: string;
  isLightTheme: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-accent-cyan">{title}</h3>
      {note ? <p className={classNames("mt-1 text-xs leading-5", isLightTheme ? "text-slate-500" : "text-white/45")}>{note}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Fact({
  label,
  value,
  note,
  isLightTheme,
}: {
  label: string;
  value: string;
  note?: string;
  isLightTheme: boolean;
}) {
  return (
    <div className={classNames("min-w-0 rounded-xl border px-3 py-2", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/[0.03]")}>
      <p className={classNames("truncate text-[11px] uppercase tracking-wide", isLightTheme ? "text-slate-500" : "text-white/45")}>{label}</p>
      <p className={classNames("mt-1 truncate text-lg font-semibold leading-none", isLightTheme ? "text-slate-900" : "text-white")}>{value}</p>
      {note ? <p className={classNames("mt-1 truncate text-[11px]", isLightTheme ? "text-slate-500" : "text-white/40")}>{note}</p> : null}
    </div>
  );
}

function TrendChart({ points, isLightTheme }: { points: Array<{ timestamp: string; value: number }>; isLightTheme: boolean }) {
  if (points.length === 0) {
    return <AnalyticsEmptyState message="No traffic trend points for this period." isLightTheme={isLightTheme} />;
  }
  const peak = Math.max(...points.map((point) => point.value), 1);
  return (
    <div className="flex h-24 min-w-0 items-end gap-1 overflow-hidden" role="img" aria-label="Pageviews across the selected period">
      {points.map((point) => (
        <div key={point.timestamp} className="flex h-full min-w-0 flex-1 items-end" title={`${formatDate(point.timestamp)} · ${formatNumber(point.value)} pageviews`}>
          <div
            className="w-full rounded-sm bg-accent-cyan/80"
            style={{ height: `${Math.max(6, Math.round((point.value / peak) * 100))}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function isDivin8Path(path: string) {
  const normalized = path.toLowerCase();
  return normalized.includes("/reports") || normalized.includes("divin8");
}

function metricDetail(row: { pageviews?: number; visitors?: number; visits?: number }, includeVisits = false) {
  return [
    row.pageviews !== undefined ? `${formatNumber(row.pageviews)} pageviews` : null,
    row.visitors !== undefined ? `${formatNumber(row.visitors)} visitors` : null,
    includeVisits && row.visits !== undefined ? `${formatNumber(row.visits)} visits` : null,
  ].filter(Boolean).join(" · ");
}

function insightItems(rows: InsightMetricRow[], options: {
  title?: (row: InsightMetricRow) => string;
  detail?: (row: InsightMetricRow) => string;
  metric?: (row: InsightMetricRow) => string;
  note?: (row: InsightMetricRow) => string | null;
} = {}): AnalyticsMetricListItem[] {
  return rows.map((row) => ({
    id: row.label,
    title: options.title?.(row) ?? row.label,
    detail: options.detail?.(row) ?? metricDetail(row, true),
    metric: options.metric?.(row) ?? `${row.share}% share`,
    note: options.note?.(row) ?? null,
  }));
}

function healthLabel(value: string | undefined) {
  if (value === "ok") return "OK";
  if (value === "unconfigured") return "Not configured";
  if (value === "unavailable") return "Unavailable";
  if (value === "degraded") return "Degraded";
  if (!value || value === "unknown") return "Unknown";
  return value;
}

function divin8PageItems(data: AnalyticsDashboardState): AnalyticsMetricListItem[] {
  const rows = new Map<string, AnalyticsMetricListItem>();
  for (const page of data.pageviews.topPages) {
    if (!isDivin8Path(page.path)) continue;
    const item = pageItems([page])[0];
    if (item) rows.set(page.path, item);
  }
  for (const page of data.pageviews.landingPages ?? []) {
    if (!isDivin8Path(page.path) || rows.has(page.path)) continue;
    const item = pageItems([page])[0];
    if (item) rows.set(page.path, item);
  }
  for (const row of data.insights?.conversionPaths.items ?? []) {
    if (!isDivin8Path(row.path) || rows.has(row.path)) continue;
    rows.set(row.path, {
      id: row.path,
      title: `${row.path} · ${row.routeLabel}`,
      detail: row.note,
      metric: `${formatNumber(row.pageviews)} pageviews`,
    });
  }
  return [...rows.values()];
}

function pageItems(rows: Array<{ path?: string; label?: string; visitors: number; pageviews: number; visits: number; share?: number; bounceRate?: number | null }>): AnalyticsMetricListItem[] {
  return rows.map((row) => ({
    id: row.path ?? row.label ?? "page",
    title: row.label ?? row.path ?? "Page",
    detail: metricDetail(row, true),
    metric: typeof row.bounceRate === "number" ? `${row.bounceRate}% bounce` : row.share !== undefined ? `${row.share}% share` : undefined,
  }));
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
        const insightsRequest = api
          .get(`/admin/analytics/insights${query}`, token)
          .then((response) => ({ data: (response as { data: InsightsResponse }).data, warning: null as string | null }))
          .catch((insightsError: unknown) => ({
            data: null,
            warning: insightsError instanceof Error ? insightsError.message : "Analytics insights are temporarily unavailable.",
          }));
        const [summary, pageviews, events, referrers, overview, insights] = await Promise.all([
          api.get(`/admin/analytics/summary${query}`, token) as Promise<{ data: SummaryResponse }>,
          api.get(`/admin/analytics/pageviews${query}`, token) as Promise<{ data: PageviewsResponse }>,
          api.get(`/admin/analytics/events${query}`, token) as Promise<{ data: EventsResponse }>,
          api.get(`/admin/analytics/referrers${query}`, token) as Promise<{ data: ReferrersResponse }>,
          api.get(`/admin/analytics/overview${query}`, token) as Promise<{ data: OverviewResponse }>,
          insightsRequest,
        ]);

        if (!cancelled) {
          setData({
            summary: summary.data,
            pageviews: pageviews.data,
            events: events.data,
            referrers: referrers.data,
            overview: overview.data,
            insights: insights.data,
            insightsWarning: insights.warning,
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

  const traffic = data?.summary.traffic;
  const business = data?.overview.businessMetrics;
  const health = data?.summary.source?.health;
  const connection = data ? analyticsConnectionLabel(data.summary.source ?? data.summary.goatcounter) : "Unavailable";
  const provider = (data?.summary.source?.provider ?? "goatcounter") === "umami" ? "Umami" : "GoatCounter";
  const divin8Items = data ? divin8PageItems(data) : [];
  const channelRows = data?.insights?.campaigns.items.filter((row) => row.sourceType === "channel") ?? [];
  const utmRows = data?.insights?.campaigns.items.filter((row) => row.sourceType === "utm") ?? [];

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className={classNames("text-xl font-semibold tracking-tight", isLightTheme ? "text-slate-900" : "text-white")}>
            Analytics
          </h1>
          <p className={classNames("mt-1 max-w-3xl text-xs leading-5", isLightTheme ? "text-slate-600" : "text-white/55")}>
            Umami reports website traffic. Prime Mentor and Stripe report orders, subscriptions, and bookings.
          </p>
        </div>
        <div role="group" aria-label="Date range" className="flex flex-wrap gap-1.5">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setRange(option.id)}
              className={classNames(
                "rounded-full border px-3 py-1.5 text-xs transition",
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
        <div className={classNames("rounded-xl border px-3 py-2 text-xs", isLightTheme ? "border-amber-200 bg-amber-50 text-amber-800" : "border-amber-400/25 bg-amber-400/10 text-amber-100")}>
          {warnings[0]}
        </div>
      ) : null}
      {error ? (
        <div className={classNames("rounded-xl border px-3 py-2 text-xs", isLightTheme ? "border-rose-200 bg-rose-50 text-rose-700" : "border-rose-400/25 bg-rose-400/10 text-rose-100")}>
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {loading || !traffic || !business ? (
          Array.from({ length: 8 }).map((_, index) => <MetricSkeleton key={`kpi-${index}`} isLightTheme={isLightTheme} />)
        ) : (
          <>
            <KpiCard
              label="Unique Visitors"
              value={formatAnalyticsCount(traffic.visitors)}
              comparison={analyticsComparisonLabel(data?.summary.trends.visitors)}
              toneClass={comparisonClass(data?.summary.trends.visitors, isLightTheme)}
              tooltip="Distinct visitors in the selected period."
              icon={KPI_ICONS.visitors}
              isLightTheme={isLightTheme}
            />
            <KpiCard
              label="Pageviews"
              value={formatAnalyticsCount(traffic.pageviews)}
              comparison={analyticsComparisonLabel(data?.summary.trends.pageviews)}
              toneClass={comparisonClass(data?.summary.trends.pageviews, isLightTheme)}
              tooltip="Pages viewed in the selected period."
              icon={KPI_ICONS.pageviews}
              isLightTheme={isLightTheme}
            />
            <KpiCard
              label="Revenue"
              value={formatMoney(business.revenue.value, business.revenue.currency)}
              comparison={analyticsComparisonLabel(business.revenue.trend)}
              toneClass={comparisonClass(business.revenue.trend, isLightTheme)}
              tooltip="Completed order revenue in the selected period."
              icon={KPI_ICONS.revenue}
              isLightTheme={isLightTheme}
            />
            <KpiCard
              label="Orders"
              value={formatNumber(business.orders.value)}
              comparison={analyticsComparisonLabel(business.orders.trend)}
              toneClass={comparisonClass(business.orders.trend, isLightTheme)}
              tooltip="Completed orders in the selected period."
              icon={KPI_ICONS.orders}
              isLightTheme={isLightTheme}
            />
            <KpiCard
              label="Bounce Rate"
              value={traffic.bounceRate === null || traffic.bounceRate === undefined ? "Unavailable" : `${formatNumber(traffic.bounceRate)}%`}
              comparison={null}
              toneClass={isLightTheme ? "text-slate-500" : "text-white/45"}
              tooltip="Share of visits that viewed only one page. Unavailable when there are no visits."
              icon={KPI_ICONS.bounce}
              isLightTheme={isLightTheme}
            />
            <KpiCard
              label="Average Visit Duration"
              value={formatAnalyticsDuration(traffic.averageSessionSeconds)}
              comparison={null}
              toneClass={isLightTheme ? "text-slate-500" : "text-white/45"}
              tooltip="Total visit time divided by visits. Unavailable when there are no visits."
              icon={KPI_ICONS.duration}
              isLightTheme={isLightTheme}
            />
            <KpiCard
              label="Active Subscriptions"
              value={formatNumber(business.activeSubscriptions.value)}
              comparison={analyticsComparisonLabel(business.activeSubscriptions.trend)}
              toneClass={comparisonClass(business.activeSubscriptions.trend, isLightTheme)}
              tooltip="Current active or trialing memberships. This is a point-in-time count, not a total for the selected dates."
              icon={KPI_ICONS.subscriptions}
              isLightTheme={isLightTheme}
            />
            <KpiCard
              label="Booked Sessions"
              value={formatNumber(business.sessionsBooked.value)}
              comparison={analyticsComparisonLabel(business.sessionsBooked.trend)}
              toneClass={comparisonClass(business.sessionsBooked.trend, isLightTheme)}
              tooltip="Paid, scheduled, or completed bookings in the selected period."
              icon={KPI_ICONS.bookings}
              isLightTheme={isLightTheme}
            />
          </>
        )}
      </div>

      <div className="space-y-2">
        <AnalyticsAccordion title="Traffic & Engagement" isLightTheme={isLightTheme}>
          {loading ? <LoadingRows /> : !data || !traffic ? (
            <AnalyticsEmptyState message="Traffic did not load." isLightTheme={isLightTheme} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Fact label="Sessions" value={formatAnalyticsCount(traffic.sessions)} note={analyticsComparisonLabel(data.summary.trends.sessions) ?? undefined} isLightTheme={isLightTheme} />
                <Fact label="Active visitors" value={formatAnalyticsCount(traffic.activeVisitors)} note="Last five minutes" isLightTheme={isLightTheme} />
                <Fact label="Bounces" value={formatAnalyticsCount(traffic.bounces)} isLightTheme={isLightTheme} />
                <Fact label="Total visit time" value={formatAnalyticsDuration(traffic.totalTimeSeconds)} isLightTheme={isLightTheme} />
              </div>
              <Subsection title="Traffic trends" note="Pageviews across the selected period." isLightTheme={isLightTheme}>
                <TrendChart points={data.pageviews.series.pageviews} isLightTheme={isLightTheme} />
              </Subsection>
              <Subsection title="Event tracking" isLightTheme={isLightTheme}>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <Fact label="Events" value={formatAnalyticsCount(data.events.totals.events)} isLightTheme={isLightTheme} />
                  <Fact label="Event visitors" value={formatAnalyticsCount(data.events.totals.visitors)} isLightTheme={isLightTheme} />
                  <Fact label="Event visits" value={formatAnalyticsCount(data.events.totals.visits)} isLightTheme={isLightTheme} />
                  <Fact label="Unique events" value={formatAnalyticsCount(data.events.totals.uniqueEvents)} isLightTheme={isLightTheme} />
                </div>
                <div className="mt-2">
                  {data.events.items.length === 0 ? (
                    <AnalyticsEmptyState message="No custom events in this period." isLightTheme={isLightTheme} />
                  ) : (
                    <AnalyticsMetricList
                      isLightTheme={isLightTheme}
                      items={data.events.items.map((item) => ({
                        id: item.name,
                        title: item.name,
                        detail: `${formatNumber(item.total)} tracked events`,
                        metric: `${item.share}% share`,
                      }))}
                    />
                  )}
                </div>
              </Subsection>
            </>
          )}
        </AnalyticsAccordion>

        <AnalyticsAccordion title="Audience Insights" warning={data?.insightsWarning ?? data?.insights?.geography.warning} isLightTheme={isLightTheme}>
          {loading ? <LoadingRows /> : !data?.insights ? (
            <AnalyticsEmptyState message={data?.insightsWarning ?? "Audience insights did not load."} isLightTheme={isLightTheme} />
          ) : (
            <>
              <Subsection title="Countries" note={analyticsHelperText.geography} isLightTheme={isLightTheme}>
                {data.insights.geography.countries.length === 0 ? (
                  <AnalyticsEmptyState isLightTheme={isLightTheme} />
                ) : (
                  <AnalyticsMetricList isLightTheme={isLightTheme} items={insightItems(data.insights.geography.countries)} />
                )}
              </Subsection>
              <Subsection title="Regions" isLightTheme={isLightTheme}>
                {data.insights.geography.regions.length === 0 ? (
                  <AnalyticsEmptyState isLightTheme={isLightTheme} />
                ) : (
                  <AnalyticsMetricList isLightTheme={isLightTheme} items={insightItems(data.insights.geography.regions)} />
                )}
              </Subsection>
              <Subsection title="Devices" note={analyticsHelperText.devices} isLightTheme={isLightTheme}>
                {data.insights.devices.items.length === 0 ? <AnalyticsEmptyState isLightTheme={isLightTheme} /> : <AnalyticsMetricList isLightTheme={isLightTheme} items={insightItems(data.insights.devices.items)} />}
              </Subsection>
              <Subsection title="Browsers" note={analyticsHelperText.browsers} isLightTheme={isLightTheme}>
                {data.insights.browsers.items.length === 0 ? <AnalyticsEmptyState isLightTheme={isLightTheme} /> : <AnalyticsMetricList isLightTheme={isLightTheme} items={insightItems(data.insights.browsers.items)} />}
              </Subsection>
              <Subsection title="Operating systems" isLightTheme={isLightTheme}>
                {!data.insights.operatingSystems || data.insights.operatingSystems.items.length === 0 ? (
                  <AnalyticsEmptyState
                    message={data.insights.operatingSystems?.status === "unsupported" ? "Operating system data is not available from this source." : "No operating system data available yet."}
                    isLightTheme={isLightTheme}
                  />
                ) : (
                  <AnalyticsMetricList isLightTheme={isLightTheme} items={insightItems(data.insights.operatingSystems.items)} />
                )}
              </Subsection>
            </>
          )}
        </AnalyticsAccordion>

        <AnalyticsAccordion title="Acquisition & Campaigns" warning={data?.insights?.campaigns.warning} isLightTheme={isLightTheme}>
          {loading ? <LoadingRows /> : !data ? (
            <AnalyticsEmptyState message="Acquisition did not load." isLightTheme={isLightTheme} />
          ) : (
            <>
              <Subsection title="Referrals" isLightTheme={isLightTheme}>
                {data.referrers.items.length === 0 ? (
                  <AnalyticsEmptyState isLightTheme={isLightTheme} />
                ) : (
                  <AnalyticsMetricList
                    isLightTheme={isLightTheme}
                    items={data.referrers.items.map((row) => ({
                      id: row.referrer,
                      title: row.referrer,
                      detail: metricDetail(row, true),
                      metric: `${row.share}% share`,
                    }))}
                  />
                )}
              </Subsection>
              <Subsection title="Traffic sources" isLightTheme={isLightTheme}>
                {channelRows.length === 0 ? (
                  <AnalyticsEmptyState message="No separate traffic-source rows for this period." isLightTheme={isLightTheme} />
                ) : (
                  <AnalyticsMetricList isLightTheme={isLightTheme} items={insightItems(channelRows)} />
                )}
              </Subsection>
              <Subsection title="UTM campaigns" note={analyticsHelperText.campaigns} isLightTheme={isLightTheme}>
                {utmRows.length === 0 ? (
                  <AnalyticsEmptyState message={`${utmEmptyState} Example: ${utmExample}`} isLightTheme={isLightTheme} />
                ) : (
                  <AnalyticsMetricList
                    isLightTheme={isLightTheme}
                    items={utmRows.map((row) => ({
                      id: row.label,
                      title: row.label,
                      detail: [row.utmSource, row.utmMedium, row.utmCampaign].filter(Boolean).join(" · ") || metricDetail(row, true),
                      metric: `${row.share}% share`,
                    }))}
                  />
                )}
              </Subsection>
              <Subsection title="Landing pages" note={analyticsHelperText.entryPages} isLightTheme={isLightTheme}>
                {(data.pageviews.landingPages ?? []).length === 0 ? (
                  data.insights && data.insights.entryPages.items.length > 0 ? (
                    <AnalyticsMetricList isLightTheme={isLightTheme} items={insightItems(data.insights.entryPages.items)} />
                  ) : (
                    <AnalyticsEmptyState isLightTheme={isLightTheme} />
                  )
                ) : (
                  <AnalyticsMetricList isLightTheme={isLightTheme} items={pageItems(data.pageviews.landingPages ?? [])} />
                )}
              </Subsection>
            </>
          )}
        </AnalyticsAccordion>

        <AnalyticsAccordion title="Content Performance" warning={data?.insights?.conversionPaths.warning} isLightTheme={isLightTheme}>
          {loading ? <LoadingRows /> : !data ? (
            <AnalyticsEmptyState message="Content performance did not load." isLightTheme={isLightTheme} />
          ) : (
            <>
              <Subsection title="Most visited pages" isLightTheme={isLightTheme}>
                {data.pageviews.topPages.length === 0 ? <AnalyticsEmptyState isLightTheme={isLightTheme} /> : <AnalyticsMetricList isLightTheme={isLightTheme} items={pageItems(data.pageviews.topPages)} />}
              </Subsection>
              <Subsection title="Service page traffic" isLightTheme={isLightTheme}>
                {(data.pageviews.servicePages ?? []).length === 0 ? <AnalyticsEmptyState isLightTheme={isLightTheme} /> : <AnalyticsMetricList isLightTheme={isLightTheme} items={pageItems(data.pageviews.servicePages ?? [])} />}
              </Subsection>
              <Subsection title="Webinar page traffic" isLightTheme={isLightTheme}>
                {(data.pageviews.webinarPages ?? []).length === 0 ? <AnalyticsEmptyState isLightTheme={isLightTheme} /> : <AnalyticsMetricList isLightTheme={isLightTheme} items={pageItems(data.pageviews.webinarPages ?? [])} />}
              </Subsection>
              <Subsection title="Divin8 page traffic" isLightTheme={isLightTheme}>
                {divin8Items.length === 0 ? (
                  <AnalyticsEmptyState message="No Divin8 page traffic in this period." isLightTheme={isLightTheme} />
                ) : (
                  <AnalyticsMetricList isLightTheme={isLightTheme} items={divin8Items} />
                )}
              </Subsection>
              <Subsection title="Exit pages" note={analyticsHelperText.exitPages} isLightTheme={isLightTheme}>
                {!data.insights || data.insights.exitPages.items.length === 0 ? <AnalyticsEmptyState isLightTheme={isLightTheme} /> : <AnalyticsMetricList isLightTheme={isLightTheme} items={insightItems(data.insights.exitPages.items)} />}
              </Subsection>
              <Subsection title="Conversion paths" note={analyticsHelperText.conversionPaths} isLightTheme={isLightTheme}>
                {!data.insights || data.insights.conversionPaths.items.length === 0 ? (
                  <AnalyticsEmptyState isLightTheme={isLightTheme} />
                ) : (
                  <AnalyticsMetricList
                    isLightTheme={isLightTheme}
                    items={data.insights.conversionPaths.items.map((row) => ({
                      id: row.path,
                      title: `${row.path} · ${row.routeLabel || getConversionRouteLabel(row.path) || "Path"}`,
                      detail: row.note,
                      metric: `${formatNumber(row.pageviews)} pageviews`,
                      note: row.frictionNote,
                    }))}
                  />
                )}
              </Subsection>
            </>
          )}
        </AnalyticsAccordion>

        <AnalyticsAccordion title="Sales & Subscriptions" isLightTheme={isLightTheme}>
          {loading ? <LoadingRows /> : !data || !business ? (
            <AnalyticsEmptyState message="Sales did not load." isLightTheme={isLightTheme} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Fact label="Revenue" value={formatMoney(business.revenue.value, business.revenue.currency)} note={analyticsComparisonLabel(business.revenue.trend) ?? undefined} isLightTheme={isLightTheme} />
                <Fact label="Orders" value={formatNumber(business.orders.value)} note={analyticsComparisonLabel(business.orders.trend) ?? undefined} isLightTheme={isLightTheme} />
                <Fact label="Active subscriptions" value={formatNumber(business.activeSubscriptions.value)} note="Current snapshot" isLightTheme={isLightTheme} />
                <Fact label="Booked sessions" value={formatNumber(business.sessionsBooked.value)} note={analyticsComparisonLabel(business.sessionsBooked.trend) ?? undefined} isLightTheme={isLightTheme} />
              </div>
              <Subsection title="Not reported separately" note="The current business summary does not include these counts, so they are left blank instead of shown as zero." isLightTheme={isLightTheme}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Fact label="New subscriptions" value="Not reported" isLightTheme={isLightTheme} />
                  <Fact label="Renewals" value="Not reported" isLightTheme={isLightTheme} />
                  <Fact label="Failed payments" value="Not reported" isLightTheme={isLightTheme} />
                </div>
              </Subsection>
              <Subsection title="Pacific calendar snapshot" note="These figures follow the America/Vancouver calendar and do not change with the selected range." isLightTheme={isLightTheme}>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                  <Fact label="Orders today" value={formatNumber(data.overview.conversionInsights.ordersToday)} isLightTheme={isLightTheme} />
                  <Fact label="Orders this week" value={formatNumber(data.overview.conversionInsights.ordersThisWeek)} isLightTheme={isLightTheme} />
                  <Fact label="Revenue this month" value={formatMoney(data.overview.conversionInsights.revenueThisMonth)} isLightTheme={isLightTheme} />
                  <Fact label="Total users" value={formatNumber(data.overview.conversionInsights.totalUsers)} note="Current snapshot" isLightTheme={isLightTheme} />
                  <Fact label="Client records" value={formatNumber(data.overview.conversionInsights.totalClients)} note="Current snapshot" isLightTheme={isLightTheme} />
                </div>
              </Subsection>
              <Subsection title="Recent activity" isLightTheme={isLightTheme}>
                {data.overview.recentActivity.length === 0 ? (
                  <AnalyticsEmptyState message="No recent purchases, bookings, or signups." isLightTheme={isLightTheme} />
                ) : (
                  <div className="space-y-2">
                    {data.overview.recentActivity.map((item) => (
                      <div key={item.id} className={classNames("rounded-xl border px-3 py-2", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/[0.03]")}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={classNames("truncate text-sm font-medium", isLightTheme ? "text-slate-900" : "text-white")}>{item.title}</p>
                            <p className={classNames("mt-0.5 truncate text-xs", isLightTheme ? "text-slate-600" : "text-white/55")}>{item.detail}</p>
                          </div>
                          <span className={classNames("shrink-0 text-[11px]", isLightTheme ? "text-slate-500" : "text-white/40")}>{formatDate(item.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Subsection>
              <Subsection title="Recommendations" note={analyticsHelperText.recommendations} isLightTheme={isLightTheme}>
                {!data.insights || data.insights.recommendations.items.length === 0 ? (
                  <AnalyticsEmptyState message="No recommendations for this period yet." isLightTheme={isLightTheme} />
                ) : (
                  <div className="space-y-2">
                    {data.insights.recommendations.items.map((item) => (
                      <p key={item} className={classNames("rounded-xl border px-3 py-2 text-sm leading-5", isLightTheme ? "border-slate-200 bg-slate-50 text-slate-700" : "border-white/10 bg-white/[0.03] text-white/70")}>
                        {item}
                      </p>
                    ))}
                  </div>
                )}
              </Subsection>
            </>
          )}
        </AnalyticsAccordion>

        <AnalyticsAccordion title="Data Source Health" isLightTheme={isLightTheme}>
          {loading ? <LoadingRows /> : !data ? (
            <AnalyticsEmptyState message="Health did not load." isLightTheme={isLightTheme} />
          ) : (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              <Fact label="Umami connection" value={connection} note={provider} isLightTheme={isLightTheme} />
              <Fact label="Database connection" value={healthLabel(health?.database)} isLightTheme={isLightTheme} />
              <Fact label="Tracking status" value={healthLabel(health?.tracking)} isLightTheme={isLightTheme} />
              <Fact label="Reporting query" value={healthLabel(health?.reporting)} note={health?.lastSuccessAt ? `Last success ${formatDate(health.lastSuccessAt)}` : "No successful reporting query yet"} isLightTheme={isLightTheme} />
              <Fact label="Service" value={healthLabel(health?.service)} isLightTheme={isLightTheme} />
              <Fact
                label="Error details"
                value={health?.authFailures ? `${health.authFailures} auth failure${health.authFailures === 1 ? "" : "s"}` : warnings[0] ?? data.summary.source?.reason ?? "None"}
                isLightTheme={isLightTheme}
              />
            </div>
          )}
        </AnalyticsAccordion>
      </div>
    </div>
  );
}
