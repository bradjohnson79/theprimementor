import {
  getReportTierDefinition,
  interpretationToSections,
  SECTION_MARKDOWN_LABELS,
  systemsConfigFromIncludeSystems,
  type BlueprintSystemName,
  type ReportTierId,
} from "@wisdom/utils";
import {
  assembleBlueprint,
  interpretBlueprint,
  type BlueprintData,
  type GuestInput,
  type InterpretationReport,
} from "./blueprint/index.js";
import { resolveBirthLocationContext } from "./divin8/locationResolver.js";

export type Divin8Mode = "client" | "order";
export type Divin8ReadingType = "introductory" | "deep_dive" | "initiate";
export type Divin8System =
  | "vedic"
  | "numerology"
  | "runes"
  | "human_design"
  | "chinese_astrology"
  | "kabbalah";

export interface Divin8Input {
  mode: Divin8Mode;
  user_id?: string | null;
  order_id?: string | null;
  birth_date: string;
  birth_time?: string | null;
  birth_location: string;
  reading_type?: Divin8ReadingType | null;
  systems?: Divin8System[] | null;
  questions?: string[] | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface Divin8SectionOutput {
  key: keyof InterpretationReport;
  title: string;
  content: string;
}

export interface Divin8Output {
  summary: string;
  sections: Divin8SectionOutput[];
  systems_used: Divin8System[];
  generated_at: string;
  version: number;
  order_id: string | null;
  user_id: string | null;
}

export interface Divin8ExecutionResult {
  input: Divin8Input;
  output: Divin8Output;
  blueprint: BlueprintData;
  interpretation: InterpretationReport;
  tier: ReportTierId;
  includeSystems: BlueprintSystemName[];
}

interface Divin8ValidationIssue {
  field: string;
  reason: string;
}

type Divin8HttpError = Error & {
  statusCode?: number;
  code?: string;
  details?: Divin8ValidationIssue[];
};

const DEFAULT_SYSTEMS_BY_READING_TYPE: Record<Divin8ReadingType, Divin8System[]> = {
  introductory: ["vedic", "numerology", "runes"],
  deep_dive: ["vedic", "numerology", "runes", "human_design", "chinese_astrology"],
  initiate: ["vedic", "numerology", "runes", "human_design", "chinese_astrology", "kabbalah"],
};

const SYSTEM_TO_BLUEPRINT: Record<Divin8System, BlueprintSystemName> = {
  vedic: "astrology",
  numerology: "numerology",
  runes: "rune",
  human_design: "humanDesign",
  chinese_astrology: "chinese",
  kabbalah: "kabbalah",
};

function createDivin8Error(
  statusCode: number,
  message: string,
  details?: Divin8ValidationIssue[],
  code = "DIVIN8_VALIDATION_ERROR",
): Divin8HttpError {
  const error = new Error(message) as Divin8HttpError;
  error.statusCode = statusCode;
  error.code = code;
  if (details?.length) {
    error.details = details;
  }
  return error;
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeReadingType(value: unknown): Divin8ReadingType {
  if (value === "deep_dive" || value === "initiate") return value;
  return "introductory";
}

function mapReadingTypeToTier(readingType: Divin8ReadingType): ReportTierId {
  switch (readingType) {
    case "deep_dive":
      return "deep_dive";
    case "initiate":
      return "initiate";
    default:
      return "intro";
  }
}

function normalizeSystem(value: unknown): Divin8System | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "vedic":
    case "numerology":
    case "kabbalah":
      return normalized;
    case "rune":
    case "runes":
      return "runes";
    case "human_design":
    case "human-design":
    case "humandesign":
      return "human_design";
    case "chinese":
    case "chinese_astrology":
    case "chinese-astrology":
      return "chinese_astrology";
    default:
      return null;
  }
}

function normalizeSystemsList(value: unknown): Divin8System[] {
  if (!Array.isArray(value)) return [];
  const systems = value
    .map((item) => normalizeSystem(item))
    .filter((item): item is Divin8System => Boolean(item));
  return Array.from(new Set(systems));
}

export function resolveSystems(
  readingType: Divin8ReadingType,
  explicitSystems?: Divin8System[] | null,
): Divin8System[] {
  if (explicitSystems?.length) {
    return Array.from(new Set(explicitSystems));
  }
  return [...DEFAULT_SYSTEMS_BY_READING_TYPE[readingType]];
}

function requiresBirthTime(systems: Divin8System[]) {
  return systems.some((system) =>
    system === "vedic"
    || system === "human_design"
    || system === "chinese_astrology"
    || system === "kabbalah");
}

