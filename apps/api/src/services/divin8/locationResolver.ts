import { logger } from "@wisdom/utils";
import type { LocationCoordinates } from "../blueprint/types.js";

export interface ResolvedBirthLocationContext {
  coordinates: LocationCoordinates;
  timezone: string | null;
  utcOffsetMinutes: number;
}

const locationCache = new Map<string, Promise<ResolvedBirthLocationContext>>();

function parseUtcOffsetMinutes(value: string): number | null {
  const normalized = value.trim();

  const utcMatch = normalized.match(/^(?:UTC|GMT)\s*([+-])\s*(\d{1,4})(?::?(\d{2}))?$/i);
  if (utcMatch) {
    const sign = utcMatch[1] === "-" ? -1 : 1;
    const numericPart = utcMatch[2];
    let hours: number;
    let minutes: number;
    if (numericPart.length >= 3) {
      hours = Math.floor(Number(numericPart) / 100);
      minutes = Number(numericPart) % 100;
    } else {
      hours = Number(numericPart);
      minutes = Number(utcMatch[3] ?? "0");
    }
    if (!Number.isNaN(hours) && !Number.isNaN(minutes) && hours <= 14 && minutes < 60) {
      return sign * (hours * 60 + minutes);
    }
  }

  if (/^(?:UTC|GMT)$/i.test(normalized)) {
    return 0;
  }

  return null;
}

function offsetPartsToMinutes(offsetText: string): number | null {
  const match = offsetText.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) {
    return null;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return sign * (hours * 60 + minutes);
}

function getUtcOffsetMinutesForIana(timeZone: string, birthDate: string, birthTime: string): number | null {
  try {
    const probe = new Date(`${birthDate}T${birthTime}:00Z`);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = formatter.formatToParts(probe);
    const offsetText = parts.find((part) => part.type === "timeZoneName")?.value;
    return offsetText ? offsetPartsToMinutes(offsetText) : null;
  } catch {
    return null;
  }
}

function cleanLocationString(raw: string): string {
  return raw
    .replace(/\b(?:birth\s*(?:place|location)|born\s+in)\s*[:–-]?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function geocodeViaGoogle(birthLocation: string, apiKey: string): Promise<LocationCoordinates> {
  const cleaned = cleanLocationString(birthLocation);
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", cleaned);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Geocoding failed with HTTP ${response.status} for "${cleaned}"`);
  }

  const payload = await response.json() as {
    status?: string;
    results?: Array<{
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    }>;
    error_message?: string;
  };

  const first = payload.results?.[0];
  const latitude = first?.geometry?.location?.lat;
  const longitude = first?.geometry?.location?.lng;
  const formattedAddress = first?.formatted_address;

  if (payload.status !== "OK" || typeof latitude !== "number" || typeof longitude !== "number") {
    const reason = payload.error_message ?? payload.status ?? "UNKNOWN_STATUS";
    throw new Error(`Geocoding could not resolve "${cleaned}": ${reason}`);
  }

  return {
    latitude,
    longitude,
    formattedAddress: formattedAddress ?? cleaned,
  };
}

async function geocodeViaOpenStreetMap(birthLocation: string): Promise<LocationCoordinates> {
  const cleaned = cleanLocationString(birthLocation);
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", cleaned);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url, {
    headers: {
      // Nominatim usage policy asks for a meaningful user-agent.
      "User-Agent": "wisdomtransmissions-divin8/1.0",
      "Accept": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`OpenStreetMap geocoding failed with HTTP ${response.status} for "${cleaned}"`);
  }

  const payload = await response.json() as Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
  }>;
  const first = payload[0];
  const latitude = first?.lat ? Number(first.lat) : Number.NaN;
  const longitude = first?.lon ? Number(first.lon) : Number.NaN;
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw new Error(`OpenStreetMap could not resolve "${cleaned}"`);
  }

  return {
    latitude,
    longitude,
    formattedAddress: first?.display_name ?? cleaned,
  };
}

