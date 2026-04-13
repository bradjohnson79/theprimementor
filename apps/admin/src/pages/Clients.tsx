import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import Table from "../components/Table";
import EmptyState from "../components/EmptyState";
import Card from "../components/Card";
import OrderStatusBadge from "../components/OrderStatusBadge";
import type { AdminClientSummary, AdminClientsResponse, ClientSort } from "../lib/clients";
import { formatOrderDate, formatOrderMoney } from "../lib/orders";

interface ClientColumn {
  key: keyof AdminClientSummary;
  label: ReactNode;
  render?: (value: AdminClientSummary[keyof AdminClientSummary], row: AdminClientSummary) => ReactNode;
}

const PAGE_SIZE = 50;
const SORT_OPTIONS: Array<{ id: ClientSort; label: string }> = [
  { id: "newest", label: "Newest client" },
  { id: "highest_spend", label: "Highest spend" },
  { id: "most_orders", label: "Most orders" },
];

const columns: ClientColumn[] = [
  {
    key: "name",
    label: "Client",
    render: (_value, row) => (
      <div className="space-y-1">
        <p className="font-medium text-white">{row.name || row.email}</p>
        {row.name ? <p className="text-xs text-white/45">Joined {formatOrderDate(row.createdAt)}</p> : null}
      </div>
    ),
  },
  { key: "email", label: "Email" },
  {
    key: "totalOrders",
    label: "Orders",
    render: (value) => (
      <span className="inline-flex min-w-10 justify-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80">
        {String(value)}
      </span>
    ),
  },
  {
    key: "totalSpent",
    label: "Total Spent",
    render: (value) => formatOrderMoney(Number(value ?? 0), "CAD"),
  },
  {
    key: "lastOrderAt",
    label: "Last Order",
    render: (_value, row) => (
      <span className="text-white/70">{row.lastOrderAt ? formatOrderDate(row.lastOrderAt) : "No purchases yet"}</span>
    ),
  },
  {
    key: "id",
    label: "\u2192",
    render: (_value, row) => (
      <span className="inline-flex w-full justify-end text-lg text-white/35">
        {row.totalOrders > 0 ? ">" : "-"}
      </span>
    ),
  },
];

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={`client-skeleton-${index}`}
          className="grid animate-pulse gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 md:grid-cols-[1.6fr_1.4fr_0.6fr_0.9fr_1fr_0.25fr]"
        >
          <div className="h-4 rounded bg-white/10" />
          <div className="h-4 rounded bg-white/10" />
          <div className="h-4 rounded bg-white/10" />
          <div className="h-4 rounded bg-white/10" />
          <div className="h-4 rounded bg-white/10" />
          <div className="h-4 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export default function Clients() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<AdminClientSummary[]>([]);
  const [pagination, setPagination] = useState<AdminClientsResponse["pagination"] | null>(null);
  const [meta, setMeta] = useState<AdminClientsResponse["meta"] | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ClientSort>("newest");
  const [activeOnly, setActiveOnly] = useState(true);
  const [expandedClientIds, setExpandedClientIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [search, sort, activeOnly]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String((page - 1) * PAGE_SIZE),
          sort,
          activeOnly: activeOnly ? "true" : "false",
        });
        if (search.trim()) {
          params.set("search", search.trim());
        }

        const result = await api.get(`/clients?${params.toString()}`, token) as AdminClientsResponse;
        if (!cancelled) {
          setClients(result.clients);
          setPagination(result.pagination);
          setMeta(result.meta);
          setExpandedClientIds((current) => current.filter((id) => result.clients.some((client) => client.id === id)));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load clients.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [activeOnly, getToken, page, search, sort]);

  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.limit)) : 1;
  const hasSearch = search.trim().length > 0;
  const emptyState = useMemo(() => {
    if (loading || error || clients.length > 0) return null;
    if ((meta?.totalUsers ?? 0) === 0) {
      return {
        title: "No clients yet",
        message: "Clients will appear here once accounts are created.",
      };
    }
    if (hasSearch) {
      return {
        title: "No matching clients",
        message: "Try a different email, name, or filter combination.",
      };
    }
    if (activeOnly && (meta?.totalActiveClients ?? 0) === 0) {
      return {
        title: "Clients exist but no purchases yet",
        message: "Accounts have been created, but no tracked orders have been completed yet.",
      };
    }
    return {
      title: "No clients found",
      message: "Adjust the current filters to see more client activity.",
    };
  }, [activeOnly, clients.length, error, hasSearch, loading, meta?.totalActiveClients, meta?.totalUsers]);

  function toggleClientExpanded(clientId: string) {
    setExpandedClientIds((current) =>
      current.includes(clientId)
        ? current.filter((id) => id !== clientId)
        : [...current, clientId]);
  }

  function renderExpandedOrders(client: AdminClientSummary) {
    if (client.orders.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-white/55">
          No linked orders yet for this client.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-white/80">Order history</p>
          <p className="text-xs uppercase tracking-[0.25em] text-white/35">{client.orders.length} linked orders</p>
        </div>
        <div className="space-y-2">
          {client.orders.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/admin/orders/${order.id}`);
              }}
              className="grid w-full gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-left transition hover:border-accent-cyan/30 hover:bg-white/[0.07] md:grid-cols-[1.4fr_0.8fr_0.7fr_1fr]"
            >
              <span className="font-medium text-white">{order.orderNumber}</span>
              <span className="text-white/80">{formatOrderMoney(order.amount, "CAD")}</span>
              <span><OrderStatusBadge status={order.status} /></span>
              <span className="text-sm text-white/55">{formatOrderDate(order.createdAt)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-white">Clients</h2>
        <p className="mt-1 text-white/50">
          CRM-lite customer activity grouped by account holder.
          {pagination ? <span className="ml-2 text-white/30">({pagination.total} visible)</span> : null}
        </p>
      </div>

      <Card>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_220px_auto]">
          <div>
            <label className="text-sm text-white/60">Search</label>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-accent-cyan/40"
            />
          </div>
          <div>
            <label className="text-sm text-white/60">Sort by</label>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as ClientSort)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1327] px-4 py-3 text-sm text-white outline-none transition focus:border-accent-cyan/40"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(event) => setActiveOnly(event.target.checked)}
                className="rounded border-white/15 bg-transparent"
              />
              Active only
            </label>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {loading ? <LoadingSkeleton /> : error ? (
          <EmptyState title="Failed to load clients" message={error} />
        ) : emptyState ? (
          <EmptyState title={emptyState.title} message={emptyState.message} />
        ) : (
          <Table
            columns={columns}
            data={clients}
            onRowClick={(row) => toggleClientExpanded(row.id)}
            isRowExpanded={(row) => expandedClientIds.includes(row.id)}
            renderExpandedRow={renderExpandedOrders}
          />
        )}
      </Card>

      {pagination && pagination.total > pagination.limit ? (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page <= 1}
            className="rounded-lg bg-glass px-4 py-2 text-sm text-white/70 transition-colors hover:bg-glass-hover disabled:cursor-not-allowed disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-sm text-white/50">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={page >= totalPages}
            className="rounded-lg bg-glass px-4 py-2 text-sm text-white/70 transition-colors hover:bg-glass-hover disabled:cursor-not-allowed disabled:opacity-30"
          >
            Next
          </button>
        </div>
      ) : null}
    </motion.div>
  );
}
