import { useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import BirthPlaceAutocompleteField, { type ResolvedBirthPlace } from "./BirthPlaceAutocompleteField";

const AVAILABILITY_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
const AVAILABILITY_SLOTS = ["10:00", "11:00", "12:00", "15:00", "16:00", "17:00", "18:00"] as const;

interface GuestSessionBookingModalProps {
  open: boolean;
  onClose: () => void;
  bookingTypeId: string;
  itemLabel?: string;
}

/**
 * Guest intake for session bookings (Q&A, Mentoring, Email Session, Past Life, Prime Body
 * Healing) that need the same birth-data intake the signed-in Bookings.tsx form collects.
 * Posts straight to POST /api/guest/bookings — no account, no sign-in. The full weekly
 * availability grid from the signed-in form is simplified here to one preferred day + time;
 * this is an intentional, documented simplification of the guest path (see GUEST-CHECKOUT-PLAN.md)
 * and does not change the signed-in Bookings.tsx form at all.
 */
export default function GuestSessionBookingModal({ open, onClose, bookingTypeId, itemLabel }: GuestSessionBookingModalProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthPlace, setBirthPlace] = useState<ResolvedBirthPlace | null>(null);
  const [day, setDay] = useState<typeof AVAILABILITY_DAYS[number]>("monday");
  const [time, setTime] = useState<typeof AVAILABILITY_SLOTS[number]>("10:00");
  const [consentGiven, setConsentGiven] = useState(false);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!gender || !birthDate || !birthPlace || !consentGiven) {
      setError("Please fill in every field, including consent.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await api.post("/guest/bookings", {
        email,
        fullName: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        gender,
        birthDate,
        birthTime: birthTime.trim() || undefined,
        birthPlace: birthPlace.name,
        birthPlaceName: birthPlace.name,
        birthLat: birthPlace.lat,
        birthLng: birthPlace.lng,
        birthTimezone: birthPlace.timezone ?? undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        bookingTypeId,
        availability: { [day]: [time] },
        consentGiven: true,
        website: website.trim() || undefined,
      }) as { url?: string | null; requiresPayment?: boolean };
      if (data.url && data.requiresPayment !== false) {
        window.location.assign(data.url);
        return;
      }
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message.length <= 200 ? message : "Could not start checkout. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 overflow-y-auto" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.1),_transparent_48%),linear-gradient(180deg,rgba(9,13,24,0.98),rgba(4,6,15,0.97))] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">Continue as guest</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-white/50 hover:text-white">✕</button>
        </div>
        {itemLabel ? <p className="mt-1 text-sm text-white/60">{itemLabel}</p> : null}
        <p className="mt-2 text-xs text-white/55">No account needed. We'll email your confirmation and access links.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-amber-300/50 focus:outline-none" />
          <input type="text" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-amber-300/50 focus:outline-none" />
          <input type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-amber-300/50 focus:outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <select required value={gender} onChange={(e) => setGender(e.target.value as "male" | "female")}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white focus:border-amber-300/50 focus:outline-none">
              <option value="" disabled>Gender</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
            <input type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white focus:border-amber-300/50 focus:outline-none" />
          </div>
          <input type="time" placeholder="Birth time (optional)" value={birthTime} onChange={(e) => setBirthTime(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white focus:border-amber-300/50 focus:outline-none" />
          <BirthPlaceAutocompleteField value={birthPlace} onChange={setBirthPlace} required />
          <div className="grid grid-cols-2 gap-3">
            <select value={day} onChange={(e) => setDay(e.target.value as typeof AVAILABILITY_DAYS[number])}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white focus:border-amber-300/50 focus:outline-none">
              {AVAILABILITY_DAYS.map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
            </select>
            <select value={time} onChange={(e) => setTime(e.target.value as typeof AVAILABILITY_SLOTS[number])}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white focus:border-amber-300/50 focus:outline-none">
              {AVAILABILITY_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <label className="flex items-start gap-2 text-xs text-white/60">
            <input type="checkbox" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)} className="mt-0.5" />
            I consent to this session and the intake information collected for it.
          </label>
          <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          {error ? <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
          <button type="submit" disabled={busy}
            className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 via-orange-400 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {busy ? "Starting checkout…" : "Continue to payment"}
          </button>
        </form>
      </div>
    </div>
  );
}