async function resolveTimezoneFromCoordinates(input: {
  coordinates: LocationCoordinates;
  birthDate: string;
  birthTime: string;
  apiKey: string;
}): Promise<{ timezone: string | null; utcOffsetMinutes: number | null }> {
  const timestamp = Math.floor(new Date(`${input.birthDate}T${input.birthTime}:00Z`).getTime() / 1000);
  const url = new URL("https://maps.googleapis.com/maps/api/timezone/json");
  url.searchParams.set("location", `${input.coordinates.latitude},${input.coordinates.longitude}`);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("key", input.apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    logger.warn("location_timezone_lookup_http_fallback", {
      status: response.status,
    });
    return { timezone: null, utcOffsetMinutes: null };
  }

  const payload = await response.json() as {
    status?: string;
    timeZoneId?: string;
    rawOffset?: number;
    dstOffset?: number;
    error_message?: string;
  };

  if (payload.status !== "OK") {
    logger.warn("location_timezone_lookup_status_fallback", {
      status: payload.status ?? "unknown",
      message: payload.error_message ?? "no details",
    });
    return { timezone: null, utcOffsetMinutes: null };
  }

  const rawOffsetMinutes = typeof payload.rawOffset === "number" ? payload.rawOffset / 60 : null;
  const dstOffsetMinutes = typeof payload.dstOffset === "number" ? payload.dstOffset / 60 : 0;

  return {
    timezone: payload.timeZoneId ?? null,
    utcOffsetMinutes: rawOffsetMinutes === null ? null : rawOffsetMinutes + dstOffsetMinutes,
  };
}

export async function resolveBirthLocationContext(input: {
  birthLocation: string;
  birthDate: string;
  birthTime: string;
  timezone: string | null;
  coordinates?: LocationCoordinates;
}): Promise<ResolvedBirthLocationContext> {
  const cacheKey = JSON.stringify(input);
  const cached = locationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = (async () => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim();
    const directOffset = input.timezone ? parseUtcOffsetMinutes(input.timezone) : null;
    const ianaOffset = input.timezone && directOffset === null
      ? getUtcOffsetMinutesForIana(input.timezone, input.birthDate, input.birthTime)
      : null;

    let coordinates: LocationCoordinates;
    if (input.coordinates) {
      coordinates = input.coordinates;
    } else if (apiKey) {
      try {
        coordinates = await geocodeViaGoogle(input.birthLocation, apiKey);
      } catch (googleError) {
        logger.warn("location_google_geocode_fallback", {
          birthLocation: input.birthLocation,
          message: googleError instanceof Error ? googleError.message : String(googleError),
        });
        coordinates = await geocodeViaOpenStreetMap(input.birthLocation);
      }
    } else {
      coordinates = await geocodeViaOpenStreetMap(input.birthLocation);
    }

    if (directOffset !== null) {
      return {
        coordinates,
        timezone: input.timezone,
        utcOffsetMinutes: directOffset,
      };
    }

    if (ianaOffset !== null) {
      return {
        coordinates,
        timezone: input.timezone,
        utcOffsetMinutes: ianaOffset,
      };
    }

    if (apiKey) {
      const resolvedTimezone = await resolveTimezoneFromCoordinates({
        coordinates,
        birthDate: input.birthDate,
        birthTime: input.birthTime,
        apiKey,
      });

      if (resolvedTimezone.utcOffsetMinutes !== null) {
        return {
          coordinates,
          timezone: resolvedTimezone.timezone,
          utcOffsetMinutes: resolvedTimezone.utcOffsetMinutes,
        };
      }
    }

    if (directOffset !== null) {
      return { coordinates, timezone: input.timezone, utcOffsetMinutes: directOffset };
    }

    logger.error("location_timezone_resolution_failed", {
      birthLocation: input.birthLocation,
      timezone: input.timezone,
      birthDate: input.birthDate,
      birthTime: input.birthTime,
    });
    throw new Error(
      `Could not determine timezone for "${input.birthLocation}". Please provide a timezone like "PST", "UTC-8", or "America/Vancouver".`,
    );
  })();

  locationCache.set(cacheKey, pending);

  try {
    return await pending;
  } catch (error) {
    locationCache.delete(cacheKey);
    throw error;
  }
}

export function clearBirthLocationResolutionCache() {
  locationCache.clear();
}