function validateInput(input: Divin8Input, systems: Divin8System[]) {
  const issues: Divin8ValidationIssue[] = [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.birth_date)) {
    issues.push({ field: "birth_date", reason: "Birth date must use YYYY-MM-DD format." });
  }

  if (!getString(input.birth_location)) {
    issues.push({ field: "birth_location", reason: "Birth location is required." });
  }

  const birthTime = input.birth_time ? input.birth_time.trim() : null;
  if (birthTime && !/^\d{2}:\d{2}(:\d{2})?$/.test(birthTime)) {
    issues.push({ field: "birth_time", reason: "Birth time must use HH:MM or HH:MM:SS format." });
  }

  if (requiresBirthTime(systems) && !birthTime) {
    issues.push({
      field: "birth_time",
      reason: "Birth time is required for the selected systems.",
    });
  }

  if (issues.length > 0) {
    throw createDivin8Error(400, "Divin8 input validation failed.", issues);
  }
}

function buildGuestInput(input: Divin8Input): GuestInput {
  const fullName = getString(input.metadata?.full_name) ?? getString(input.metadata?.client_name) ?? "Client";
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "Client";
  const lastName = parts.slice(1).join(" ") || "Reading";

  return {
    firstName,
    lastName,
    birthDate: input.birth_date,
    birthTime: getString(input.birth_time),
    birthLocation: getString(input.birth_location),
  };
}

function buildOutput(
  input: Divin8Input,
  systemsUsed: Divin8System[],
  interpretation: InterpretationReport,
): Divin8Output {
  const sections = interpretationToSections(interpretation);
  return {
    summary: sections.overview,
    sections: Object.entries(sections).map(([key, content]) => ({
      key: key as keyof InterpretationReport,
      title: SECTION_MARKDOWN_LABELS[key as keyof typeof SECTION_MARKDOWN_LABELS],
      content,
    })),
    systems_used: systemsUsed,
    generated_at: new Date().toISOString(),
    version: 1,
    order_id: input.order_id ?? null,
    user_id: input.user_id ?? null,
  };
}

function toBlueprintSystems(systems: Divin8System[]): BlueprintSystemName[] {
  return systems.map((system) => SYSTEM_TO_BLUEPRINT[system]);
}

export async function runDivin8Execution(input: Divin8Input): Promise<Divin8ExecutionResult> {
  const readingType = normalizeReadingType(input.reading_type);
  const resolvedSystems = resolveSystems(readingType, normalizeSystemsList(input.systems));
  validateInput(input, resolvedSystems);

  const includeSystems = toBlueprintSystems(resolvedSystems);
  const guest = buildGuestInput(input);
  const tier = mapReadingTypeToTier(readingType);
  const tierDefinition = getReportTierDefinition(tier);

  let resolvedCoordinates: { latitude: number; longitude: number; formattedAddress: string } | undefined;
  let resolvedUtcOffsetMinutes: number | undefined;

  if (includeSystems.includes("astrology")) {
    const birthLocation = guest.birthLocation ?? input.birth_location;
    const birthTime = guest.birthTime ?? input.birth_time ?? "";
    const locationContext = await resolveBirthLocationContext({
      birthLocation,
      birthDate: guest.birthDate,
      birthTime,
      timezone: null,
    });
    resolvedCoordinates = locationContext.coordinates;
    resolvedUtcOffsetMinutes = locationContext.utcOffsetMinutes;
  }

  const blueprint = await assembleBlueprint(
    {
      id: input.user_id ?? input.order_id ?? "divin8",
      fullBirthName: `${guest.firstName} ${guest.lastName}`.trim(),
      birthDate: guest.birthDate,
      birthTime: guest.birthTime,
      birthLocation: guest.birthLocation,
    },
    includeSystems,
    tier,
    systemsConfigFromIncludeSystems(includeSystems.length > 0 ? includeSystems : tierDefinition.includeSystems),
    resolvedCoordinates,
    undefined,
    resolvedUtcOffsetMinutes,
  );
  const interpretation = await interpretBlueprint(blueprint, tier);
  const output = buildOutput(input, resolvedSystems, interpretation);

  return {
    input: {
      ...input,
      reading_type: readingType,
      systems: resolvedSystems,
      birth_time: getString(input.birth_time),
      birth_location: getString(input.birth_location) ?? input.birth_location,
    },
    output,
    blueprint,
    interpretation,
    tier,
    includeSystems,
  };
}

export async function runDivin8Reading(input: Divin8Input): Promise<Divin8Output> {
  const result = await runDivin8Execution(input);
  return result.output;
}
