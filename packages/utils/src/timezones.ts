export interface TimezoneOption {
  ianaName: string;
  label: string;
  region: string;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { ianaName: "Pacific/Pago_Pago", label: "American Samoa, Niue", region: "Pacific" },
  { ianaName: "Pacific/Honolulu", label: "Hawaii", region: "Pacific" },
  { ianaName: "America/Anchorage", label: "Alaska", region: "Americas" },
  { ianaName: "America/Vancouver", label: "Pacific Time - Vancouver, Seattle", region: "Americas" },
  { ianaName: "America/Los_Angeles", label: "Pacific Time - Los Angeles", region: "Americas" },
  { ianaName: "America/Tijuana", label: "Pacific Time - Tijuana", region: "Americas" },
  { ianaName: "America/Denver", label: "Mountain Time - Denver", region: "Americas" },
  { ianaName: "America/Phoenix", label: "Mountain Time - Phoenix", region: "Americas" },
  { ianaName: "America/Edmonton", label: "Mountain Time - Calgary, Edmonton", region: "Americas" },
  { ianaName: "America/Chicago", label: "Central Time - Chicago", region: "Americas" },
  { ianaName: "America/Winnipeg", label: "Central Time - Winnipeg", region: "Americas" },
  { ianaName: "America/Mexico_City", label: "Central Time - Mexico City", region: "Americas" },
  { ianaName: "America/New_York", label: "Eastern Time - New York", region: "Americas" },
  { ianaName: "America/Toronto", label: "Eastern Time - Toronto", region: "Americas" },
  { ianaName: "America/Bogota", label: "Bogota, Lima, Quito", region: "Americas" },
  { ianaName: "America/Halifax", label: "Atlantic Time - Halifax", region: "Americas" },
  { ianaName: "America/St_Johns", label: "Newfoundland", region: "Americas" },
  { ianaName: "America/Sao_Paulo", label: "Sao Paulo, Brasilia", region: "Americas" },
  { ianaName: "America/Buenos_Aires", label: "Buenos Aires", region: "Americas" },
  { ianaName: "UTC", label: "Coordinated Universal Time", region: "Global" },
  { ianaName: "Europe/London", label: "London, Dublin", region: "Europe" },
  { ianaName: "Europe/Paris", label: "Paris, Berlin, Madrid", region: "Europe" },
  { ianaName: "Europe/Amsterdam", label: "Amsterdam, Brussels, Rome", region: "Europe" },
  { ianaName: "Europe/Athens", label: "Athens, Bucharest", region: "Europe" },
  { ianaName: "Europe/Helsinki", label: "Helsinki, Riga, Tallinn", region: "Europe" },
  { ianaName: "Europe/Istanbul", label: "Istanbul", region: "Europe" },
  { ianaName: "Europe/Moscow", label: "Moscow, St. Petersburg", region: "Europe" },
  { ianaName: "Africa/Casablanca", label: "Casablanca", region: "Africa" },
  { ianaName: "Africa/Lagos", label: "Lagos, Kinshasa", region: "Africa" },
  { ianaName: "Africa/Cairo", label: "Cairo", region: "Africa" },
  { ianaName: "Africa/Johannesburg", label: "Johannesburg, Harare", region: "Africa" },
  { ianaName: "Africa/Nairobi", label: "Nairobi", region: "Africa" },
  { ianaName: "Asia/Jerusalem", label: "Jerusalem", region: "Asia" },
  { ianaName: "Asia/Riyadh", label: "Riyadh, Kuwait City", region: "Asia" },
  { ianaName: "Asia/Tehran", label: "Tehran", region: "Asia" },
  { ianaName: "Asia/Dubai", label: "Dubai, Abu Dhabi", region: "Asia" },
  { ianaName: "Asia/Tbilisi", label: "Tbilisi", region: "Asia" },
  { ianaName: "Asia/Karachi", label: "Karachi, Islamabad", region: "Asia" },
  { ianaName: "Asia/Kolkata", label: "India - New Delhi, Mumbai", region: "Asia" },
  { ianaName: "Asia/Kathmandu", label: "Kathmandu", region: "Asia" },
  { ianaName: "Asia/Dhaka", label: "Dhaka", region: "Asia" },
  { ianaName: "Asia/Bangkok", label: "Bangkok, Hanoi, Jakarta", region: "Asia" },
  { ianaName: "Asia/Shanghai", label: "China - Beijing, Shanghai", region: "Asia" },
  { ianaName: "Asia/Hong_Kong", label: "Hong Kong", region: "Asia" },
  { ianaName: "Asia/Singapore", label: "Singapore", region: "Asia" },
  { ianaName: "Asia/Tokyo", label: "Tokyo, Osaka", region: "Asia" },
  { ianaName: "Asia/Seoul", label: "Seoul", region: "Asia" },
  { ianaName: "Australia/Perth", label: "Australia - Perth", region: "Australia" },
  { ianaName: "Australia/Adelaide", label: "Australia - Adelaide", region: "Australia" },
  { ianaName: "Australia/Brisbane", label: "Australia - Brisbane", region: "Australia" },
  { ianaName: "Australia/Sydney", label: "Australia - Sydney, Melbourne", region: "Australia" },
  { ianaName: "Pacific/Auckland", label: "New Zealand - Auckland", region: "Pacific" },
];

export function getBrowserTimezoneName(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function findTimezoneOption(timezone: string | null | undefined): TimezoneOption | null {
  if (!timezone) {
    return null;
  }

  const normalized = timezone.trim();
  if (!normalized) {
    return null;
  }

  return TIMEZONE_OPTIONS.find((option) => option.ianaName === normalized) ?? null;
}

export function getBrowserTimezoneOption(): TimezoneOption | null {
  return findTimezoneOption(getBrowserTimezoneName());
}

export function resolveInitialTimezone(preferred?: string | null): string {
  const preferredOption = findTimezoneOption(preferred);
  if (preferredOption) {
    return preferredOption.ianaName;
  }

  const browserOption = getBrowserTimezoneOption();
  return browserOption?.ianaName ?? "";
}

export function getSuggestedTimezone(input: {
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
}): string | null {
  const { latitude, longitude, timezone } = input;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return findTimezoneOption(timezone)?.ianaName ?? null;
}

export function formatTimezoneLabel(timezone: string): string {
  const option = findTimezoneOption(timezone);
  if (!option) {
    return timezone;
  }

  return formatTimezoneOptionLabel(option);
}

function normalizeOffsetLabel(value: string): string {
  const normalized = value.replace("GMT", "UTC");
  if (normalized === "UTC") {
    return "UTC +00:00";
  }

  const match = normalized.match(/^UTC([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return normalized;
  }

  const [, sign, hours, minutes = "00"] = match;
  return `UTC ${sign}${hours.padStart(2, "0")}:${minutes}`;
}

export function getTimezoneUtcOffsetLabel(timezone: string, date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
      minute: "2-digit",
    });
    const timeZoneNamePart = formatter
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value;

    return normalizeOffsetLabel(timeZoneNamePart ?? "UTC");
  } catch {
    return "UTC +00:00";
  }
}

function formatTimezoneRegionAndCity(option: TimezoneOption): string {
  if (option.label.includes(" - ")) {
    const [regionLabel, cityLabel] = option.label.split(" - ", 2);
    return `${regionLabel} (${cityLabel})`;
  }

  return `${option.region} (${option.label})`;
}

export function formatTimezoneOptionLabel(option: TimezoneOption, date = new Date()): string {
  return `${getTimezoneUtcOffsetLabel(option.ianaName, date)} — ${formatTimezoneRegionAndCity(option)}`;
}
