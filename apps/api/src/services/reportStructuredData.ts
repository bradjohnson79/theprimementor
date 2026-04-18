import type {
  BlueprintData,
  ReportStructuredData,
  SwissEphemerisAspectRow,
  SwissEphemerisPlanetRow,
} from "./blueprint/types.js";

const REPORT_TIMEZONE = "America/Vancouver";
const PLANET_DISPLAY_ORDER = [
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
] as const;

const PLANET_NOTES: Record<string, string> = {
  Sun: "Core identity and vitality",
  Moon: "Emotional body and instinct",
  Mercury: "Mind, language, and processing",
  Venus: "Values, attraction, and receptivity",
  Mars: "Drive, friction, and action",
  Jupiter: "Growth, faith, and wisdom",
  Saturn: "Structure, pressure, and maturation",
  Uranus: "Awakening, disruption, and change",
  Neptune: "Imagination, surrender, and diffusion",
  Pluto: "Depth, power, and transformation",
  Ascendant: "Outer orientation and immediate approach",
};

const MAJOR_ASPECTS = [
  { label: "Conjunction", angle: 0, maxOrb: 8 },
  { label: "Sextile", angle: 60, maxOrb: 4 },
  { label: "Square", angle: 90, maxOrb: 6 },
  { label: "Trine", angle: 120, maxOrb: 6 },
  { label: "Opposition", angle: 180, maxOrb: 8 },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ordinalHouse(value: number | null | undefined) {
  if (!value || value < 1) return "—";
  const suffix = value % 10 === 1 && value % 100 !== 11
    ? "st"
    : value % 10 === 2 && value % 100 !== 12
      ? "nd"
      : value % 10 === 3 && value % 100 !== 13
        ? "rd"
        : "th";
  return `${value}${suffix}`;
}

function formatDegreeMinutes(longitude: number) {
  const normalized = ((longitude % 360) + 360) % 360;
  const degree = Math.floor(normalized % 30);
  const minute = Math.round(((normalized % 30) - degree) * 60);
  const safeMinute = minute === 60 ? 59 : minute;
  return `${degree}deg ${String(safeMinute).padStart(2, "0")}'`;
}

function formatOrb(degrees: number) {
  const whole = Math.floor(degrees);
  const minutes = Math.round((degrees - whole) * 60);
  const safeMinutes = minutes === 60 ? 59 : minutes;
  return `${whole}deg ${String(safeMinutes).padStart(2, "0")}'`;
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIMEZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatBirthTimeLabel(value: string | null, timezone: string | null) {
  if (!value?.trim()) return "Unknown";
  const suffix = timezone?.trim() ? ` ${timezone.trim()}` : "";
  return `${value.trim()}${suffix}`;
}

function coerceBirthLocation(
  blueprint: BlueprintData,
  fallbackBirthLocation?: string | null,
) {
  return fallbackBirthLocation?.trim()
    || blueprint.core.birthData.birthLocation?.trim()
    || blueprint.client.birthLocation?.trim()
    || null;
}

function extractPurchaseIntakeName(purchaseIntake: unknown) {
  if (!isRecord(purchaseIntake)) return null;
  const candidate = purchaseIntake.fullName;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

function formatBirthDateLabel(value: string) {
  const candidate = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(candidate.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIMEZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(candidate);
}

function buildPlanetRows(
  blueprint: BlueprintData,
): SwissEphemerisPlanetRow[] {
  const astrology = blueprint.astrology;
  if (!astrology) return [];

  const baseRows = PLANET_DISPLAY_ORDER
    .map((body) => astrology.planets.find((planet) => planet.planet === body))
    .filter((planet): planet is NonNullable<typeof astrology.planets[number]> => Boolean(planet))
    .map((planet) => ({
      body: planet.planet,
      longitude: planet.longitude,
      position: formatDegreeMinutes(planet.longitude),
      sign: planet.sign,
      house: ordinalHouse(planet.house),
      notes: PLANET_NOTES[planet.planet] ?? "",
    }));

  if (astrology.ascendant) {
    baseRows.push({
      body: "Ascendant",
      longitude: astrology.ascendant.longitude,
      position: formatDegreeMinutes(astrology.ascendant.longitude),
      sign: astrology.ascendant.sign,
      house: "1st",
      notes: PLANET_NOTES.Ascendant,
    });
  }

  return baseRows;
}

function angularDistance(left: number, right: number) {
  const raw = Math.abs(left - right) % 360;
  return raw > 180 ? 360 - raw : raw;
}

function buildAspectRows(rows: SwissEphemerisPlanetRow[]): SwissEphemerisAspectRow[] {
  const aspects: SwissEphemerisAspectRow[] = [];
  for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
      const left = rows[leftIndex];
      const right = rows[rightIndex];
      const distance = angularDistance(left.longitude, right.longitude);
      const match = MAJOR_ASPECTS
        .map((definition) => ({
          definition,
          orbDegrees: Math.abs(distance - definition.angle),
        }))
        .filter((candidate) => candidate.orbDegrees <= candidate.definition.maxOrb)
        .sort((first, second) => first.orbDegrees - second.orbDegrees)[0];

      if (!match) continue;

      aspects.push({
        aspect: match.definition.label,
        planets: `${left.body} - ${right.body}`,
        orb: formatOrb(match.orbDegrees),
        orbDegrees: Number(match.orbDegrees.toFixed(4)),
      });
    }
  }

  return aspects.sort((first, second) => first.orbDegrees - second.orbDegrees);
}

export interface BuildReportStructuredDataOptions {
  blueprint: BlueprintData;
  reportDate: string;
  purchaseIntake?: unknown;
  birthPlaceName?: string | null;
  birthTimezone?: string | null;
}

export function buildReportStructuredData({
  blueprint,
  reportDate,
  purchaseIntake,
  birthPlaceName,
  birthTimezone,
}: BuildReportStructuredDataOptions): ReportStructuredData {
  const clientName = extractPurchaseIntakeName(purchaseIntake)
    || blueprint.core.birthData.fullBirthName
    || blueprint.client.fullBirthName
    || "Client";
  const birthDate = blueprint.core.birthData.birthDate || blueprint.client.birthDate || "";
  const birthTime = blueprint.core.birthData.birthTime || blueprint.client.birthTime || null;
  const birthLocation = coerceBirthLocation(blueprint, birthPlaceName);
  const planets = buildPlanetRows(blueprint);
  const aspects = buildAspectRows(planets);

  return {
    reportDateIso: reportDate,
    reportDateLabel: formatDateLabel(reportDate),
    clientInfo: {
      clientName,
      birthDate,
      birthDateLabel: birthDate ? formatBirthDateLabel(birthDate) : "Unknown",
      birthTime,
      birthTimeLabel: formatBirthTimeLabel(birthTime, birthTimezone ?? null),
      birthLocation,
      birthLocationLabel: birthLocation ?? "Unknown",
      birthTimezone: birthTimezone ?? null,
    },
    astronomicalCalculations: {
      title: "Astronomical Calculations",
      subtitle: "Swiss Ephemeris - Sidereal System",
      planets,
      aspects,
    },
  };
}
