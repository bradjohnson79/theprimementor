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
  const [delayMessage, setDelayMessage] = useState("I need a little more time to complete this session.");
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
      setNotice(`Resend accepted the session email to ${selected.customerEmail}.`);
      setOrders((current) => current.map((order) => order.id === selected.id ? { ...order, fulfillmentStatus: "delivered" } : order));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The email did not send.");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  async function sendDelay() {
    if (!selected) return;
    setBusy(true);
    try {
      const token = await getToken();
      await api.post(`/admin/express/orders/${encodeURIComponent(selected.id)}/delay`, { message: delayMessage }, token);
      setNotice(`Resend accepted the delay email to ${selected.customerEmail}. The original due date is unchanged.`);
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
      {!selected ? (
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
                    <td className="px-4 py-3">{order.refundReview ? "Refund review" : order.fulfillmentStatus.replace(/_/g, " ")}</td>
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
            <p className="text-sm text-slate-300">Due {selected.deliveryDate} at 11:59 PM Pacific. This date stays fixed.</p>
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
              <button type="button" disabled={busy} onClick={requestSend} className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-cyan-300 to-violet-300 px-5 py-3 text-sm font-semibold text-[#07111f] disabled:opacity-50">
                Send
              </button>
            </>
          ) : (
            <>
              <label className="block text-sm text-slate-300">Message to the client
                <textarea className="mt-1 min-h-28 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white" value={delayMessage} onChange={(event) => setDelayMessage(event.target.value)} />
              </label>
              <button type="button" disabled={busy || delayMessage.trim().length === 0} onClick={() => setConfirming("delay")} className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-cyan-300 to-violet-300 px-5 py-3 text-sm font-semibold text-[#07111f] disabled:opacity-50">
                Send
              </button>
            </>
          )}
        </Card>
      )}
      {confirming && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="max-w-md space-y-4 p-5">
            <h2 className="text-lg font-semibold text-white">{confirming === "send" ? "Send this session?" : "Send a delay notice?"}</h2>
            <p className="text-sm text-slate-300">
              {confirming === "send"
                ? `Resend will email the MP3 link to ${selected.customerEmail}.`
                : `Resend will email ${selected.customerEmail} that this order needs more time. The due date stays ${selected.deliveryDate}.`}
            </p>
            <div className="flex gap-3">
              <button type="button" disabled={busy} className="rounded-full bg-cyan-200 px-4 py-2 text-sm font-semibold text-[#07111f]" onClick={() => void (confirming === "send" ? uploadAndSend() : sendDelay())}>
                {busy ? "Sending…" : "Send"}
              </button>
              <button type="button" disabled={busy} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white" onClick={() => setConfirming(null)}>Cancel</button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
