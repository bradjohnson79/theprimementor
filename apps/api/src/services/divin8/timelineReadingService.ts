import {
  getAyanamsaUt,
  getJulianDay,
  getPlanetPositionWithSpeed,
  longitudeToSign,
  PLANET_IDS,
} from "../blueprint/swissEphemerisService.js";
import type { ResolvedDivin8Profile } from "./profilesService.js";
import type { Divin8TimelineRequest } from "@wisdom/utils";

type TimelineMode =
  | "global_timeline_analysis"
  | "time_range_analysis"
  | "compatibility_timeline_analysis";

type PlanetKey =
  | "sun"
  | "moon"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn"
  | "northNode";

interface DailySnapshot {
  isoDate: string;
  displayDate: string;
  planets: Record<PlanetKey, { longitude: number; speed: number; sign: string }>;
}

interface TimelineEvent {
  date: string;
  label: string;
  weight: number;
}

export interface TimelineReadingResult {
  mode: TimelineMode;
  heading: string;
  systemLabel: string;
  summary: string;
  rendered: string;
}

const PLANET_ORDER: Array<{ key: PlanetKey; label: string; id: number }> = [
  { key: "sun", label: "Sun", id: PLANET_IDS.SUN },
  { key: "moon", label: "Moon", id: PLANET_IDS.MOON },
  { key: "mercury", label: "Mercury", id: PLANET_IDS.MERCURY },
  { key: "venus", label: "Venus", id: PLANET_IDS.VENUS },
  { key: "mars", label: "Mars", id: PLANET_IDS.MARS },
  { key: "jupiter", label: "Jupiter", id: PLANET_IDS.JUPITER },
  { key: "saturn", label: "Saturn", id: PLANET_IDS.SATURN },
  { key: "northNode", label: "North Node", id: PLANET_IDS.NORTH_NODE },
];

const ASPECT_TARGETS = [
  { angle: 0, label: "conjunction", weight: 4 },
  { angle: 90, label: "square", weight: 5 },
  { angle: 120, label: "trine", weight: 3 },
  { angle: 180, label: "opposition", weight: 5 },
] as const;

const ASPECT_PAIRS: Array<[PlanetKey, PlanetKey]> = [
  ["sun", "mars"],
  ["sun", "jupiter"],
  ["sun", "saturn"],
  ["mercury", "mars"],
  ["venus", "saturn"],
  ["venus", "jupiter"],
  ["mars", "saturn"],
  ["jupiter", "saturn"],
];

function normalizeAngle(value: number) {
  return ((value % 360) + 360) % 360;
}

function shortestAngle(a: number, b: number) {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return diff > 180 ? 360 - diff : diff;
}

function formatLongDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

function formatShortDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

