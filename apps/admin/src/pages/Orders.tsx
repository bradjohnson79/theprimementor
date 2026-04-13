import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import Table from "../components/Table";
import Card from "../components/Card";
import Loading from "../components/Loading";
import EmptyState from "../components/EmptyState";
import OrderStatusBadge from "../components/OrderStatusBadge";
import { api } from "../lib/api";
import type { AdminClientsResponse, ClientOption } from "../lib/clients";
import { toClientOption } from "../lib/clients";
import type { AdminInvoiceResponse, AdminOrder, AdminOrderArchiveResponse, AdminOrdersResponse, OrderType } from "../lib/orders";
import { ORDER_TYPE_TABS, formatOrderDate, formatOrderMoney, getOrderServiceLabel, getOrderTypeLabel } from "../lib/orders";

interface OrderColumn {
  key: keyof AdminOrder;
  label: ReactNode;
  render?: (value: AdminOrder[keyof AdminOrder], row: AdminOrder) => React.ReactNode;
}

const PAGE_SIZE = 25;
const MODE_TABS = [
  { id: "orders" as const, label: "Orders" },
  { id: "create_invoice" as const, label: "Create Invoice" },
];
const PRODUCT_TYPES: Array<{ id: OrderType; label: string }> = [
  { id: "session", label: "Session" },
  { id: "report", label: "Report" },
  { id: "subscription", label: "Subscription" },
  { id: "webinar", label: "Webinar" },
  { id: "custom", label: "Custom" },
];
const TRAINING_PACKAGE_FILTERS = [
  { id: "all", label: "All Packages" },
  { id: "entry", label: "Entry" },
  { id: "seeker", label: "Seeker" },
  { id: "initiate", label: "Initiate" },
] as const;
const TRAINING_STATUS_FILTERS = [
  { id: "all", label: "All Statuses" },
  { id: "pending_payment", label: "Pending Payment" },
  { id: "paid", label: "Paid" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

const baseColumns: OrderColumn[] = [
  { key: "id" as const, label: "Order ID" },
  { key: "client_name" as const, label: "Client Name" },
  { key: "email" as const, label: "Email" },
  {
    key: "type" as const,
    label: "Order Type",
    render: (_value: AdminOrder[keyof AdminOrder], row: AdminOrder) => getOrderTypeLabel(row.type),
  },
  {
    key: "membership_tier" as const,
    label: "Service",
    render: (_value: AdminOrder[keyof AdminOrder], row: AdminOrder) => getOrderServiceLabel(row),
  },
  {
    key: "status" as const,
    label: "Status",
    render: (_value: AdminOrder[keyof AdminOrder], row: AdminOrder) => (
      <div className="space-y-1">
        <OrderStatusBadge status={row.status} />
        {row.archived ? (
          <p className="inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white/60">
            Archived
          </p>
        ) : null}
        {row.status === "failed" && row.metadata.failure_message_normalized ? (
          <p className="max-w-[18rem] text-xs text-rose-200/80">{row.metadata.failure_message_normalized}</p>
        ) : null}
      </div>
    ),
  },
  {
    key: "amount" as const,
    label: "Amount",
    render: (_value: AdminOrder[keyof AdminOrder], row: AdminOrder) => formatOrderMoney(row.amount, row.currency),
  },
  {
    key: "created_at" as const,
    label: "Date",
    render: (value: AdminOrder[keyof AdminOrder]) => formatOrderDate(String(value ?? "")),
  },
];

export default function Orders() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<"orders" | "create_invoice">("orders");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | OrderType>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);
  const [trainingActionSubmitting, setTrainingActionSubmitting] = useState<null | "in_progress" | "completed">(null);
  const [trainingPackageFilter, setTrainingPackageFilter] = useState<"all" | "entry" | "seeker" | "initiate">("all");
  const [trainingStatusFilter, setTrainingStatusFilter] = useState<"all" | "pending_payment" | "paid" | "in_progress" | "completed" | "cancelled">("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<AdminOrdersResponse["pagination"] | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [invoiceForm, setInvoiceForm] = useState({
    clientId: "",
    productType: "session" as OrderType,
    customLabel: "",
    amount: "",
  });
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoiceSuccess, setInvoiceSuccess] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    if (requestedMode === "create_invoice") {
      setMode("create_invoice");
      return;
    }
    setMode("orders");
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const offset = (page - 1) * PAGE_SIZE;
        const response = (await api.get(
          `/admin/orders?limit=${PAGE_SIZE}&offset=${offset}&showArchived=${showArchived ? "true" : "false"}`,
          token,
        )) as AdminOrdersResponse;
        if (!cancelled) {
          setOrders(response.data);
          setPagination(response.pagination);
          setSelectedOrderIds([]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load orders.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOrders();
    return () => {
      cancelled = true;
    };
  }, [getToken, page, showArchived]);

  useEffect(() => {
    let cancelled = false;

    async function loadClients() {
      setClientsLoading(true);
      try {
        const token = await getToken();
        const response = await api.get("/clients?limit=100&offset=0&activeOnly=false", token) as AdminClientsResponse;
        if (!cancelled) {
          setClients((response.clients ?? []).map(toClientOption));
        }
      } catch (err) {
        if (!cancelled) {
          setInvoiceError(err instanceof Error ? err.message : "Failed to load clients.");
        }
      } finally {
        if (!cancelled) {
          setClientsLoading(false);
        }
      }
    }

    void loadClients();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const filteredOrders = useMemo(() => {
    const typeFiltered = activeTab === "all" ? orders : orders.filter((order) => order.type === activeTab);
    if (activeTab !== "mentor_training") {
      return typeFiltered;
    }

    return typeFiltered.filter((order) => {
      const packageMatches = trainingPackageFilter === "all" || order.metadata.training_package_id === trainingPackageFilter;
      const statusMatches = trainingStatusFilter === "all" || order.status === trainingStatusFilter;
      return packageMatches && statusMatches;
    });
  }, [activeTab, orders, trainingPackageFilter, trainingStatusFilter]);
  const selectedVisibleOrders = filteredOrders.filter((order) => selectedOrderIds.includes(order.id));
  const allVisibleSelected = filteredOrders.length > 0 && selectedVisibleOrders.length === filteredOrders.length;
  const selectedArchivedCount = selectedVisibleOrders.filter((order) => order.archived).length;
  const shouldUnarchiveSelection = selectedVisibleOrders.length > 0 && selectedArchivedCount === selectedVisibleOrders.length;
  const hasMixedArchiveSelection = selectedVisibleOrders.length > 0
    && selectedArchivedCount > 0
    && selectedArchivedCount < selectedVisibleOrders.length;
  const allSelectedVisibleAreTraining = selectedVisibleOrders.length > 0
    && selectedVisibleOrders.every((order) => order.type === "mentor_training");
  const orderColumns = useMemo<OrderColumn[]>(
    () => [
      {
        key: "source_id",
        label: (
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={(event) => {
              const visibleIds = filteredOrders.map((order) => order.id);
              setSelectedOrderIds((current) => {
                if (event.target.checked) {
                  return Array.from(new Set([...current, ...visibleIds]));
                }
                return current.filter((id) => !visibleIds.includes(id));
              });
            }}
            aria-label="Select all visible orders"
          />
        ),
        render: (_value, row) => (
          <input
            type="checkbox"
            checked={selectedOrderIds.includes(row.id)}
            onChange={(event) => {
              event.stopPropagation();
              setSelectedOrderIds((current) =>
                event.target.checked ? Array.from(new Set([...current, row.id])) : current.filter((id) => id !== row.id));
            }}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Select order ${row.id}`}
          />
        ),
      },
      ...baseColumns,
    ],
    [allVisibleSelected, filteredOrders, selectedOrderIds],
  );

  const visibleClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) =>
      `${client.full_birth_name} ${client.email}`.toLowerCase().includes(query));
  }, [clientSearch, clients]);

  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.limit)) : 1;

  async function handleCreateInvoice() {
    setInvoiceSubmitting(true);
    setInvoiceError(null);
    setInvoiceSuccess(null);
    setCreatedLink(null);

    try {
      const token = await getToken();
      const response = await api.post("/admin/invoices", {
        clientId: invoiceForm.clientId,
        productType: invoiceForm.productType,
        customLabel: invoiceForm.customLabel || null,
        amount: Number(invoiceForm.amount),
      }, token) as AdminInvoiceResponse;
      setInvoiceSuccess("Payment link created.");
      setCreatedLink(response.data.stripe_payment_link);
      setInvoiceForm((current) => ({
        ...current,
        customLabel: current.productType === "custom" ? current.customLabel : "",
        amount: "",
      }));
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : "Failed to create invoice.");
    } finally {
      setInvoiceSubmitting(false);
    }
  }

  async function handleCopyLink() {
    if (!createdLink) return;
    await navigator.clipboard.writeText(createdLink);
    setInvoiceSuccess("Payment link copied.");
  }

  async function handleArchiveSelection() {
    if (selectedVisibleOrders.length === 0 || hasMixedArchiveSelection) {
      return;
    }

    if (!shouldUnarchiveSelection) {
      const confirmed = window.confirm("This will remove selected items from active views. Continue?");
      if (!confirmed) {
        return;
      }
    }

    setArchiveSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      await api.post("/admin/orders/archive", {
        orderIds: selectedVisibleOrders.map((order) => order.id),
        archived: !shouldUnarchiveSelection,
      }, token) as AdminOrderArchiveResponse;
      setSelectedOrderIds([]);
      const offset = (page - 1) * PAGE_SIZE;
      const response = (await api.get(
        `/admin/orders?limit=${PAGE_SIZE}&offset=${offset}&showArchived=${showArchived ? "true" : "false"}`,
        token,
      )) as AdminOrdersResponse;
      setOrders(response.data);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update archive state.");
    } finally {
      setArchiveSubmitting(false);
    }
  }

  async function handleTrainingStatusUpdate(status: "in_progress" | "completed") {
    if (!allSelectedVisibleAreTraining || selectedVisibleOrders.length === 0) {
      return;
    }

    setTrainingActionSubmitting(status);
    setError(null);
    try {
      const token = await getToken();
      await Promise.all(selectedVisibleOrders.map((order) =>
        api.patch(`/admin/mentor-training/${order.source_id}/status`, { status }, token)));
      setSelectedOrderIds([]);
      const offset = (page - 1) * PAGE_SIZE;
      const response = (await api.get(
        `/admin/orders?limit=${PAGE_SIZE}&offset=${offset}&showArchived=${showArchived ? "true" : "false"}`,
        token,
      )) as AdminOrdersResponse;
      setOrders(response.data);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update mentor training status.");
    } finally {
      setTrainingActionSubmitting(null);
    }
  }

  if (loading) {
    return <Loading />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-white">Orders</h2>
        <p className="mt-1 text-white/50">
          {mode === "orders" ? "All client purchases and transactions." : "Generate a Stripe Payment Link for a client."}
          {pagination ? <span className="ml-2 text-white/30">({pagination.total} total)</span> : null}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {MODE_TABS.map((tab) => {
          const isActive = tab.id === mode;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMode(tab.id);
                setSearchParams(tab.id === "create_invoice" ? { mode: "create_invoice" } : {});
              }}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                isActive
                  ? "border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan"
                  : "border-glass-border bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {mode === "orders" ? (
        <>
          <div className="flex flex-wrap gap-2">
            {ORDER_TYPE_TABS.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    isActive
                      ? "border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan"
                      : "border-glass-border bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "mentor_training" ? (
            <div className="flex flex-wrap gap-3">
              <label className="text-sm text-white/60">
                <span className="mb-1 block">Package</span>
                <select
                  value={trainingPackageFilter}
                  onChange={(event) => setTrainingPackageFilter(event.target.value as typeof trainingPackageFilter)}
                  className="rounded-xl border border-white/10 bg-[#0f1327] px-3 py-2 text-sm text-white outline-none transition focus:border-accent-cyan/40"
                >
                  {TRAINING_PACKAGE_FILTERS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-white/60">
                <span className="mb-1 block">Status</span>
                <select
                  value={trainingStatusFilter}
                  onChange={(event) => setTrainingStatusFilter(event.target.value as typeof trainingStatusFilter)}
                  className="rounded-xl border border-white/10 bg-[#0f1327] px-3 py-2 text-sm text-white outline-none transition focus:border-accent-cyan/40"
                >
                  {TRAINING_STATUS_FILTERS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-white/65">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => {
                  setShowArchived(event.target.checked);
                  setPage(1);
                }}
              />
              Show Archived
            </label>
            <button
              type="button"
              onClick={() => void handleArchiveSelection()}
              disabled={selectedVisibleOrders.length === 0 || hasMixedArchiveSelection || archiveSubmitting}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {archiveSubmitting ? "Updating..." : shouldUnarchiveSelection ? "Unarchive Selected" : "Archive Selected"}
            </button>
            {hasMixedArchiveSelection ? (
              <span className="text-sm text-amber-200/80">Select either archived or active rows, not both.</span>
            ) : null}
            {activeTab === "mentor_training" ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleTrainingStatusUpdate("in_progress")}
                  disabled={!allSelectedVisibleAreTraining || trainingActionSubmitting !== null}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {trainingActionSubmitting === "in_progress" ? "Updating..." : "Mark In Progress"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleTrainingStatusUpdate("completed")}
                  disabled={!allSelectedVisibleAreTraining || trainingActionSubmitting !== null}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {trainingActionSubmitting === "completed" ? "Updating..." : "Mark Completed"}
                </button>
              </>
            ) : null}
          </div>

          <Card className="overflow-hidden p-0">
            {orders.length === 0 ? (
              <EmptyState
                title="No orders yet"
                message="Orders will appear here as real purchases and registrations are created."
              />
            ) : filteredOrders.length === 0 ? (
              <EmptyState
                title="No matching orders"
                message="There are no orders of this type on the current page."
              />
            ) : (
              <Table
                columns={orderColumns}
                data={filteredOrders}
                onRowClick={(row) => navigate(`/admin/orders/${row.id}`)}
                getRowClassName={(row) => (row.archived ? "opacity-55" : "")}
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
        </>
      ) : (
        <Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label className="text-sm text-white/60">Search clients</label>
              <input
                type="text"
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
                placeholder="Search by name or email"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-accent-cyan/40"
              />
            </div>
            <div>
              <label className="text-sm text-white/60">Client</label>
              <select
                value={invoiceForm.clientId}
                onChange={(event) => setInvoiceForm((current) => ({ ...current, clientId: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1327] px-4 py-3 text-sm text-white outline-none transition focus:border-accent-cyan/40"
                disabled={clientsLoading}
              >
                <option value="">{clientsLoading ? "Loading clients..." : "Select a client"}</option>
                {visibleClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_birth_name} ({client.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-white/60">Product Type</label>
              <select
                value={invoiceForm.productType}
                onChange={(event) => setInvoiceForm((current) => ({
                  ...current,
                  productType: event.target.value as OrderType,
                  customLabel: event.target.value === "custom" ? current.customLabel : "",
                }))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1327] px-4 py-3 text-sm text-white outline-none transition focus:border-accent-cyan/40"
              >
                {PRODUCT_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-white/60">Amount (CAD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={invoiceForm.amount}
                onChange={(event) => setInvoiceForm((current) => ({ ...current, amount: event.target.value }))}
                placeholder="0.00"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-accent-cyan/40"
              />
            </div>
            {invoiceForm.productType === "custom" ? (
              <div className="lg:col-span-2">
                <label className="text-sm text-white/60">Custom Label</label>
                <input
                  type="text"
                  value={invoiceForm.customLabel}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, customLabel: event.target.value }))}
                  placeholder="Describe the invoice"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-accent-cyan/40"
                />
              </div>
            ) : null}
          </div>

          {invoiceError ? (
            <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {invoiceError}
            </div>
          ) : null}
          {invoiceSuccess ? (
            <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {invoiceSuccess}
            </div>
          ) : null}

          {createdLink ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-white/65">Payment Link Created</p>
              <p className="mt-2 break-all text-sm text-white/85">{createdLink}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
                >
                  Copy Link
                </button>
                <button
                  type="button"
                  onClick={() => window.open(createdLink, "_blank", "noopener,noreferrer")}
                  className="rounded-xl border border-cyan-300/30 bg-gradient-to-r from-cyan-400/20 via-sky-400/20 to-violet-400/20 px-4 py-2 text-sm text-cyan-100 shadow-[0_0_24px_rgba(56,189,248,0.18)] transition hover:scale-[1.02] hover:shadow-[0_0_32px_rgba(99,102,241,0.24)]"
                >
                  Open Link
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <button
              type="button"
              onClick={() => void handleCreateInvoice()}
              disabled={
                invoiceSubmitting
                || !invoiceForm.clientId
                || Number(invoiceForm.amount) <= 0
                || (invoiceForm.productType === "custom" && !invoiceForm.customLabel.trim())
              }
              className="rounded-xl border border-cyan-300/30 bg-gradient-to-r from-cyan-400/20 via-sky-400/20 to-violet-400/20 px-5 py-3 text-sm font-medium text-cyan-100 shadow-[0_0_24px_rgba(56,189,248,0.18)] transition hover:scale-[1.02] hover:shadow-[0_0_32px_rgba(99,102,241,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {invoiceSubmitting ? "Generating..." : "Generate Payment Link"}
            </button>
          </div>
        </Card>
      )}
    </motion.div>
  );
}
