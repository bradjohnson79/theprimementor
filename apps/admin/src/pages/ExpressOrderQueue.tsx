import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import Card from "../components/Card";
import EmptyState from "../components/EmptyState";
import { api } from "../lib/api";

interface ExpressOrderRow {
  id: string;
  serviceName: string;
  customerName: string;
  customerEmail: string;
  amountCents: number;
  transcription: boolean;
  quantity: number;
  fulfillmentStatus: string;
  paidAt: string;
  deliveryDate: string | null;
}

function money(cents: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}

function when(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function ExpressOrderQueue({ search }: { search: string }) {
  const { getToken } = useAuth();
  const [orders, setOrders] = useState<ExpressOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const response = await api.get("/admin/express/orders", token) as { data?: ExpressOrderRow[] };
        if (!cancelled) setOrders(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load Express orders.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const query = search.trim().toLowerCase();
  const visible = query
    ? orders.filter((order) => [order.customerName, order.customerEmail, order.serviceName, order.id].join(" ").toLowerCase().includes(query))
    : orders;

  if (loading) {
    return <Card className="p-6 text-sm text-white/60">Loading Express orders…</Card>;
  }
  if (error) {
    return <Card className="p-6 text-sm text-rose-200">{error}</Card>;
  }
  if (visible.length === 0) {
    return (
      <Card className="overflow-hidden p-0">
        <EmptyState
          title={query ? "No matching Express orders" : "No Express orders yet"}
          message={query ? "No Express purchase matches that search." : "Paid Express orders will appear here."}
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-white/80">
          <thead className="text-xs uppercase tracking-wide text-white/45">
            <tr>
              {["Service", "Customer", "Email", "Paid", "Amount", "Quantity", "Transcription", "Delivery", "Status"].map((heading) => (
                <th key={heading} className="px-4 py-3 font-medium">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((order) => (
              <tr key={order.id} className="border-t border-white/10">
                <td className="px-4 py-3">{order.serviceName}</td>
                <td className="px-4 py-3">{order.customerName}</td>
                <td className="px-4 py-3">{order.customerEmail}</td>
                <td className="px-4 py-3">{when(order.paidAt)}</td>
                <td className="px-4 py-3">{money(order.amountCents)}</td>
                <td className="px-4 py-3">{order.quantity}</td>
                <td className="px-4 py-3">{order.transcription ? "Yes" : "No"}</td>
                <td className="px-4 py-3">{order.deliveryDate ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{order.fulfillmentStatus.replace(/_/g, " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
