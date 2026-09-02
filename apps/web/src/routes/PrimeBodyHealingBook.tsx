import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth, useUser } from "@clerk/react";
import { api } from "../lib/api";
import { startSessionCheckout } from "../lib/sessionCheckout";
import { trackCtaClick, trackEventOnce } from "../lib/analytics";
import { useGooglePlaces, type PlaceResult } from "../hooks/useGooglePlaces";
import { PRIME_BODY_HEALING_LANDING_PATH } from "../lib/sessionLandingPaths";

type DeliveryFormat = "live" | "prerecorded";
type Gender = "male" | "female";

const LEVEL_1_LIVE_ID = "prime-body-healing-level-1-live";
const LEVEL_1_PRERECORDED_ID = "prime-body-healing-level-1-prerecorded";
const LEVEL_2_ID = "prime-body-healing-level-2";

interface CreateBookingResponse {
  success?: boolean;
  bookingId?: string;
  requiresPayment?: boolean;
}

function normalizeText(value: string) {
  const trimmed = value.trim();
  return trimmed || "";
}

export default function PrimeBodyHealingBook() {
  const [searchParams] = useSearchParams();
  const requestedLevel = searchParams.get("level") === "2" ? 2 : 1;
  const { getToken } = useAuth();
  const { user } = useUser();

  const [level, setLevel] = useState<1 | 2>(requestedLevel);
  const [deliveryFormat, setDeliveryFormat] = useState<DeliveryFormat>("live");
  const [areas, setAreas] = useState(["", "", "", "", ""]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthTimeUnknown, setBirthTimeUnknown] = useState(false);
  const [birthPlace, setBirthPlace] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [concerns, setConcerns] = useState("");
  const [notes, setNotes] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setLevel(requestedLevel);
  }, [requestedLevel]);

  useEffect(() => {
    const nextName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || user?.fullName || "";
    const nextEmail = user?.primaryEmailAddress?.emailAddress || "";
    if (nextName && !fullName) setFullName(nextName);
    if (nextEmail && !email) setEmail(nextEmail);
  }, [user, fullName, email]);

  const {
    suggestions,
    isSearching,
    isResolving,
    error: placesError,
    selectSuggestion,
  } = useGooglePlaces(birthPlace, (place) => {
    setSelectedPlace(place);
    setBirthPlace(place.name);
  });

  const bookingTypeId = useMemo(() => {
    if (level === 2) return LEVEL_2_ID;
    return deliveryFormat === "live" ? LEVEL_1_LIVE_ID : LEVEL_1_PRERECORDED_ID;
  }, [level, deliveryFormat]);

  const priceLabel = level === 2 ? "$179 CAD" : "$79 CAD";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function validate() {
    if (!normalizeText(fullName)) return "Full name is required.";
    if (!normalizeText(email)) return "Email is required.";
    if (!gender) return "Gender is required.";
    if (!consentGiven) return "Consent is required.";
    if (level === 1 && !areas.some((area) => normalizeText(area))) {
      return "Enter at least one area to work on.";
    }
    if (level === 2) {
      if (!birthDate) return "Date of birth is required.";
      if (!selectedPlace || selectedPlace.name !== birthPlace.trim()) {
        return "Please select a birth location from the suggestions.";
      }
      if (!normalizeText(concerns)) return "Please share the concerns you would most like examined.";
    }
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsProcessing(true);
    try {
      const token = await getToken();
      const healingAreas = areas.map(normalizeText).filter(Boolean).slice(0, 5);
      const payload = {
        bookingTypeId,
        sessionType: "prime_body_healing",
        timezone,
        timezoneSource: "user" as const,
        fullName: normalizeText(fullName),
        email: normalizeText(email),
        gender,
        birthDate: level === 2 ? birthDate : undefined,
        birthTime: level === 2 && !birthTimeUnknown && birthTime ? birthTime : undefined,
        birthPlace: level === 2 ? selectedPlace?.name : undefined,
        birthPlaceName: level === 2 ? selectedPlace?.name : undefined,
        birthLat: level === 2 ? selectedPlace?.lat : undefined,
        birthLng: level === 2 ? selectedPlace?.lng : undefined,
        birthTimezone: level === 2 ? (selectedPlace?.timezone || timezone) : undefined,
        consentGiven: true,
        notes: normalizeText(notes) || undefined,
        intake: {
          type: "prime_body_healing",
          deliveryFormat: level === 2 ? "scan" : deliveryFormat,
          healingAreas,
          concerns: level === 2 ? normalizeText(concerns) : undefined,
          notes: normalizeText(notes) || undefined,
          birthDate: level === 2 ? birthDate : undefined,
          birthTime: level === 2 && !birthTimeUnknown && birthTime ? birthTime : undefined,
          birthPlace: level === 2 ? selectedPlace?.name : undefined,
        },
      };

      const raw = await api.post("/bookings", payload, token) as CreateBookingResponse & { data?: CreateBookingResponse };
      const bookingResponse = raw.data?.bookingId ? raw.data : raw;
      if (!bookingResponse.success || !bookingResponse.bookingId || bookingResponse.requiresPayment !== true) {
        throw new Error("Booking could not be created. Please try again.");
      }

      trackEventOnce(`analytics:session-booked:${bookingResponse.bookingId}`, "session_booked", {
        source: "prime_body_healing",
        sessionType: "prime_body_healing",
        bookingId: bookingResponse.bookingId,
        bookingTypeId,
      });
      trackCtaClick("checkout_started", "prime_body_healing", {
        bookingTypeId,
        href: "/create-checkout-session",
      });

      await startSessionCheckout(bookingResponse.bookingId, { token });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.");
    } finally {
      setIsProcessing(false);
    }
  }

  const fieldClass =
    "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-white/40 focus:border-amber-200/50 focus:outline-none";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-white">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-amber-200/70">Prime Body Healing</p>
      <h1 className="mt-2 text-3xl font-semibold">
        {level === 2 ? "Level 2 intake" : "Level 1 intake"}
      </h1>
      <p className="mt-2 text-sm text-white/60">
        {level === 2
          ? "Complete birth details and concerns. There is no live-session calendar. After purchase, Brad emails a delivery turnaround based on available dates."
          : "Choose live or pre-recorded delivery and enter up to five areas. Live sessions are not scheduled on this page — Brad emails a booking window after purchase."}
      </p>
      <p className="mt-3 text-lg font-medium text-amber-100">{priceLabel}</p>
      <Link to={PRIME_BODY_HEALING_LANDING_PATH} className="mt-2 inline-block text-sm text-white/55 underline">
        Back to Prime Body Healing
      </Link>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
        <fieldset className="rounded-2xl border border-white/10 p-4">
          <legend className="px-1 text-sm font-semibold">Level</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="radio" name="level" checked={level === 1} onChange={() => setLevel(1)} />
              Level 1 — $79 CAD
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="radio" name="level" checked={level === 2} onChange={() => setLevel(2)} />
              Level 2 — $179 CAD
            </label>
          </div>
        </fieldset>

        {level === 1 ? (
          <>
            <fieldset className="rounded-2xl border border-white/10 p-4">
              <legend className="px-1 text-sm font-semibold">Preferred format</legend>
              <div className="mt-2 space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="format"
                    checked={deliveryFormat === "live"}
                    onChange={() => setDeliveryFormat("live")}
                  />
                  Live 15-Minute Session
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="format"
                    checked={deliveryFormat === "prerecorded"}
                    onChange={() => setDeliveryFormat("prerecorded")}
                  />
                  Pre-Recorded MP3 Session
                </label>
              </div>
              <p className="mt-3 text-xs text-white/50">
                Live sessions are arranged by email after purchase. Pre-recorded work does not require a time slot.
              </p>
            </fieldset>

            <fieldset className="rounded-2xl border border-white/10 p-4">
              <legend className="px-1 text-sm font-semibold">Areas to work on</legend>
              <p className="mt-1 text-xs text-white/50">
                These may include physical areas, emotional concerns, energetic imbalances, recurring patterns or other areas you feel require attention. Only the first area is required.
              </p>
              <div className="mt-3 space-y-2">
                {areas.map((area, index) => (
                  <input
                    key={index}
                    className={fieldClass}
                    value={area}
                    onChange={(event) => {
                      const next = [...areas];
                      next[index] = event.target.value;
                      setAreas(next);
                    }}
                    placeholder={`Area ${index + 1}${index === 0 ? "" : " (optional)"}`}
                    aria-label={`Healing area ${index + 1}`}
                  />
                ))}
              </div>
            </fieldset>
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span>Date of birth</span>
                <input className={fieldClass} type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required />
              </label>
              <label className="space-y-1 text-sm">
                <span>Birth time {birthTimeUnknown ? "(unknown)" : "(optional)"}</span>
                <input
                  className={fieldClass}
                  type="time"
                  value={birthTime}
                  disabled={birthTimeUnknown}
                  onChange={(event) => setBirthTime(event.target.value)}
                />
                <label className="mt-2 flex items-center gap-2 text-xs text-white/55">
                  <input
                    type="checkbox"
                    checked={birthTimeUnknown}
                    onChange={(event) => {
                      setBirthTimeUnknown(event.target.checked);
                      if (event.target.checked) setBirthTime("");
                    }}
                  />
                  I do not know my exact birth time. Exact time improves natal analysis.
                </label>
              </label>
            </div>
            <label className="block space-y-1 text-sm">
              <span>Birth location</span>
              <input
                className={fieldClass}
                value={birthPlace}
                onChange={(event) => {
                  setBirthPlace(event.target.value);
                  setSelectedPlace(null);
                }}
                placeholder="Start typing and select your birthplace"
                autoComplete="off"
              />
              {suggestions.length > 0 ? (
                <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-slate-950/95">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.placeId}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => void selectSuggestion(suggestion)}
                      className="block w-full border-b border-white/5 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-white/5"
                    >
                      <span className="block font-medium">{suggestion.primaryText}</span>
                      {suggestion.secondaryText ? (
                        <span className="mt-1 block text-xs text-white/45">{suggestion.secondaryText}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
              {isSearching || isResolving ? <span className="text-xs text-white/45">Looking up places…</span> : null}
              {placesError ? <span className="text-xs text-rose-300">{placesError}</span> : null}
            </label>
            <label className="block space-y-1 text-sm">
              <span>Current concerns</span>
              <textarea
                className={`${fieldClass} min-h-28`}
                value={concerns}
                onChange={(event) => setConcerns(event.target.value)}
                placeholder="What would you most like examined?"
              />
            </label>
          </>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>Full name</span>
            <input className={fieldClass} value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span>Email</span>
            <input className={fieldClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
        </div>
        <fieldset className="text-sm">
          <legend className="mb-2 font-medium">Gender</legend>
          <div className="flex gap-4">
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="gender" checked={gender === "female"} onChange={() => setGender("female")} />
              Female
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="gender" checked={gender === "male"} onChange={() => setGender("male")} />
              Male
            </label>
          </div>
        </fieldset>
        <label className="block space-y-1 text-sm">
          <span>Optional notes</span>
          <textarea className={`${fieldClass} min-h-24`} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <label className="flex items-start gap-3 text-sm text-white/70">
          <input type="checkbox" className="mt-1" checked={consentGiven} onChange={(event) => setConsentGiven(event.target.checked)} />
          <span>
            I understand Prime Body Healing is an energetic and intuitive wellness service and is not medical diagnosis or treatment.
          </span>
        </label>

        {error ? <p className="text-sm text-rose-300" role="alert">{error}</p> : null}

        <button
          type="submit"
          disabled={isProcessing}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:opacity-60"
        >
          {isProcessing ? "Starting checkout…" : `Continue to checkout — ${priceLabel}`}
        </button>
        <p className="text-xs text-white/45">
          After purchase, Brad emails a booking window for Level 1 Live, or a delivery turnaround based on available dates for Level 1 Pre-Recorded and Level 2.
        </p>
      </form>
    </div>
  );
}
