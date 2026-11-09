import { useEffect, useState } from "react";
import Card from "../components/Card";
import { api } from "../lib/api";

interface ExpressOrderView {
  id: string;
  serviceName: string;
  customerName: string;
  customerEmail: string;
  amountCents: number;
  transcription: boolean;
  fulfillmentStatus: string;
  deliveryDate: string | null;
  deadlineAt: string | null;
  refundReview: boolean;
  intake: {
    birthdate: string;
    guide: string;
    question: string;
    focusAreas: string[];
    healingContext: string;
    pastLifeInterest: string;
  };
}

const SAMPLE: ExpressOrderView = {
  id: "preview-sample",
  serviceName: "Past Life Akashic Reading",
  customerName: "Sample client",
  customerEmail: "sample@example.com",
  amountCents: 5800,
  transcription: true,
  fulfillmentStatus: "awaiting_fulfillment",
  deliveryDate: "2026-11-10",
  deadlineAt: "2026-11-11T07:59:00.000Z",
  refundReview: false,
  intake: {
    birthdate: "1990-04-02",
    guide: "",
    question: "",
    focusAreas: [],
    healingContext: "",
    pastLifeInterest: "A coastal village",
  },
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(0)} CAD`;
}

export default function ExpressOrderQueue() {
  const [orders, setOrders] = useState<ExpressOrderView[]>([]);
  const [selectedId, setSelectedId] = useState<string>(SAMPLE.id);
  const [notice, setNotice] = useState("Checking the Express order service…");
  const [sampleMode, setSampleMode] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get("/admin/express/orders").then((response: { data?: ExpressOrderView[] }) => {
      if (cancelled) return;
      const rows = response.data ?? [];
      setOrders(rows);
      setSampleMode(false);
      setSelectedId(rows[0]?.id ?? "");
      setNotice(rows.length === 0 ? "No Express orders yet." : "");
    }).catch(() => {
      if (cancelled) return;
      setOrders([SAMPLE]);
      setSampleMode(true);
      setNotice("This preview is not connected to an isolated Express API. The row below is a labeled sample, not a customer order. Production was not changed.");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = orders.find((order) => order.id === selectedId) ?? orders[0];

  return (
    <div className="space-y-4">
      {notice ? <p className="rounded-2xl border border-amber-100/20 bg-amber-100/10 px-4 py-3 text-sm text-amber-50">{notice}</p> : null}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-white/80">
            <thead className="text-xs uppercase tracking-wide text-white/45">
              <tr>
                {["Order", "Service", "Customer", "Paid", "Deadline", "Status", "Transcription"].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-white/10">
                  <td className="px-4 py-3">
                    <button type="button" className="text-cyan-100 underline-offset-2 hover:underline" onClick={() => setSelectedId(order.id)}>{order.id}</button>
                  </td>
                  <td className="px-4 py-3">{order.serviceName}</td>
                  <td className="px-4 py-3">{order.customerName}</td>
                  <td className="px-4 py-3">{money(order.amountCents)}</td>
                  <td className="px-4 py-3">{order.deliveryDate ?? "—"}</td>
                  <td className="px-4 py-3">{order.refundReview ? "Refund review" : order.fulfillmentStatus.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">{order.transcription ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {selected ? (
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-xl font-semibold text-white">{selected.serviceName}</h2>
            <p className="text-sm text-slate-300">Deadline {selected.deliveryDate} at 11:59 PM Pacific. This date stays fixed after payment.</p>
          </div>
          <dl className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div><dt className="text-white/45">Customer</dt><dd>{selected.customerName}</dd></div>
            <div><dt className="text-white/45">Email</dt><dd>{selected.customerEmail}</dd></div>
            <div><dt className="text-white/45">Birthdate</dt><dd>{selected.intake.birthdate || "—"}</dd></div>
            <div><dt className="text-white/45">Guide</dt><dd>{selected.intake.guide || "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-white/45">Question</dt><dd className="whitespace-pre-wrap break-words">{selected.intake.question || "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-white/45">Focus or context</dt><dd className="whitespace-pre-wrap break-words">{selected.intake.focusAreas.join(", ") || selected.intake.healingContext || selected.intake.pastLifeInterest || "—"}</dd></div>
          </dl>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-300">Completed MP3
              <input className="mt-1 block w-full text-sm" type="file" accept="audio/mpeg,.mp3" disabled={sampleMode} />
            </label>
            <label className="text-sm text-slate-300">Written transcript {selected.transcription ? "(required)" : "(not purchased)"}
              <input className="mt-1 block w-full text-sm" type="file" accept=".txt,.pdf,.docx" disabled={sampleMode || !selected.transcription} />
            </label>
          </div>
          <button type="button" disabled={sampleMode} className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-cyan-300 to-violet-300 px-5 py-3 text-sm font-semibold text-[#07111f] disabled:opacity-50">
            Deliver Session
          </button>
          {sampleMode ? <p className="text-xs text-white/45">Upload and delivery run on the isolated API. A missing MP3, or a missing transcript when one was purchased, blocks delivery.</p> : null}
        </Card>
      ) : null}
    </div>
  );
}
