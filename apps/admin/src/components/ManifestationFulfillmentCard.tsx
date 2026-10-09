import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import Card from "./Card";
import { api } from "../lib/api";

interface PeriodBenefit {
  consultations: {
    alignment: { role: string; status: string };
    reinforcement: { role: string; status: string };
  };
  ideogram: { status: string; fileName: string | null };
  safeguardingIncluded: boolean;
  periodStart: string;
  periodEnd: string | null;
}

export default function ManifestationFulfillmentCard({ userId }: { userId: string }) {
  const { getToken } = useAuth();
  const [benefit, setBenefit] = useState<PeriodBenefit | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const token = await getToken();
    const response = await api.get(`/admin/regeneration-subscriptions/${userId}/period-benefit`, token) as { data?: PeriodBenefit | null };
    setBenefit(response.data ?? null);
  }

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Fulfillment could not be loaded."));
  }, [userId]);

  async function update(patch: { alignmentStatus?: string; reinforcementStatus?: string; ideogramStatus?: string }) {
    setError(null);
    const token = await getToken();
    const response = await api.patch(`/admin/regeneration-subscriptions/${userId}/period-benefit`, patch, token) as { data: PeriodBenefit };
    setBenefit(response.data);
    setMessage("Fulfillment updated.");
  }

  async function upload(file: File) {
    setError(null);
    const token = await getToken();
    const body = new FormData();
    body.append("file", file);
    const response = await api.postForm(`/admin/regeneration-subscriptions/${userId}/ideogram`, body, token) as { data: PeriodBenefit };
    setBenefit(response.data);
    setMessage("Ideogram circuit delivered to the client.");
  }

  return (
    <Card>
      <p className="text-xs uppercase tracking-[0.28em] text-white/40">Manifestation fulfillment</p>
      <h3 className="mt-2 text-lg font-semibold text-white">Current monthly period</h3>
      {!benefit ? <p className="mt-3 text-sm text-white/55">No active period yet. Existing billing is unchanged.</p> : (
        <div className="mt-4 space-y-3 text-sm text-white/75">
          <p>Period: {new Date(benefit.periodStart).toLocaleDateString()}{benefit.periodEnd ? ` – ${new Date(benefit.periodEnd).toLocaleDateString()}` : ""}</p>
          <p>Safeguarding: {benefit.safeguardingIncluded ? "Included" : "Not included"}</p>
          <label className="block">
            Consultation One — {benefit.consultations.alignment.role}
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2"
              value={benefit.consultations.alignment.status}
              onChange={(event) => void update({ alignmentStatus: event.target.value })}
            >
              <option value="available">Available</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="block">
            Consultation Two — {benefit.consultations.reinforcement.role}
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2"
              value={benefit.consultations.reinforcement.status}
              onChange={(event) => void update({ reinforcementStatus: event.target.value })}
            >
              <option value="available">Available</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="block">
            Ideogram circuit — {benefit.ideogram.status}{benefit.ideogram.fileName ? ` · ${benefit.ideogram.fileName}` : ""}
            <input
              className="mt-2 block w-full text-sm"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </label>
        </div>
      )}
      {message ? <p className="mt-3 text-sm text-emerald-200">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
    </Card>
  );
}
