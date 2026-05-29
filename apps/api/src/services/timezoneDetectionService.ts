import { findTimezoneOption } from "@wisdom/utils";

type HeaderValue = string | string[] | undefined;
type HeaderBag = Record<string, HeaderValue>;

export interface TimezoneDetectionResult {
  timezone: string | null;
  source: "edge_timezone" | "country_fallback" | null;
}

const TIMEZONE_HEADER_NAMES = [
  "x-vercel-ip-timezone",
  "cf-timezone",
  "x-timezone",
  "x-client-timezone",
  "cloudfront-viewer-time-zone",
];

const COUNTRY_TIMEZONE_FALLBACKS: Record<string, string> = {
  GB: "Europe/London",
  IE: "Europe/London",
  NZ: "Pacific/Auckland",
  SG: "Asia/Singapore",
  JP: "Asia/Tokyo",
  KR: "Asia/Seoul",
  IN: "Asia/Kolkata",
  HK: "Asia/Hong_Kong",
  CN: "Asia/Shanghai",
  ZA: "Africa/Johannesburg",
};

function getFirstHeaderValue(value: HeaderValue) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim() : "";
}

function normalizeHeaderName(name: string) {
  return name.toLowerCase();
}

function readHeader(headers: HeaderBag, name: string) {
  const normalizedName = normalizeHeaderName(name);
  return getFirstHeaderValue(headers[normalizedName] ?? headers[name]);
}

function isSupportedTimezone(timezone: string) {
  return Boolean(findTimezoneOption(timezone));
}

export function detectTimezoneFromHeaders(headers: HeaderBag): TimezoneDetectionResult {
  for (const headerName of TIMEZONE_HEADER_NAMES) {
    const timezone = readHeader(headers, headerName);
    if (timezone && isSupportedTimezone(timezone)) {
      return {
        timezone,
        source: "edge_timezone",
      };
    }
  }

  const country = (
    readHeader(headers, "x-vercel-ip-country")
    || readHeader(headers, "cf-ipcountry")
    || readHeader(headers, "cloudfront-viewer-country")
  ).toUpperCase();
  const timezone = COUNTRY_TIMEZONE_FALLBACKS[country];
  if (timezone && isSupportedTimezone(timezone)) {
    return {
      timezone,
      source: "country_fallback",
    };
  }

  return {
    timezone: null,
    source: null,
  };
}
