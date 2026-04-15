import path from "node:path";
import { getReportTierDefinition, isReportTierId, type ReportTierId } from "@wisdom/utils";
import type { SystemName, GuestInput, LocationCoordinates } from "./types.js";
import { assertValidTimeZone } from "../booking/timezoneService.js";

const VALID_SYSTEMS: SystemName[] = [
  "numerology",
  "astrology",
  "iching",
  "bodymap",
  "physiognomy",
  "chinese",
  "humanDesign",
  "kabbalah",
  "rune",
];

export function validateGenerateRequest(body: unknown): {
  valid: boolean;
  mode?: "client" | "guest";
  tier?: ReportTierId;
  clientId?: string;
  email?: string;
  guest?: GuestInput;
  coordinates?: LocationCoordinates;
  includeSystems?: SystemName[];
  timezone?: string;
  timezoneSource?: "user" | "suggested" | "fallback";
  imageAssetId?: string;
  error?: string;
} {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body is required" };
  }

  const {
    mode,
    tier,
    clientId,
    email,
    guest,
    coordinates,
    includeSystems,
    timezone,
    timezoneSource,
    imageAssetId,
  } = body as Record<string, unknown>;

  // Validate mode
  if (!mode || (mode !== "client" && mode !== "guest")) {
    return {
      valid: false,
      error: "mode must be 'client' or 'guest'",
    };
  }

  const validatedTier = isReportTierId(tier) ? tier : "intro";
  if (tier !== undefined && !isReportTierId(tier)) {
    return { valid: false, error: "tier must be one of: intro, deep_dive, initiate" };
  }

  // Validate based on mode
  if (mode === "client") {
    const hasClientId = typeof clientId === "string" && clientId.trim().length > 0;
    const hasEmail = typeof email === "string" && email.trim().length > 0;
    if (!hasClientId && !hasEmail) {
      return { valid: false, error: "clientId or email is required for client mode" };
    }
    if (email !== undefined && email !== null && (typeof email !== "string" || !email.trim())) {
      return { valid: false, error: "email must be a non-empty string when provided" };
    }
  } else {
    // Guest mode
    if (!guest || typeof guest !== "object") {
      return { valid: false, error: "guest data is required for guest mode" };
    }
    const g = guest as Record<string, unknown>;
    if (!g.firstName || typeof g.firstName !== "string") {
      return { valid: false, error: "guest.firstName is required" };
    }
    if (!g.lastName || typeof g.lastName !== "string") {
      return { valid: false, error: "guest.lastName is required" };
    }
    if (!g.birthDate || typeof g.birthDate !== "string") {
      return { valid: false, error: "guest.birthDate is required" };
    }
  }

  let systems: SystemName[];
  if (Array.isArray(includeSystems) && includeSystems.length > 0) {
    const invalid = includeSystems.filter((s) => !VALID_SYSTEMS.includes(s as SystemName));
    if (invalid.length > 0) {
      return {
        valid: false,
        error: `Invalid systems: ${invalid.join(", ")}. Valid: ${VALID_SYSTEMS.join(", ")}`,
      };
    }
    systems = includeSystems as SystemName[];
  } else {
    const tierDefinition = getReportTierDefinition(validatedTier);
    systems = tierDefinition.includeSystems.filter((s) => VALID_SYSTEMS.includes(s)) as SystemName[];
  }

  // Validate coordinates (optional but useful for astrology)
  let validatedCoordinates: LocationCoordinates | undefined;
  if (coordinates && typeof coordinates === "object") {
    const c = coordinates as Record<string, unknown>;
    if (
      typeof c.latitude === "number" &&
      typeof c.longitude === "number" &&
      typeof c.formattedAddress === "string"
    ) {
      validatedCoordinates = {
        latitude: c.latitude,
        longitude: c.longitude,
        formattedAddress: c.formattedAddress,
      };
    }
  }

  let validatedTimezone: string | undefined;
  if (typeof timezone === "string" && timezone.trim()) {
    try {
      validatedTimezone = assertValidTimeZone(timezone.trim());
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Invalid timezone. Use a valid IANA timezone.",
      };
    }
  }

  const validatedTimezoneSource = timezoneSource === "suggested" || timezoneSource === "fallback"
    ? timezoneSource
    : "user";

  let validatedImageAssetId: string | undefined;
  if (imageAssetId !== undefined && imageAssetId !== null) {
    if (typeof imageAssetId !== "string" || !imageAssetId.trim()) {
      return { valid: false, error: "imageAssetId must be a non-empty string when provided" };
    }
    const base = path.basename(imageAssetId.trim());
    if (base !== imageAssetId.trim() || base.includes("..")) {
      return { valid: false, error: "Invalid imageAssetId" };
    }
    validatedImageAssetId = base;
  }

  if (systems.includes("physiognomy") && !validatedImageAssetId) {
    return {
      valid: false,
      error: "Physiognomy requires imageAssetId from POST /api/images/upload before generate",
    };
  }

  if (mode === "guest" && guest && typeof guest === "object") {
    const g = guest as Record<string, unknown>;
    const birthLoc = typeof g.birthLocation === "string" ? g.birthLocation.trim() : "";
    const birthTime = normalizeBirthTimeToStorage(typeof g.birthTime === "string" ? g.birthTime : null);
    if (birthLoc.length > 0 && !validatedCoordinates) {
      return {
        valid: false,
        error:
          "coordinates (latitude, longitude, formattedAddress from Google Places) are required when birthLocation is set",
      };
    }
    if (systems.includes("astrology") && birthTime && !validatedTimezone) {
      return {
        valid: false,
        error: "timezone is required for astrology generation",
      };
    }
  }

  if (mode === "client" && systems.includes("astrology") && !validatedTimezone) {
    return {
      valid: false,
      error: "timezone is required for astrology generation",
    };
  }

  const guestOut: GuestInput | undefined =
    mode === "guest"
      ? {
          ...(guest as GuestInput),
          birthTime: normalizeBirthTimeToStorage((guest as GuestInput).birthTime),
          timezone: validatedTimezone ?? null,
          timezoneSource: validatedTimezoneSource,
        }
      : undefined;

  return {
    valid: true,
    mode,
    tier: validatedTier,
    clientId: mode === "client" && typeof clientId === "string" && clientId.trim() ? clientId.trim() : undefined,
    email: mode === "client" && typeof email === "string" && email.trim() ? email.trim().toLowerCase() : undefined,
    guest: guestOut,
    coordinates: validatedCoordinates,
    includeSystems: systems,
    timezone: validatedTimezone,
    timezoneSource: validatedTimezoneSource,
    imageAssetId: validatedImageAssetId,
  };
}

export function parseBirthDate(dateStr: string): {
  year: number;
  month: number;
  day: number;
} | null {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const [year, month, day] = parts.map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function parseBirthTime(timeStr: string | null): {
  hour: number;
  minute: number;
} | null {
  if (!timeStr || typeof timeStr !== "string") return null;
  const s = timeStr.trim();

  // Handle "HH:MM" or "HH:MM:SS" (HTML time input standard — 24h)
  const match24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    const hour = parseInt(match24[1], 10);
    const minute = parseInt(match24[2], 10);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }

  // Handle "H:MM AM/PM" or "HH:MM AM/PM" (macOS 12h locale browser format)
  const match12 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === "AM" && hour === 12) hour = 0;
    if (period === "PM" && hour !== 12) hour += 12;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }

  return null;
}

/** Store and transmit birth time as `HH:mm` (24h, zero-padded) when present */
export function normalizeBirthTimeToStorage(value: string | null | undefined): string | null {
  if (value == null || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseBirthTime(trimmed);
  if (!parsed) return null;
  const hh = String(parsed.hour).padStart(2, "0");
  const mm = String(parsed.minute).padStart(2, "0");
  return `${hh}:${mm}`;
}
