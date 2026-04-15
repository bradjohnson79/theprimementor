import {
  getAyanamsaUt,
  getJulianDay,
  getPlanetPositionWithSpeed,
  longitudeToSign,
  PLANET_IDS,
} from "../blueprint/swissEphemerisService.js";
import { calculateAdvancedNumerology } from "../blueprint/advancedNumerologyService.js";
import { calculateChineseAstrology } from "../blueprint/chineseAstrologyService.js";
import type { ResolvedDivin8Profile } from "./profilesService.js";
import type { Divin8TimelineRequest } from "@wisdom/utils";
import { routeSystem, type Divin8NormalizedSystem } from "./systemRouting.js";

type TimelineMode =
  | "global_timeline_analysis"
  | "time_range_analysis"
  | "compatibility_timeline_analysis"
  | "timeline_multi_compatibility";

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

interface TimelineSignal {
  date: string;
  label: string;
  weight: number;
}

interface TimelineSystemSummary {
  system: Divin8NormalizedSystem;
  systemLabel: string;
  summary: string;
  phaseLines: string[];
  keyLines: string[];
  interpretationLines: string[];
}

export interface TimelineReadingResult {
  mode: TimelineMode;
  heading: string;
  systemLabel: string;
  summary: string;
  rendered: string;
  systemsUsed: string[];
  systemsDegraded: string[];
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

function uniqueSystems<T extends string>(values: T[]) {
  return [...new Set(values)];
}

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

function buildSystemLabel(system: Divin8NormalizedSystem) {
  switch (system) {
    case "vedic":
      return "Vedic Astrology";
    case "western":
      return "Western Astrology";
    case "chinese":
      return "Chinese Astrology";
    case "numerology":
      return "Numerology";
    case "tarot":
      return "Tarot";
    case "iching":
      return "I Ching";
    case "rune":
      return "Rune";
    case "kabbalah":
      return "Kabbalah";
    case "humanDesign":
      return "Human Design";
    case "physiognomy":
      return "Physiognomy";
    case "bodymap":
      return "Body Map";
    default:
      return system;
  }
}

function reduceNumber(n: number): number {
  if (n === 11 || n === 22 || n === 33) return n;
  let value = Math.abs(n);
  while (value > 9) {
    value = String(value).split("").reduce((sum, digit) => sum + Number(digit), 0);
    if (value === 11 || value === 22 || value === 33) return value;
  }
  return value;
}

function sumDigits(value: string) {
  return value.split("").reduce((sum, digit) => sum + Number(digit), 0);
}

function parseDateParts(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return { year, month, day };
}

function parseBirthHour(profile: ResolvedDivin8Profile) {
  const [hourText] = profile.birthTime.split(":");
  return Number(hourText || "12");
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
  const events: TimelineSignal[] = [];

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

function buildPhases(timeline: Divin8TimelineRequest, events: TimelineSignal[]) {
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
  events: TimelineSignal[],
) {
  const dominant = events[0]?.label ?? "the pressure pattern of the month";
  const secondary = events[1]?.label ?? "the secondary transit wave";

  if (mode === "compatibility_timeline_analysis" || mode === "timeline_multi_compatibility") {
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

function buildSystemPhaseLines(timeline: Divin8TimelineRequest, events: TimelineSignal[]) {
  return buildPhases(timeline, events).map((phase) => `${phase.dateRange} -> ${phase.title}: ${phase.summary}`);
}

async function buildAstrologyTimelineSummary(
  system: "vedic" | "western",
  timeline: Divin8TimelineRequest,
  profiles: ResolvedDivin8Profile[],
  mode: TimelineMode,
): Promise<TimelineSystemSummary> {
  const snapshots = await buildDailySnapshots({
    ...timeline,
    system,
  });
  const events = collectTransitEvents(snapshots);

  return {
    system,
    systemLabel: buildSystemLabel(system),
    summary: events[0]?.label
      ? `${events[0].label} sets the primary ${buildSystemLabel(system).toLowerCase()} activation across ${timeline.tag}.`
      : `A steady ${buildSystemLabel(system).toLowerCase()} build defines ${timeline.tag}.`,
    phaseLines: buildSystemPhaseLines(timeline, events),
    keyLines: events.length > 0
      ? events.map((event) => `${formatShortDate(event.date)}: ${event.label}`)
      : ["No major transit threshold dominated the range, which points to a steadier buildup rather than a sharp break."],
    interpretationLines: buildThematicInterpretation(mode, profiles, events),
  };
}

function buildChineseTimelineSummary(
  timeline: Divin8TimelineRequest,
  profiles: ResolvedDivin8Profile[],
): TimelineSystemSummary {
  const natalProfiles = profiles.map((profile) => {
    const { year, month, day } = parseDateParts(profile.birthDate);
    return {
      profile,
      natal: calculateChineseAstrology(year, month, day, parseBirthHour(profile)),
    };
  });

  const events = buildDateList(timeline.startDate, timeline.endDate)
    .map((isoDate) => {
      const { year, month, day } = parseDateParts(isoDate);
      const daily = calculateChineseAstrology(year, month, day, 12);

      if (natalProfiles.length === 0) {
        return {
          date: isoDate,
          label: `${daily.zodiacAnimal} day shifts the collective tone toward ${daily.element.toLowerCase()} momentum.`,
          weight: 3,
        } satisfies TimelineSignal;
      }

      const supportive = natalProfiles.filter(({ natal }) => daily.compatibility.includes(natal.zodiacAnimal)).length;
      const challenging = natalProfiles.filter(({ natal }) => daily.challenges.includes(natal.zodiacAnimal)).length;

      if (supportive === natalProfiles.length) {
        return {
          date: isoDate,
          label: `${daily.zodiacAnimal} day supports both profiles and opens cleaner relational cooperation.`,
          weight: 5,
        } satisfies TimelineSignal;
      }

      if (challenging > 0) {
        return {
          date: isoDate,
          label: `${daily.zodiacAnimal} day exposes friction, testing how the bond handles pressure and pride.`,
          weight: 4 + challenging,
        } satisfies TimelineSignal;
      }

      return {
        date: isoDate,
        label: `${daily.zodiacAnimal} day keeps the connection in negotiation rather than resolution.`,
        weight: 2,
      } satisfies TimelineSignal;
    })
    .sort((left, right) => right.weight - left.weight || left.date.localeCompare(right.date));

  const dominant = events[0]?.label ?? "Chinese elemental pressure defines the relational field.";
  const secondary = events[1]?.label ?? "The daily animal cycle stays active through the range.";

  return {
    system: "chinese",
    systemLabel: buildSystemLabel("chinese"),
    summary: dominant,
    phaseLines: buildSystemPhaseLines(timeline, events),
    keyLines: events.slice(0, 6).map((event) => `${formatShortDate(event.date)}: ${event.label}`),
    interpretationLines: profiles.length >= 2
      ? [
          `${dominant} This is the Chinese compatibility layer of the timeline, so the question is not whether the connection exists, but when it harmonizes and when it strains.`,
          `The secondary pulse is clear: ${secondary}`,
        ]
      : [
          `${dominant} Read this as a cyclical compatibility weather pattern rather than a static personality verdict.`,
          `The secondary pulse is clear: ${secondary}`,
        ],
  };
}

function buildNumerologyTimelineSummary(
  timeline: Divin8TimelineRequest,
  profiles: ResolvedDivin8Profile[],
): TimelineSystemSummary {
  const profileNumbers = profiles.map((profile) => {
    const { year, month, day } = parseDateParts(profile.birthDate);
    const core = calculateAdvancedNumerology(profile.fullName, year, month, day);
    return {
      profile,
      lifePath: core.lifePath,
    };
  });

  const events = buildDateList(timeline.startDate, timeline.endDate)
    .map((isoDate) => {
      const { year, month, day } = parseDateParts(isoDate);
      const universalDay = reduceNumber(reduceNumber(month) + reduceNumber(day) + reduceNumber(sumDigits(String(year))));

      if (profileNumbers.length < 2) {
        return {
          date: isoDate,
          label: `Universal day ${universalDay} becomes the numerology driver across the range.`,
          weight: 2 + (universalDay === 8 || universalDay === 9 ? 2 : 0),
        } satisfies TimelineSignal;
      }

      const personalDays = profileNumbers.map(({ lifePath }) => reduceNumber(lifePath + universalDay));
      const difference = Math.abs(personalDays[0]! - personalDays[1]!);

      if (difference === 0) {
        return {
          date: isoDate,
          label: `Personal day ${personalDays[0]} mirrors for both profiles, creating a rare alignment window.`,
          weight: 5,
        } satisfies TimelineSignal;
      }

      if (difference <= 2) {
        return {
          date: isoDate,
          label: `Personal days ${personalDays.join(" / ")} stay close enough to keep momentum cooperative.`,
          weight: 4,
        } satisfies TimelineSignal;
      }

      return {
        date: isoDate,
        label: `Personal days ${personalDays.join(" / ")} diverge sharply, exposing timing friction in the connection.`,
        weight: difference >= 5 ? 5 : 3,
      } satisfies TimelineSignal;
    })
    .sort((left, right) => right.weight - left.weight || left.date.localeCompare(right.date));

  const dominant = events[0]?.label ?? "Numerology timing creates the main pressure pattern.";
  const secondary = events[1]?.label ?? "The personal-day rhythm continues underneath the surface.";

  return {
    system: "numerology",
    systemLabel: buildSystemLabel("numerology"),
    summary: dominant,
    phaseLines: buildSystemPhaseLines(timeline, events),
    keyLines: events.slice(0, 6).map((event) => `${formatShortDate(event.date)}: ${event.label}`),
    interpretationLines: [
      `${dominant} In numerology terms, this range is about rhythm and pacing: when the numbers converge, the bond moves; when they split, consequence shows up.`,
      `The secondary pulse is clear: ${secondary}`,
    ],
  };
}

function buildInterpretiveTimelineSummary(
  system: Exclude<Divin8NormalizedSystem, "vedic" | "western" | "chinese" | "numerology">,
  timeline: Divin8TimelineRequest,
  profiles: ResolvedDivin8Profile[],
): TimelineSystemSummary {
  const dates = buildDateList(timeline.startDate, timeline.endDate);
  const phaseCount = Math.min(4, Math.max(1, dates.length));
  const chunkSize = Math.ceil(dates.length / phaseCount);
  const labels = ["Opening Signal", "Pressure Build", "Turning Point", "Integration"];
  const phaseLines: string[] = [];

  for (let index = 0; index < phaseCount; index += 1) {
    const start = dates[index * chunkSize];
    if (!start) break;
    const end = dates[Math.min(dates.length - 1, ((index + 1) * chunkSize) - 1)]!;
    phaseLines.push(
      `${formatShortDate(start)} - ${formatShortDate(end)} -> ${labels[index] ?? `Phase ${index + 1}`}: ${buildSystemLabel(system)} adds symbolic texture to the relationship rather than overriding the structured timeline.`,
    );
  }

  const subject = profiles.length >= 2
    ? `${profiles[0]?.tag ?? "The first profile"} and ${profiles[1]?.tag ?? "the second profile"}`
    : profiles[0]?.tag ?? "This range";

  return {
    system,
    systemLabel: buildSystemLabel(system),
    summary: `${buildSystemLabel(system)} stays adaptive here, deepening the timeline rather than blocking execution.`,
    phaseLines,
    keyLines: [
      `${formatShortDate(timeline.startDate)}: ${buildSystemLabel(system)} opens the symbolic frame for ${subject}.`,
      `${formatShortDate(timeline.endDate)}: ${buildSystemLabel(system)} closes by translating the pressure pattern into meaning rather than refusal.`,
    ],
    interpretationLines: [
      `${buildSystemLabel(system)} is being used adaptively in this timeline, so the role is interpretive depth, not deterministic replacement.`,
      `For ${subject}, this layer clarifies the emotional or symbolic tone of the range without overriding the harder timing signals.`,
    ],
  };
}

function buildAdaptiveSystemSummary(
  system: Divin8NormalizedSystem,
  timeline: Divin8TimelineRequest,
  profiles: ResolvedDivin8Profile[],
): TimelineSystemSummary {
  const base = buildInterpretiveTimelineSummary("tarot", timeline, profiles);
  return {
    ...base,
    system,
    systemLabel: buildSystemLabel(system),
    summary: `${buildSystemLabel(system)} hit a degraded path, so Divin8 kept the timeline moving through adaptive synthesis instead of stopping the reading.`,
  };
}

function buildAdaptiveTimelineFallback(
  timeline: Divin8TimelineRequest,
  systems: Divin8NormalizedSystem[],
): TimelineReadingResult {
  const heading = `Timeline Analysis: ${formatLongDate(timeline.startDate).replace(/, \d{4}$/, "")} - ${formatLongDate(timeline.endDate)}`;
  const systemLabel = systems.length > 0 ? systems.map(buildSystemLabel).join(" + ") : "Adaptive Timeline";

  return {
    mode: "time_range_analysis",
    heading,
    systemLabel,
    summary: "Divin8 adapted the execution path instead of stalling the reading.",
    rendered: [
      heading,
      `Systems: ${systemLabel}`,
      "",
      "Timeline Phases",
      `- ${formatShortDate(timeline.startDate)} - ${formatShortDate(timeline.endDate)} -> Adaptive Continuity: The system stayed responsive instead of refusing the turn.`,
      "",
      "Key Transits",
      "- The requested combination did not map cleanly to one deterministic lane, so Divin8 preserved continuity and synthesized the available signal.",
      "",
      "Thematic Interpretation",
      "- This reading is adaptive rather than blocked: the timeline still carries a coherent pattern even when the system mix needs graceful translation.",
    ].join("\n"),
    systemsUsed: systems,
    systemsDegraded: systems,
  };
}

function synthesizeTimelineSummaries(params: {
  timeline: Divin8TimelineRequest;
  systems: Divin8NormalizedSystem[];
  mode: TimelineMode;
  summaries: TimelineSystemSummary[];
  systemsDegraded: string[];
}) {
  if (params.summaries.length === 0) {
    return buildAdaptiveTimelineFallback(params.timeline, params.systems);
  }

  const heading = `Timeline Analysis: ${formatLongDate(params.timeline.startDate).replace(/, \d{4}$/, "")} - ${formatLongDate(params.timeline.endDate)}`;
  const systemLabel = params.summaries.length === 1
    ? params.summaries[0]!.systemLabel
    : params.summaries.map((summary) => summary.systemLabel).join(" + ");

  return {
    mode: params.mode,
    heading,
    systemLabel,
    summary: params.summaries.map((item) => item.summary).join(" "),
    rendered: [
      heading,
      `Systems: ${systemLabel}`,
      "",
      "Timeline Phases",
      ...params.summaries.flatMap((item) => item.phaseLines.map((line) => `- ${item.systemLabel}: ${line}`)),
      "",
      "Key Transits",
      ...params.summaries.flatMap((item) => item.keyLines.map((line) => `- ${item.systemLabel}: ${line}`)),
      "",
      "Thematic Interpretation",
      ...params.summaries.flatMap((item) => item.interpretationLines.map((line) => `- ${item.systemLabel}: ${line}`)),
    ].join("\n"),
    systemsUsed: uniqueSystems(params.summaries.map((summary) => summary.system)),
    systemsDegraded: params.systemsDegraded,
  } satisfies TimelineReadingResult;
}

export async function buildTimelineReading(params: {
  timeline: Divin8TimelineRequest;
  profiles: ResolvedDivin8Profile[];
  systems?: Divin8NormalizedSystem[];
}): Promise<TimelineReadingResult> {
  const systems = params.systems?.length
    ? params.systems
    : [params.timeline.system];
  const mode: TimelineMode = params.profiles.length >= 2 && systems.length > 1
    ? "timeline_multi_compatibility"
    : params.profiles.length >= 2
      ? "compatibility_timeline_analysis"
      : params.profiles.length === 1
        ? "time_range_analysis"
        : "global_timeline_analysis";

  const summaries: TimelineSystemSummary[] = [];
  const systemsDegraded: string[] = [];

  for (const system of systems) {
    try {
      if (routeSystem(system) === "ephemeris") {
        if (system === "vedic" || system === "western") {
          summaries.push(await buildAstrologyTimelineSummary(system, params.timeline, params.profiles, mode));
        } else if (system === "chinese") {
          summaries.push(buildChineseTimelineSummary(params.timeline, params.profiles));
        } else if (system === "numerology") {
          summaries.push(buildNumerologyTimelineSummary(params.timeline, params.profiles));
        }
      } else {
        summaries.push(buildInterpretiveTimelineSummary(
          system as Exclude<Divin8NormalizedSystem, "vedic" | "western" | "chinese" | "numerology">,
          params.timeline,
          params.profiles,
        ));
      }
    } catch {
      systemsDegraded.push(system);
      summaries.push(buildAdaptiveSystemSummary(system, params.timeline, params.profiles));
    }
  }

  return synthesizeTimelineSummaries({
    timeline: params.timeline,
    systems,
    mode,
    summaries,
    systemsDegraded,
  });
}
