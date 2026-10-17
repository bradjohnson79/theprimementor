import { find } from "geo-tz";

function isValidIanaTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function hasValidCoordinates(lat: unknown, lng: unknown): lat is number {
  return typeof lat === "number"
    && typeof lng === "number"
    && Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180;
}

export function resolveIanaTimezoneFromCoordinates(lat: number, lng: number): string | null {
  if (!hasValidCoordinates(lat, lng)) {
    return null;
  }

  try {
    const [timezone] = find(lat, lng);
    if (!timezone || !isValidIanaTimeZone(timezone)) {
      return null;
    }
    return timezone;
  } catch {
    return null;
  }
}
