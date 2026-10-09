import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@clerk/react";
import { api } from "../../lib/api";
import { resolveApiUrl } from "../../lib/apiBase";
import {
  AVAILABILITY_DAYS,
  AVAILABILITY_DAY_LABELS,
  AVAILABILITY_SLOTS,
  type AvailabilityDay,
} from "../../routes/bookings.constants";

type Slot = "alignment" | "reinforcement";
type Availability = Record<AvailabilityDay, string[]>;

interface ConsultationState {
  role: string;
  timing: string;
  durationMinutes: number;
  status: string;
  availability: Availability | null;
}

interface PeriodBenefit {
  periodStart: string;
  periodEnd: string | null;
  consultations: Record<Slot, ConsultationState>;
  ideogram: {
    status: string;
    fileName: string | null;
    downloadable: boolean;
  };
  safeguardingIncluded: boolean;
}

function emptyAvailability(): Availability {
  return { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [] };
}

function formatTime(time: string) {
  const [hourText, minute] = time.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

export default function ManifestationPeriodPanel() {
  const { getToken } = useAuth();
  const [benefit, setBenefit] = useState<PeriodBenefit | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [availability, setAvailability] = useState<Availability>(emptyAvailability);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const response = await api.get("/member/regeneration-subscription/period-benefit", token) as { data?: PeriodBenefit | null };
        if (!cancelled) setBenefit(response.data ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "The monthly package details could not be loaded.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  async function schedule(event: FormEvent) {
    event.preventDefault();
    if (!slot) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      const response = await api.post("/member/regeneration-subscription/consultations", {
        slot,
        availability,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      }, token) as { data: PeriodBenefit };
      setBenefit(response.data);
      setSlot(null);
      setAvailability(emptyAvailability());
      setMessage("Availability received. Brad will schedule this 15-minute consultation inside the current monthly period.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The consultation could not be scheduled.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadIdeogram() {
    const token = await getToken();
    const response = await fetch(resolveApiUrl("/member/regeneration-subscription/ideogram"), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      setError("Your ideogram circuit is not ready yet.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = benefit?.ideogram.fileName || "ideogram-circuit";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!benefit) {
    if (!error) return null;
    return (
      <section className="dashboard-panel cosmic-motion lg:col-span-2 xl:col-span-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Manifestation Monthly Package</h2>
        <p className="mt-3 text-sm text-rose-200">{error}</p>
      </section>
    );
  }

  return (
    <section className="dashboard-panel cosmic-motion lg:col-span-2 xl:col-span-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Manifestation Monthly Package</h2>
      <p className="mt-3 text-lg font-semibold text-white">Two consultations and your personal circuit</p>
      <p className="mt-2 text-sm leading-6 text-white/65">
        Each active month includes Manifestation Alignment at the beginning and Manifestation Reinforcement about halfway through.
        Both remain 15-minute Zoom consultations. Manifestation safeguarding stays included.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {(Object.entries(benefit.consultations) as Array<[Slot, ConsultationState]>).map(([key, consultation]) => (
          <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold text-white">{consultation.role}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-cyan-100/70">{consultation.timing}</p>
            <p className="mt-2 text-sm text-white/70">{consultation.durationMinutes} minutes · {consultation.status}</p>
            {consultation.status === "available" ? (
              <button
                type="button"
                onClick={() => {
                  setSlot(key);
                  setAvailability(emptyAvailability());
                }}
                className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-amber-300 px-4 text-sm font-semibold text-slate-950"
              >
                Share availability
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/75">
        <p>Ideogram circuit: {benefit.ideogram.status}</p>
        <p className="mt-1">Manifestation safeguarding: {benefit.safeguardingIncluded ? "Included" : "Not included"}</p>
        {benefit.ideogram.downloadable ? (
          <button type="button" onClick={() => void downloadIdeogram()} className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-amber-200/40 px-4 text-sm font-semibold text-amber-100">
            Download your circuit
          </button>
        ) : (
          <p className="mt-2 text-white/55">Brad personally creates the circuit and delivers it here for this monthly period.</p>
        )}
      </div>
      {slot ? (
        <form onSubmit={(event) => void schedule(event)} className="mt-4 space-y-3">
          <p className="text-sm text-white/70">Select the windows that work for {benefit.consultations[slot].role}.</p>
          {AVAILABILITY_DAYS.map((day) => (
            <div key={day} className="flex flex-wrap gap-2">
              <span className="w-24 text-xs uppercase tracking-wide text-white/45">{AVAILABILITY_DAY_LABELS[day]}</span>
              {AVAILABILITY_SLOTS[day].map((time) => {
                const active = availability[day].includes(time);
                return (
                  <button
                    key={`${day}-${time}`}
                    type="button"
                    onClick={() => setAvailability((current) => ({
                      ...current,
                      [day]: active ? current[day].filter((item) => item !== time) : [...current[day], time],
                    }))}
                    className={`rounded-full border px-3 py-1 text-xs ${active ? "border-amber-200 bg-amber-300 text-slate-950" : "border-white/15 text-white/70"}`}
                  >
                    {formatTime(time)}
                  </button>
                );
              })}
            </div>
          ))}
          <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center rounded-xl bg-amber-300 px-4 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {saving ? "Saving…" : "Schedule this consultation"}
          </button>
        </form>
      ) : null}
      {message ? <p className="mt-3 text-sm text-emerald-200">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
    </section>
  );
}
