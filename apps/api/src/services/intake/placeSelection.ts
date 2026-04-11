import { createHttpError } from "../booking/errors.js";
import { assertValidTimeZone } from "../booking/timezoneService.js";

export interface StructuredBirthplace {
  name: string;
  lat: number;
  lng: number;
  timezone: string | null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeStructuredBirthplace(input: {
  birthPlaceName?: unknown;
  birthLat?: unknown;
  birthLng?: unknown;
  birthTimezone?: unknown;
}): StructuredBirthplace {
  const name = typeof input.birthPlaceName === "string" ? input.birthPlaceName.trim() : "";
  const lat = toFiniteNumber(input.birthLat);
  const lng = toFiniteNumber(input.birthLng);
  const timezone = typeof input.birthTimezone === "string" && input.birthTimezone.trim()
    ? assertValidTimeZone(input.birthTimezone.trim())
    : null;

  if (!name || lat === null || lng === null) {
    throw createHttpError(400, "Valid birthplace selection required");
  }

  return {
    name,
    lat,
    lng,
    timezone,
  };
}
