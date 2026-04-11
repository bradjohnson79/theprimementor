import type { OrderStatus } from "../lib/orders";

const STATUS_STYLES: Record<OrderStatus, string> = {
  unpaid: "border-slate-400/25 bg-slate-400/10 text-slate-200",
  pending_payment: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  paid: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  in_progress: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  processing: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  completed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  cancelled: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  refunded: "border-slate-400/25 bg-slate-400/10 text-slate-200",
  failed: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  unpaid: "Unpaid",
  pending_payment: "Pending Payment",
  paid: "Paid",
  in_progress: "In Progress",
  processing: "Processing",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