function buildDateList(startDate: string, endDate: string) {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function toSystemLongitude(longitude: number, julianDay: number, system: Divin8TimelineRequest["system"]) {
  if (system === "western") {
    return normalizeAngle(longitude);
  }
  return normalizeAngle(longitude - getAyanamsaUt(julianDay));
}

function planetLabel(key: PlanetKey) {
  return PLANET_ORDER.find((planet) => planet.key === key)?.label ?? key;
}

async function buildDailySnapshots(timeline: Divin8TimelineRequest) {
  const dates = buildDateList(timeline.startDate, timeline.endDate);
  const snapshots: DailySnapshot[] = [];

  for (const isoDate of dates) {
    const [year, month, day] = isoDate.split("-").map(Number);
    const julianDay = getJulianDay(year, month, day, 12);
    const planets = await Promise.all(
      PLANET_ORDER.map(async (planet) => {
        const raw = await getPlanetPositionWithSpeed(julianDay, planet.id);
        const longitude = toSystemLongitude(raw.longitude, julianDay, timeline.system);
        return [
          planet.key,
          {
            longitude,
            speed: raw.speed,
            sign: longitudeToSign(longitude).sign,
          },
        ] as const;
      }),
    );

    snapshots.push({
      isoDate,
      displayDate: formatShortDate(isoDate),
      planets: Object.fromEntries(planets) as DailySnapshot["planets"],
    });
  }

  return snapshots;
}

function collectTransitEvents(snapshots: DailySnapshot[]) {
  const events: TimelineEvent[] = [];

  for (let index = 1; index < snapshots.length; index += 1) {
    const current = snapshots[index]!;
    const previous = snapshots[index - 1]!;

    for (const planet of PLANET_ORDER) {
      const currentPlanet = current.planets[planet.key];
      const previousPlanet = previous.planets[planet.key];

      if (planet.key !== "moon" && currentPlanet.sign !== previousPlanet.sign) {
        events.push({
          date: current.isoDate,
          label: `${planet.label} enters ${currentPlanet.sign}`,
          weight: 3,
        });
      }

      if (planet.key !== "sun" && planet.key !== "moon" && currentPlanet.speed < 0 && previousPlanet.speed >= 0) {
        events.push({
          date: current.isoDate,
          label: `${planet.label} stations retrograde in ${currentPlanet.sign}`,
          weight: 5,
        });
      }

      if (planet.key !== "sun" && planet.key !== "moon" && currentPlanet.speed >= 0 && previousPlanet.speed < 0) {
        events.push({
          date: current.isoDate,
          label: `${planet.label} stations direct in ${currentPlanet.sign}`,
          weight: 4,
        });
      }
    }

    for (const [leftKey, rightKey] of ASPECT_PAIRS) {
      const currentAngle = shortestAngle(current.planets[leftKey].longitude, current.planets[rightKey].longitude);
      const previousAngle = shortestAngle(previous.planets[leftKey].longitude, previous.planets[rightKey].longitude);
      for (const target of ASPECT_TARGETS) {
        const currentDistance = Math.abs(currentAngle - target.angle);
        const previousDistance = Math.abs(previousAngle - target.angle);
        if (currentDistance <= 3 && previousDistance > 3) {
          events.push({
            date: current.isoDate,
            label: `${planetLabel(leftKey)} ${target.label} ${planetLabel(rightKey)}`,
            weight: target.weight,
          });
        }
      }
    }
  }

  return events
    .sort((left, right) => right.weight - left.weight || left.date.localeCompare(right.date))
    .slice(0, 8);
}

function buildPhases(timeline: Divin8TimelineRequest, events: TimelineEvent[]) {
  const dates = buildDateList(timeline.startDate, timeline.endDate);
  const phaseCount = Math.min(4, Math.max(1, dates.length));
  const chunkSize = Math.ceil(dates.length / phaseCount);
  const labels = ["Initial Shift", "Intensification", "Turning Point", "Integration"];

  const phases: Array<{ title: string; dateRange: string; summary: string }> = [];
  for (let index = 0; index < phaseCount; index += 1) {
    const start = dates[index * chunkSize];
    if (!start) {
      break;
    }
    const end = dates[Math.min(dates.length - 1, ((index + 1) * chunkSize) - 1)]!;
    const phaseEvents = events.filter((event) => event.date >= start && event.date <= end);
    const summary = phaseEvents[0]?.label ?? (index === 0
      ? "Signals gather and the pattern starts to reveal itself."
      : index === phaseCount - 1
        ? "The range settles into integration and consequence."
        : "Momentum continues building through the middle of the window.");
    phases.push({
      title: labels[index] ?? `Phase ${index + 1}`,
      dateRange: `${formatShortDate(start)} - ${formatShortDate(end)}`,
      summary,
    });
  }
  return phases;
}

function buildThematicInterpretation(
  mode: TimelineMode,
  profiles: ResolvedDivin8Profile[],
  events: TimelineEvent[],
) {
  const dominant = events[0]?.label ?? "the pressure pattern of the month";
  const secondary = events[1]?.label ?? "the secondary transit wave";

  if (mode === "compatibility_timeline_analysis") {
    return [
      `${profiles[0]?.tag ?? "The first profile"} and ${profiles[1]?.tag ?? "the second profile"} move through this range as a relationship weather system rather than two isolated stories. ${dominant} defines the main pressure point, while ${secondary} shows where the bond either matures or exposes friction that can no longer stay hidden.`,
      "The strongest reading here is cause and effect: when communication tightens, attraction and tension rise together. This is a period for honest recalibration, not passive drifting.",
    ];
  }

  if (mode === "time_range_analysis") {
    return [
      `${profiles[0]?.tag ?? "This profile"} is not moving through a vague forecast. ${dominant} marks the main activation window, and ${secondary} shows where the timeline pivots from buildup into visible consequence.`,
      "Read this range as transit pressure meeting the natal baseline: decisions made early in the window set the tone, while the later phase reveals what is sustainable and what is not.",
    ];
  }

  return [
    `This is a collective reading, so the focus is on shared atmosphere rather than private biography. ${dominant} shapes the main field, and ${secondary} amplifies the social, political, or economic tone surrounding the range.`,
    "The month is best read as a sequence of pressure waves: opening movement, tightening conditions, a visible turning point, and then integration.",
  ];
}

export async function buildTimelineReading(params: {
  timeline: Divin8TimelineRequest;
  profiles: ResolvedDivin8Profile[];
}): Promise<TimelineReadingResult> {
  const mode: TimelineMode = params.profiles.length >= 2
    ? "compatibility_timeline_analysis"
    : params.profiles.length === 1
      ? "time_range_analysis"
      : "global_timeline_analysis";
  const snapshots = await buildDailySnapshots(params.timeline);
  const events = collectTransitEvents(snapshots);
  const phases = buildPhases(params.timeline, events);
  const interpretation = buildThematicInterpretation(mode, params.profiles, events);
  const systemLabel = params.timeline.system === "western" ? "Western Astrology" : "Vedic Astrology";
  const heading = `Timeline Analysis: ${formatLongDate(params.timeline.startDate).replace(/, \d{4}$/, "")} - ${formatLongDate(params.timeline.endDate)}`;
  const keyTransitLines = events.length > 0
    ? events.map((event) => `- ${formatShortDate(event.date)}: ${event.label}`)
    : ["- No major transit threshold dominated the range, which points to a steadier buildup rather than a sharp break."];
  const phaseLines = phases.map((phase) => `- ${phase.dateRange} -> ${phase.title}: ${phase.summary}`);
  const interpretationLines = interpretation.map((line) => `- ${line}`);
  const summary = events[0]?.label
    ? `${events[0].label} sets the primary activation across ${params.timeline.tag}.`
    : `A steady transit build defines ${params.timeline.tag}.`;

  return {
    mode,
    heading,
    systemLabel,
    summary,
    rendered: [
      heading,
      `System: ${systemLabel}`,
      "",
      "Timeline Phases",
      ...phaseLines,
      "",
      "Key Transits",
      ...keyTransitLines,
      "",
      "Thematic Interpretation",
      ...interpretationLines,
    ].join("\n"),
  };
}
