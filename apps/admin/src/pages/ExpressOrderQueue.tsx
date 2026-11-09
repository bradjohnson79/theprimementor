import Card from "../components/Card";

const SAMPLE_DEADLINE = "2026-11-10T07:59:00.000Z";

function timeRemaining(deadline: string) {
  const ms = Date.parse(deadline) - Date.now();
  if (Number.isNaN(ms)) return "—";
  if (ms < 0) return "Past deadline";
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  return days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`;
}

export default function ExpressOrderQueue() {
  const sample = {
    service: "Ask Brad / Adronis",
    customer: "Sample client",
    paidAt: "2026-11-08T20:00:00.000Z",
    deadline: SAMPLE_DEADLINE,
    payment: "paid",
    fulfillment: "awaiting fulfillment",
    transcription: "No",
    contact: "Email",
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-white/10 px-4 py-3 text-sm text-amber-100/90">
        Live Express orders stay on the isolated API. The row below is a labeled sample so the columns can be reviewed. It is not a customer order.
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-white/80">
          <thead className="text-xs uppercase tracking-wide text-white/45">
            <tr>
              {["Service", "Customer", "Paid", "Deadline", "Time remaining", "Payment", "Fulfillment", "Transcription", "Email"].map((heading) => (
                <th key={heading} className="px-4 py-3 font-medium">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-white/10">
              <td className="px-4 py-3">{sample.service}</td>
              <td className="px-4 py-3">{sample.customer}</td>
              <td className="px-4 py-3">{sample.paidAt}</td>
              <td className="px-4 py-3">{sample.deadline}</td>
              <td className="px-4 py-3">{timeRemaining(sample.deadline)}</td>
              <td className="px-4 py-3">{sample.payment}</td>
              <td className="px-4 py-3">{sample.fulfillment}</td>
              <td className="px-4 py-3">{sample.transcription}</td>
              <td className="px-4 py-3">{sample.contact}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
