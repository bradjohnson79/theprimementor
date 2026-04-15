import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Divin8ProfileCreateRequest } from "@wisdom/utils";
import TimezoneSelect from "../timezone/TimezoneSelect";
import Divin8ModalPortal from "./Divin8ModalPortal";
import type { Divin8ChatApiAdapter } from "./useDivin8Chat";
import { classNames, darkChatStyles } from "./utils";

interface PlaceSuggestion {
  placeId: string;
  label: string;
  primaryText: string;
  secondaryText: string | null;
}

interface PlaceDetailsResponse {
  data?: {
    formattedAddress?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string | null;
  };
}

interface PlacesAutocompleteResponse {
  data?: PlaceSuggestion[];
}

interface Divin8ProfileModalProps {
  open: boolean;
  isLightTheme: boolean;
  api: Divin8ChatApiAdapter;
  onClose: () => void;
  onSave: (input: Divin8ProfileCreateRequest) => Promise<void>;
  isSaving: boolean;
  errorMessage: string | null;
}

interface FormState {
  fullName: string;
  birthDate: string;
  birthHour: string;
  birthMinute: string;
  birthPeriod: "AM" | "PM" | "";
  birthPlace: string;
  lat: number | null;
  lng: number | null;
  timezone: string;
}

const INITIAL_FORM: FormState = {
  fullName: "",
  birthDate: "",
  birthHour: "",
  birthMinute: "",
  birthPeriod: "",
  birthPlace: "",
  lat: null,
  lng: null,
  timezone: "",
};

function buildBirthTime(hour: string, minute: string, period: "AM" | "PM" | "") {
  if (!hour || !minute || !period) {
    return "";
  }
  return `${hour}:${minute} ${period}`;
}

function isValidBirthTimeParts(hour: string, minute: string, period: "AM" | "PM" | "") {
  const parsedHour = Number(hour);
  const parsedMinute = Number(minute);
  return Boolean(
    period
    && Number.isInteger(parsedHour)
    && Number.isInteger(parsedMinute)
    && parsedHour >= 1
    && parsedHour <= 12
    && parsedMinute >= 0
    && parsedMinute <= 59,
  );
}

function FieldLabel({ children, isLightTheme }: { children: string; isLightTheme: boolean }) {
  return (
    <span
      className={classNames(
        "mb-1 block text-xs font-semibold uppercase tracking-[0.14em]",
        isLightTheme ? "text-slate-500" : "text-white/55",
      )}
    >
      {children}
    </span>
  );
}

