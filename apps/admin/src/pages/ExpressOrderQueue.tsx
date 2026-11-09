import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
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
  mp3Key: string | null;
  transcriptKey: string | null;
  refundReview: boolean;
  delayNotified?: boolean;
  intake: {
    birthdate: string;
    guide: string;
    question: string;
    focusAreas: string[];
    healingContext: string;
    pastLifeInterest: string;
  };
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(0)} CAD`;
}

function orderStatus(order: ExpressOrderView) {
  if (order.fulfillmentStatus === "delivered") return "Completed";
  if (order.refundReview) return "Refund review";
  return "Pending";
}

function upcomingBusinessDays() {
  const dates: Array<{ value: string; label: string }> = [];
  const cursor = new Date();
  for (let offset = 1; dates.length < 15 && offset < 40; offset += 1) {
    const day = new Date(cursor.getTime() + offset * 24 * 60 * 60 * 1000);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Vancouver", weekday: "short" }).format(day);
    if (weekday === "Sat" || weekday === "Sun") continue;
    dates.push({
      value: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", year: "numeric", month: "2-digit", day: "2-digit" }).format(day),
      label: new Intl.DateTimeFormat("en-US", { timeZone: "America/Vancouver", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(day),
    });
  }
  return dates;
}

function ordersFrom(response: { data?: ExpressOrderView[] | { data?: ExpressOrderView[] } }) {
  if (Array.isArray(response.data)) return response.data;
  if (response.data && Array.isArray(response.data.data)) return response.data.data;
  return [];
}

export default function ExpressOrderQueue() {
  const { getToken } = useAuth();
  const [params, setParams] = useSearchParams();
  const [orders, setOrders] = useState<ExpressOrderView[]>([]);
  const [notice, setNotice] = useState("Loading Express orders…");
  const [busy, setBusy] = useState(false);
  const [mp3, setMp3] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<File | null>(null);
  const [delayOrderId, setDelayOrderId] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState<"send" | "delay" | null>(null);
  const selectedId = params.get("order");
  const tab = params.get("expressTab") === "delay" ? "delay" : "orders";
  const selected = orders.find((order) => order.id === selectedId) ?? null;

  function updateQuery(next: Record<string, string | null>) {
    const copy = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) copy.set(key, value);
      else copy.delete(key);
    }
    setParams(copy);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const response = await api.get("/admin/express/orders", token) as { data?: ExpressOrderView[] | { data?: ExpressOrderView[] } };
        if (cancelled) return;
        const rows = ordersFrom(response);
        setOrders(rows);
        setNotice(rows.length === 0 ? "No Express orders yet." : "");
      } catch (error) {
        if (cancelled) return;
        setOrders([]);
        setNotice(error instanceof Error ? error.message : "Express orders could not be loaded.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  async function uploadAndSend() {
    if (!selected) return;
    setBusy(true);
    try {
      const token = await getToken();
      const sendFile = async (file: File, kind: "mp3" | "transcript") => {
        const body = new FormData();
        body.set("file", file);
        await api.postForm(`/admin/express/orders/${encodeURIComponent(selected.id)}/recording?kind=${kind}`, body, token);
      };
      if (mp3) await sendFile(mp3, "mp3");
      if (transcript) await sendFile(transcript, "transcript");
      await api.post(`/admin/express/orders/${encodeURIComponent(selected.id)}/deliver`, {}, token);
      setNotice(`Resend accepted the session email to ${selected.customerEmail}. This order is Completed.`);
      setOrders((current) => current.map((order) => order.id === selected.id ? { ...order, fulfillmentStatus: "delivered" } : order));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The email did not send.");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  async function sendDelay() {
    const order = orders.find((item) => item.id === delayOrderId);
    if (!order) return;
    setBusy(true);
    try {
      const token = await getToken();
      await api.post(`/admin/express/orders/${encodeURIComponent(order.id)}/delay`, { message: reason, completionDate }, token);
      setNotice(`The delay email was sent to ${order.customerEmail}. A receipt goes to bradjohnson79@gmail.com when the client’s mail service accepts it.`);
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, deliveryDate: completionDate, delayNotified: true, refundReview: false } : item));
      setReason("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The delay email did not send.");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  function requestSend() {
    if (!selected) return;
    if (!mp3 && !selected.mp3Key) {
      setNotice("Choose the completed MP3 before sending.");
      return;
    }
    if (selected.transcription && !transcript && !selected.transcriptKey) {
      setNotice("This order includes a transcript. Choose that file before sending.");
      return;
    }
    setConfirming("send");
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([["orders", "Orders"], ["delay", "Delay"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => updateQuery({ expressTab: id === "orders" ? null : id, order: null })}
            className={`rounded-full px-4 py-2 text-sm ${tab === id ? "bg-cyan-300/20 text-cyan-100" : "bg-white/5 text-white/70"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {notice ? <p className="rounded-2xl border border-amber-100/20 bg-amber-100/10 px-4 py-3 text-sm text-amber-50">{notice}</p> : null}
      {tab === "delay" ? (
        <DelayWizard
          orders={orders.filter((order) => orderStatus(order) === "Pending")}
          delayOrderId={delayOrderId}
          completionDate={completionDate}
          reason={reason}
          busy={busy}
          dates={upcomingBusinessDays()}
          onOrder={setDelayOrderId}
          onDate={setCompletionDate}
          onReason={setReason}
          onSubmit={() => setConfirming("delay")}
        />
      ) : !selected ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-white/80">
              <thead className="text-xs uppercase tracking-wide text-white/45">
                <tr>
                  {["Service", "Customer", "Email", "Paid", "Due", "Status", "Transcription"].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-medium">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-t border-white/10">
                    <td className="px-4 py-3">
                      <button type="button" className="text-left text-cyan-100 underline-offset-2 hover:underline" onClick={() => updateQuery({ order: order.id })}>
                        {order.serviceName}
                      </button>
                    </td>
                    <td className="px-4 py-3">{order.customerName}</td>
                    <td className="px-4 py-3">{order.customerEmail}</td>
                    <td className="px-4 py-3">{money(order.amountCents)}</td>
                    <td className="px-4 py-3">{order.deliveryDate ?? "—"}</td>
                    <td className="px-4 py-3">{orderStatus(order)}</td>
                    <td className="px-4 py-3">{order.transcription ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="space-y-4 p-5">
          <button type="button" className="text-sm text-cyan-100" onClick={() => updateQuery({ order: null })}>Back to Express orders</button>
          <div>
            <h2 className="text-xl font-semibold text-white">{selected.serviceName}</h2>
            <p className="text-sm text-slate-300">Due {selected.deliveryDate} at 11:59 PM Pacific. Status: {orderStatus(selected)}.</p>
          </div>
          <dl className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div><dt className="text-white/45">Customer</dt><dd>{selected.customerName}</dd></div>
            <div><dt className="text-white/45">Email</dt><dd>{selected.customerEmail}</dd></div>
            <div><dt className="text-white/45">Paid</dt><dd>{money(selected.amountCents)}</dd></div>
            <div><dt className="text-white/45">Transcription</dt><dd>{selected.transcription ? "Ordered" : "Not ordered"}</dd></div>
            <div><dt className="text-white/45">Birthdate</dt><dd>{selected.intake.birthdate || "—"}</dd></div>
            <div><dt className="text-white/45">Guide</dt><dd>{selected.intake.guide || "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-white/45">Question</dt><dd className="whitespace-pre-wrap break-words">{selected.intake.question || "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-white/45">Submitted details</dt><dd className="whitespace-pre-wrap break-words">{selected.intake.focusAreas.join(", ") || selected.intake.healingContext || selected.intake.pastLifeInterest || "—"}</dd></div>
          </dl>
          {tab === "orders" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-slate-300">MP3 audio
                  <input className="mt-1 block w-full text-sm" type="file" accept="audio/mpeg,.mp3" disabled={busy} onChange={(event) => setMp3(event.target.files?.[0] ?? null)} />
                </label>
                {selected.transcription ? (
                  <label className="text-sm text-slate-300">Text transcript
                    <input className="mt-1 block w-full text-sm" type="file" accept=".txt,.pdf,.docx,text/plain" disabled={busy} onChange={(event) => setTranscript(event.target.files?.[0] ?? null)} />
                  </label>
                ) : null}
              </div>
              <button type="button" disabled={busy || orderStatus(selected) === "Completed"} onClick={requestSend} className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-cyan-300 to-violet-300 px-5 py-3 text-sm font-semibold text-[#07111f] disabled:opacity-50">
                Send
              </button>
            </>
          ) : null}
        </Card>
      )}
      {confirming === "send" && selected ? (
        <ConfirmSend
          title="Send this session?"
          body={`Resend will email the MP3 link to ${selected.customerEmail}. The order will be marked Completed.`}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void uploadAndSend()}
        />
      ) : null}
      {confirming === "delay" ? (
        <ConfirmSend
          title="Submit this delay notice?"
          body={`Resend will email ${orders.find((order) => order.id === delayOrderId)?.customerEmail ?? "the client"} the new completion day and your reason. A receipt is sent to bradjohnson79@gmail.com when the client receives it.`}
          busy={busy}
          confirmLabel="Submit"
          onCancel={() => setConfirming(null)}
          onConfirm={() => void sendDelay()}
        />
      ) : null}
    </div>
  );
}

function DelayWizard({
  orders,
  delayOrderId,
  completionDate,
  reason,
  busy,
  dates,
  onOrder,
  onDate,
  onReason,
  onSubmit,
}: {
  orders: ExpressOrderView[];
  delayOrderId: string;
  completionDate: string;
  reason: string;
  busy: boolean;
  dates: Array<{ value: string; label: string }>;
  onOrder: (value: string) => void;
  onDate: (value: string) => void;
  onReason: (value: string) => void;
  onSubmit: () => void;
}) {
  const ready = Boolean(delayOrderId && completionDate && reason.trim());
  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Delay notice</h2>
        <p className="text-sm text-slate-300">Email a pending client the new completion day and the reason. Express orders stay non-refundable once this notice is sent.</p>
      </div>
      <label className="block text-sm text-slate-300">Express order
        <select className="mt-1 w-full rounded-2xl border border-white/10 bg-[#0b1220] px-3 py-2 text-white" value={delayOrderId} onChange={(event) => onOrder(event.target.value)}>
          <option value="">Select a pending order</option>
          {orders.map((order) => (
            <option key={order.id} value={order.id}>{order.serviceName} — {order.customerName}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-slate-300">New completion day
        <select className="mt-1 w-full rounded-2xl border border-white/10 bg-[#0b1220] px-3 py-2 text-white" value={completionDate} onChange={(event) => onDate(event.target.value)}>
          <option value="">Select a date</option>
          {dates.map((date) => (
            <option key={date.value} value={date.value}>{date.label}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-slate-300">Reason
        <textarea className="mt-1 min-h-28 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white" value={reason} onChange={(event) => onReason(event.target.value)} />
      </label>
      <button type="button" disabled={busy || !ready} onClick={onSubmit} className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-cyan-300 to-violet-300 px-5 py-3 text-sm font-semibold text-[#07111f] disabled:opacity-50">
        Submit
      </button>
    </Card>
  );
}

function ConfirmSend({
  title,
  body,
  busy,
  confirmLabel = "Send",
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  busy: boolean;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="max-w-md space-y-4 p-5">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-300">{body}</p>
        <div className="flex gap-3">
          <button type="button" disabled={busy} className="rounded-full bg-cyan-200 px-4 py-2 text-sm font-semibold text-[#07111f]" onClick={onConfirm}>
            {busy ? "Sending…" : confirmLabel}
          </button>
          <button type="button" disabled={busy} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white" onClick={onCancel}>Cancel</button>
        </div>
      </Card>
    </div>
  );
}
