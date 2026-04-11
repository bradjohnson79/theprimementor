import { useEffect, useRef, useState } from "react";
import { resolveApiUrl } from "../lib/apiBase";

export interface PlaceResult {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
}

export interface PlaceSuggestion {
  placeId: string;
  label: string;
  primaryText: string;
  secondaryText: string | null;
}

interface PlaceDetailsResponse {
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string | null;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function fetchPlaceSuggestions(query: string, signal: AbortSignal): Promise<PlaceSuggestion[]> {
  const response = await fetch(`${resolveApiUrl("/places/autocomplete")}?input=${encodeURIComponent(query)}`, { signal });
  if (!response.ok) {
    throw new Error("autocomplete-request-failed");
  }

  const data = (await response.json()) as ApiResponse<PlaceSuggestion[]>;
  return Array.isArray(data.data) ? data.data : [];
}
async function fetchPlaceDetails(suggestion: PlaceSuggestion): Promise<PlaceResult> {
  const response = await fetch(resolveApiUrl(`/places/${encodeURIComponent(suggestion.placeId)}`));
  if (!response.ok) {
    throw new Error("place-details-request-failed");
  }

  const payload = (await response.json()) as ApiResponse<PlaceDetailsResponse>;
  const data = payload.data;
  const latitude = data?.latitude;
  const longitude = data?.longitude;
  const formattedAddress = data?.formattedAddress?.trim() || suggestion.label;

  if (!formattedAddress || typeof latitude !== "number" || typeof longitude !== "number") {
    throw new Error("place-details-invalid");
  }

  return { formattedAddress, latitude, longitude, timezone: data?.timezone ?? null };
}

export function useGooglePlaces(
  query: string,
  onPlaceSelected?: (place: PlaceResult) => void,
) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const selectedLabelRef = useRef<string | null>(null);

  useEffect(() => {
    onPlaceSelectedRef.current = onPlaceSelected;
  }, [onPlaceSelected]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      selectedLabelRef.current = null;
      setSuggestions([]);
      setError(null);
      setIsSearching(false);
      return;
    }

    if (selectedLabelRef.current === normalizedQuery) {
      setSuggestions([]);
      setError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const nextSuggestions = await fetchPlaceSuggestions(normalizedQuery, controller.signal);
        setSuggestions(nextSuggestions);
        setError(null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setSuggestions([]);
          setError("Google Places suggestions are unavailable right now.");
        }
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  async function selectSuggestion(suggestion: PlaceSuggestion) {
    setIsResolving(true);
    setError(null);
    try {
      const place = await fetchPlaceDetails(suggestion);
      selectedLabelRef.current = place.formattedAddress;
      setSelectedPlace(place);
      setSuggestions([]);
      onPlaceSelectedRef.current?.(place);
    } catch {
      setError("Failed to load place details");
    } finally {
      setIsResolving(false);
    }
  }

  return { suggestions, isSearching, isResolving, error, selectedPlace, setSelectedPlace, selectSuggestion };
}