export default function Divin8ProfileModal({
  open,
  isLightTheme,
  api,
  onClose,
  onSave,
  isSaving,
  errorMessage,
}: Divin8ProfileModalProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM);
      setSuggestions([]);
      setPlaceError(null);
      setValidationError(null);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const query = form.birthPlace.trim();
    if (query.length < 2 || (form.lat !== null && form.lng !== null)) {
      setSuggestions([]);
      setIsSearchingPlaces(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setIsSearchingPlaces(true);
        try {
          const response = (await api.get(`/places/autocomplete?input=${encodeURIComponent(query)}`, null)) as PlacesAutocompleteResponse;
          if (!cancelled) {
            setSuggestions(response.data ?? []);
            setPlaceError(null);
          }
        } catch (error) {
          if (!cancelled) {
            setSuggestions([]);
            setPlaceError(error instanceof Error ? error.message : "Google Places suggestions are unavailable right now.");
          }
        } finally {
          if (!cancelled) {
            setIsSearchingPlaces(false);
          }
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [api, form.birthPlace, form.lat, form.lng, open]);

  const canSubmit = useMemo(() => Boolean(
    form.fullName.trim()
    && form.birthDate
    && isValidBirthTimeParts(form.birthHour, form.birthMinute, form.birthPeriod)
    && form.birthPlace.trim()
    && form.lat !== null
    && form.lng !== null
    && form.timezone
  ), [form]);

  async function handleSelectSuggestion(suggestion: PlaceSuggestion) {
    setIsResolvingPlace(true);
    try {
      const response = (await api.get(`/places/${encodeURIComponent(suggestion.placeId)}`, null)) as PlaceDetailsResponse;
      const details = response.data;
      if (
        !details
        || typeof details.latitude !== "number"
        || typeof details.longitude !== "number"
        || !details.formattedAddress?.trim()
      ) {
        throw new Error("Please select a valid birthplace from the dropdown.");
      }

      setForm((current) => ({
        ...current,
        birthPlace: details.formattedAddress!.trim(),
        lat: details.latitude!,
        lng: details.longitude!,
        timezone: details.timezone?.trim() || current.timezone,
      }));
      setSuggestions([]);
      setPlaceError(null);
    } catch (error) {
      setPlaceError(error instanceof Error ? error.message : "Please select a valid birthplace from the dropdown.");
    } finally {
      setIsResolvingPlace(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidBirthTimeParts(form.birthHour, form.birthMinute, form.birthPeriod)) {
      setValidationError("Birth time must be entered as hour, minute, and AM or PM.");
      return;
    }
    if (!canSubmit || form.lat === null || form.lng === null) {
      setValidationError("All profile fields are required, including a valid birthplace selection.");
      return;
    }

    setValidationError(null);
    try {
      await onSave({
        fullName: form.fullName.trim(),
        birthDate: form.birthDate,
        birthTime: buildBirthTime(form.birthHour, form.birthMinute, form.birthPeriod),
        birthPlace: form.birthPlace.trim(),
        lat: form.lat,
        lng: form.lng,
        timezone: form.timezone,
      });
    } catch {
      // Hook state already captures and displays the save error.
    }
  }

  if (!open) {
    return null;
  }

  const fieldClassName = classNames(
    "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors",
    isLightTheme
      ? "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-accent-cyan"
      : "border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus:border-accent-cyan",
  );

  return (
    <Divin8ModalPortal open={open} onClose={onClose} closeOnBackdropClick>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="divin8-profile-modal-title"
        className={classNames(
          "w-full max-w-2xl rounded-[28px] border p-6 shadow-[0_30px_100px_rgba(8,15,30,0.42),0_0_36px_rgba(6,182,212,0.14)]",
          isLightTheme ? "border-slate-200 bg-white text-slate-900" : "text-white",
        )}
        style={!isLightTheme ? darkChatStyles.panelElevated : undefined}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={classNames("text-xs uppercase tracking-[0.18em]", isLightTheme ? "text-slate-400" : "text-white/45")}>
              Divin8 Profiles
            </p>
            <h3 id="divin8-profile-modal-title" className="mt-1 text-xl font-semibold">Add Profile</h3>
            <p className={classNames("mt-2 text-sm", isLightTheme ? "text-slate-500" : "text-white/60")}>
              Save a complete birth profile, then tag it in chat for Swiss Ephemeris readings.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className={classNames(
              "rounded-lg px-2 py-1 text-sm transition-colors",
              isLightTheme ? "text-slate-500 hover:bg-slate-100 hover:text-slate-900" : "text-white/55 hover:bg-white/10 hover:text-white",
            )}
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <FieldLabel isLightTheme={isLightTheme}>Full Name</FieldLabel>
              <input
                type="text"
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                className={fieldClassName}
                placeholder="John Smith"
                required
              />
            </label>

            <label className="block">
              <FieldLabel isLightTheme={isLightTheme}>Birthdate</FieldLabel>
              <input
                type="date"
                value={form.birthDate}
                onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))}
                className={fieldClassName}
                required
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <FieldLabel isLightTheme={isLightTheme}>Birth Time</FieldLabel>
              <div className="grid grid-cols-[1fr_1fr_1.1fr] gap-2">
                <input
                  type="number"
                  min="1"
                  max="12"
                  inputMode="numeric"
                  value={form.birthHour}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    birthHour: event.target.value.slice(0, 2),
                  }))}
                  className={fieldClassName}
                  placeholder="HH"
                  required
                />
                <input
                  type="number"
                  min="0"
                  max="59"
                  inputMode="numeric"
                  value={form.birthMinute}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    birthMinute: event.target.value.slice(0, 2),
                  }))}
                  className={fieldClassName}
                  placeholder="MM"
                  required
                />
                <select
                  value={form.birthPeriod}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    birthPeriod: event.target.value === "AM" || event.target.value === "PM"
                      ? event.target.value
                      : "",
                  }))}
                  className={fieldClassName}
                  required
                >
                  <option value="">AM/PM</option>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
              <span className={classNames("mt-2 block text-xs", isLightTheme ? "text-slate-500" : "text-white/45")}>
                Enter birth time as hour, minute, and AM/PM.
              </span>
            </label>

            <label className="block">
              <FieldLabel isLightTheme={isLightTheme}>Timezone</FieldLabel>
              <TimezoneSelect
                value={form.timezone}
                onChange={(timezone) => setForm((current) => ({ ...current, timezone }))}
                className={fieldClassName}
                required
              />
            </label>
          </div>

          <label className="block">
            <FieldLabel isLightTheme={isLightTheme}>Birth Place</FieldLabel>
            <div className="relative">
              <input
                type="text"
                value={form.birthPlace}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((current) => ({
                    ...current,
                    birthPlace: value,
                    lat: null,
                    lng: null,
                    timezone: current.timezone,
                  }));
                }}
                className={fieldClassName}
                placeholder="Start typing a city, region, or country"
                required
              />
              {suggestions.length > 0 ? (
                <div
                  className={classNames(
                    "absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-2xl border p-2 shadow-2xl",
                    isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-slate-950",
                  )}
                >
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.placeId}
                      type="button"
                      onClick={() => void handleSelectSuggestion(suggestion)}
                      className={classNames(
                        "block w-full rounded-xl px-3 py-2 text-left transition-colors",
                        isLightTheme ? "hover:bg-slate-100" : "hover:bg-white/10",
                      )}
                    >
                      <div className="text-sm font-medium">{suggestion.primaryText}</div>
                      {suggestion.secondaryText ? (
                        <div className={classNames("text-xs", isLightTheme ? "text-slate-500" : "text-white/50")}>
                          {suggestion.secondaryText}
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {(placeError || isSearchingPlaces || isResolvingPlace) ? (
              <p className={classNames("mt-2 text-xs", placeError ? "text-rose-400" : isLightTheme ? "text-slate-500" : "text-white/55")}>
                {placeError || (isResolvingPlace ? "Resolving birthplace..." : "Searching places...")}
              </p>
            ) : null}
          </label>

          {(validationError || errorMessage) ? (
            <div className={classNames(
              "rounded-xl border px-3 py-2 text-sm",
              isLightTheme ? "border-rose-200 bg-rose-50 text-rose-700" : "border-rose-500/30 bg-rose-500/10 text-rose-100",
            )}>
              {validationError || errorMessage}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className={classNames(
                "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                isLightTheme ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-white/10 text-white hover:bg-white/15",
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isSaving}
              className={classNames(
                "rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                !canSubmit || isSaving
                  ? "cursor-not-allowed bg-slate-400/30 text-white/50"
                  : "bg-accent-cyan text-slate-950 hover:brightness-110",
              )}
            >
              {isSaving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </Divin8ModalPortal>
  );
}
