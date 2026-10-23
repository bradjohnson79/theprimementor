import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";

export interface ResolvedBirthPlace {
  name: string;
  lat: number;
  lng: number;
  timezone: string | null;
}

interface PlaceSuggestion {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
  };
}

/**
 * Minimal birth-place lookup for the guest checkout intake forms, reusing the existing public
 * /api/places/autocomplete and /api/places/:placeId endpoints (same Google Places data the
 * signed-in booking/report forms use). Requires GOOGLE_PLACES_API_KEY on the server — if that
 * isn't configured, typing a place and pressing Enter/blur still submits the typed text as the
 * birthplace name with lat/lng left unset, so the field degrades gracefully rather than
 * blocking checkout.
 */
export default function BirthPlaceAutocompleteField({
  value,
  onChange,
  required,
}: {
  value: ResolvedBirthPlace | null;
  onChange: (place: ResolvedBirthPlace | null) => void;
  required?: boolean;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      api.get(`/places/autocomplete?input=${encodeURIComponent(query.trim())}`)
        .then((res) => {
          const list = ((res?.data ?? res) as PlaceSuggestion[] | undefined) ?? [];
          setSuggestions(Array.isArray(list) ? list : []);
        })
        .catch(() => setSuggestions([]));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function selectSuggestion(suggestion: PlaceSuggestion) {
    const placeId = suggestion.placePrediction?.placeId;
    const label = suggestion.placePrediction?.text?.text ?? query;
    setQuery(label);
    setOpen(false);
    if (!placeId) {
      onChange({ name: label, lat: 0, lng: 0, timezone: null });
      return;
    }
    setResolving(true);
    try {
      const res = await api.get(`/places/${encodeURIComponent(placeId)}`);
      const details = (res?.data ?? res) as { formattedAddress?: string; location?: { latitude?: number; longitude?: number }; timezone?: string | null };
      onChange({
        name: details.formattedAddress || label,
        lat: typeof details.location?.latitude === "number" ? details.location.latitude : 0,
        lng: typeof details.location?.longitude === "number" ? details.location.longitude : 0,
        timezone: details.timezone ?? null,
      });
    } catch {
      // Graceful degrade: keep the typed name, no coordinates.
      onChange({ name: label, lat: 0, lng: 0, timezone: null });
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        required={required}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          onChange(null);
        }}
        onBlur={() => {
          // If they typed something and clicked away without picking a suggestion, still accept
          // the typed text as the place name rather than blocking submission.
          if (query.trim() && !value) {
            onChange({ name: query.trim(), lat: 0, lng: 0, timezone: null });
          }
          setTimeout(() => setOpen(false), 100);
        }}
        placeholder="City, Country (birthplace)"
        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-cyan-300/50 focus:outline-none"
      />
      {resolving ? <p className="mt-1 text-xs text-white/40">Looking up coordinates…</p> : null}
      {open && suggestions.length > 0 ? (
        <ul className="absolute z-10 mt-1 w-full rounded-xl border border-white/15 bg-[#0b0e1a] shadow-xl">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.placePrediction?.placeId ?? index}>
              <button
                type="button"
                onClick={() => void selectSuggestion(suggestion)}
                className="block w-full px-4 py-2 text-left text-sm text-white/85 hover:bg-white/10"
              >
                {suggestion.placePrediction?.text?.text ?? "Unknown place"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
