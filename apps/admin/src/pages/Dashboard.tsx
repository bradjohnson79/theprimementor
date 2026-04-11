import { useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Loading from "../components/Loading";
import { api } from "../lib/api";

type DashboardTrend = "up" | "down" | "neutral";
type DashboardStatus = "operational" | "active" | "degraded" | "error";

interface DashboardKpi {
  value: number;
  delta: number;
  delta_label: string;
  trend: DashboardTrend;
}

interface DashboardRevenuePoint {
  date: string;
  total: number;
}

interface DashboardActivityItem {
  id: string;
  kind: "order_completed" | "payment_failed" | "subscription_renewal" | "new_client";
  title: string;
  detail: string;
  status: "success" | "failure" | "info";
  created_at: string;
}

interface DashboardStatusItem {
  label: string;
  status: DashboardStatus;
  detail: string;
  value: string;
}

interface AdminDashboardResponse {
  data: {
    kpis: {
      total_clients: DashboardKpi;
      total_orders: DashboardKpi;
      revenue_this_month: DashboardKpi;
      active_subscriptions: DashboardKpi;
    };
    revenue_over_time: DashboardRevenuePoint[];
    recent_activity: DashboardActivityItem[];
    system_status: DashboardStatusItem[];
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const startedAt = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

function TrendLabel({ trend, label }: { trend: DashboardTrend; label: string }) {
  const tone = trend === "up"
    ? "text-emerald-300"
    : trend === "down"
      ? "text-rose-300"
      : "text-white/45";
  return <p className={`mt-2 text-xs ${tone}`}>{label}</p>;
}

function KpiCard({
  title,
  value,
  delta,
  isCurrency = false,
}: {
  title: string;
  value: number;
  delta: DashboardKpi;
  isCurrency?: boolean;
}) {
  const counted = useCountUp(value);
  return (
    <Card className="shadow-[0_18px_44px_rgba(0,0,0,0.22)] transition-shadow hover:shadow-[0_24px_64px_rgba(0,0,0,0.28)]">
      <p className="text-sm font-medium text-white/50">{title}</p>
      <p className="mt-3 text-3xl font-bold text-white">
        {isCurrency ? formatMoney(counted) : Math.round(counted).toLocaleString()}
      </p>
      <TrendLabel trend={delta.trend} label={delta.delta_label} />
    </Card>
  );
}

function RevenueChart({ data }: { data: DashboardRevenuePoint[] }) {
  const width = 720;
  const height = 260;
  const padding = 20;
  const max = Math.max(...data.map((point) => point.total), 1);
  const points = data.map((point, index) => {
    const x = padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2);
    const y = height - padding - (point.total / max) * (height - padding * 2);
    return { ...point, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${path} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;
  const horizontalGuides = [0, 0.33, 0.66, 1].map((ratio) => height - padding - ratio * (height - padding * 2));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }}>
      <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#07111f]/70 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
          {horizontalGuides.map((y) => (
            <line key={y} x1={padding} x2={width - padding} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" />
          ))}
          <path d={areaPath} fill="url(#revenue-fill)" opacity="0.18" />
          <path d={path} fill="none" stroke="#4fd1ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point) => (
            <circle key={point.date} cx={point.x} cy={point.y} r="3.5" fill="#8b5cf6" />
          ))}
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <div className="mt-3 flex items-center justify-between text-xs text-white/40">
          <span>{formatShortDate(data[0]?.date ?? new Date().toISOString())}</span>
          <span>{formatShortDate(data[data.length - 1]?.date ?? new Date().toISOString())}</span>
        </div>
      </div>
    </motion.div>
  );
}

function ActivityIcon({ status }: { status: DashboardActivityItem["status"] }) {
  const styles = status === "success"
    ? "bg-emerald-400/12 text-emerald-300 border-emerald-400/30"
    : status === "failure"
      ? "bg-rose-400/12 text-rose-300 border-rose-400/30"
      : "bg-sky-400/12 text-sky-300 border-sky-400/30";
  const symbol = status === "success" ? "↗" : status === "failure" ? "!" : "+";
  return (
    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm ${styles}`}>
      {symbol}
    </span>
  );
}

function StatusPill({ status }: { status: DashboardStatus }) {
  const styles = status === "operational"
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
    : status === "active"
      ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
      : status === "degraded"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
        : "border-rose-400/30 bg-rose-400/10 text-rose-200";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${styles}`}>{status}</span>;
}

export default function Dashboard() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<AdminDashboardResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const response = await api.get("/admin/dashboard", token) as AdminDashboardResponse;
        if (!cancelled) {
          setDashboard(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const kpiCards = useMemo(() => {
    if (!dashboard) return [];
    return [
      { title: "Total Clients", data: dashboard.kpis.total_clients, currency: false },
      { title: "Total Orders", data: dashboard.kpis.total_orders, currency: false },
      { title: "Revenue (This Month)", data: dashboard.kpis.revenue_this_month, currency: true },
      { title: "Active Subscriptions", data: dashboard.kpis.active_subscriptions, currency: false },
    ];
  }, [dashboard]);

  if (loading) {
    return <Loading />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="text-2xl font-bold text-white">
        Welcome back, {user?.firstName || "Admin"}
      </h2>
      <p className="mt-1 text-white/50">Your live business command center.</p>

      {error ? (
        <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {dashboard ? (
        <>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map((card) => (
              <KpiCard
                key={card.title}
                title={card.title}
                value={card.data.value}
                delta={card.data}
                isCurrency={card.currency}
              />
            ))}
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">Revenue Over Time</h3>
                  <p className="mt-1 text-sm text-white/45">Last 30 days</p>
                </div>
                <p className="text-sm text-white/45">
                  {formatMoney(dashboard.revenue_over_time.reduce((sum, point) => sum + point.total, 0))}
                </p>
              </div>
              <div className="mt-5">
                <RevenueChart data={dashboard.revenue_over_time} />
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
                  <p className="mt-1 text-sm text-white/45">Jump straight into common admin flows.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => navigate("/admin/orders?mode=create_invoice")}
                  className="rounded-2xl border border-cyan-300/30 bg-gradient-to-r from-cyan-400/20 via-sky-400/20 to-violet-400/20 px-4 py-4 text-left text-sm text-cyan-100 shadow-[0_0_24px_rgba(56,189,248,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_0_32px_rgba(99,102,241,0.24)]"
                >
                  Create Invoice
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/clients")}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left text-sm text-white/80 transition hover:-translate-y-0.5 hover:bg-white/10"
                >
                  Add Client
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/reports")}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left text-sm text-white/80 transition hover:-translate-y-0.5 hover:bg-white/10"
                >
                  Generate Report
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/blueprint")}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left text-sm text-white/80 transition hover:-translate-y-0.5 hover:bg-white/10"
                >
                  Run Divin8
                </button>
              </div>
            </Card>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.05fr)]">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
                  <p className="mt-1 text-sm text-white/45">Latest 10 commerce and client events.</p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                {dashboard.recent_activity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <ActivityIcon status={item.status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-white">{item.title}</p>
                        <p className="shrink-0 text-xs text-white/35">{formatDateTime(item.created_at)}</p>
                      </div>
                      <p className="mt-1 text-sm text-white/55">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">System Status</h3>
                  <p className="mt-1 text-sm text-white/45">Operational health across billing and automation.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {dashboard.system_status.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <StatusPill status={item.status} />
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
                    <p className="mt-2 text-sm leading-6 text-white/55">{item.detail}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </motion.div>
  );
}
