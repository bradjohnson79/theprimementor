import type { ResolvedSystemKey } from "@wisdom/utils";
import type { SystemName } from "../blueprint/types.js";

export type Divin8DeterministicSystem = "vedic" | "western" | "chinese" | "numerology";
export type Divin8InterpretiveSystem =
  | "tarot"
  | "iching"
  | "rune"
  | "kabbalah"
  | "humanDesign"
  | "physiognomy"
  | "bodymap";
export type Divin8NormalizedSystem = Divin8DeterministicSystem | Divin8InterpretiveSystem;
export type Divin8SystemRoute = "ephemeris" | "interpretive";

export interface Divin8SystemExecutionPlan {
  system: Divin8NormalizedSystem;
  route: Divin8SystemRoute;
  blueprintSystem: SystemName | null;
  source: "payload" | "analysis" | "detected";
}

const RAW_SYSTEM_MAP: Record<string, Divin8NormalizedSystem> = {
  vedic: "vedic",
  "vedic astrology": "vedic",
  jyotish: "vedic",
  "western astrology": "western",
  western: "western",
  tropical: "western",
  "chinese astrology": "chinese",
  "chinese zodiac": "chinese",
  chinese: "chinese",
  numerology: "numerology",
  "life path": "numerology",
  tarot: "tarot",
  "i ching": "iching",
  iching: "iching",
  runes: "rune",
  rune: "rune",
  kabbalah: "kabbalah",
  "human design": "humanDesign",
  "human_design": "humanDesign",
  "human-design": "humanDesign",
  humandesign: "humanDesign",
  physiognomy: "physiognomy",
  bodymap: "bodymap",
  "body map": "bodymap",
};

const DETECTED_KEY_MAP: Record<ResolvedSystemKey, Divin8NormalizedSystem> = {
  vedic_astrology: "vedic",
  western_astrology: "western",
  chinese_astrology: "chinese",
  astrology_general: "vedic",
  numerology: "numerology",
  tarot: "tarot",
  iching: "iching",
  human_design: "humanDesign",
  kabbalah: "kabbalah",
  rune: "rune",
};

function uniqueSystems<T extends string>(values: T[]) {
  return [...new Set(values)];
}

export function normalizeDivin8System(value: unknown): Divin8NormalizedSystem | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return RAW_SYSTEM_MAP[normalized] ?? null;
}

export function normalizeDetectedSystemKey(key: ResolvedSystemKey): Divin8NormalizedSystem {
  return DETECTED_KEY_MAP[key];
}

export function routeSystem(system: Divin8NormalizedSystem): Divin8SystemRoute {
  switch (system) {
    case "vedic":
    case "western":
    case "chinese":
    case "numerology":
      return "ephemeris";
    default:
      return "interpretive";
  }
}

export function isDeterministicSystem(system: Divin8NormalizedSystem): system is Divin8DeterministicSystem {
  return routeSystem(system) === "ephemeris";
}

export function toBlueprintSystem(system: Divin8NormalizedSystem): SystemName | null {
  switch (system) {
    case "vedic":
    case "western":
      return "astrology";
    case "chinese":
      return "chinese";
    case "numerology":
      return "numerology";
    case "iching":
      return "iching";
    case "rune":
      return "rune";
    case "kabbalah":
      return "kabbalah";
    case "humanDesign":
      return "humanDesign";
    case "physiognomy":
      return "physiognomy";
    case "bodymap":
      return "bodymap";
    case "tarot":
    default:
      return null;
  }
}

export function buildSystemExecutionPlan(input: {
  explicitSystems?: string[] | null;
  analysisSystems?: string[] | null;
  detectedSystemKeys?: ResolvedSystemKey[];
}) {
  const orderedSystems: Array<{ system: Divin8NormalizedSystem; source: Divin8SystemExecutionPlan["source"] }> = [];
  const seen = new Set<Divin8NormalizedSystem>();

  const append = (
    system: Divin8NormalizedSystem | null,
    source: Divin8SystemExecutionPlan["source"],
  ) => {
    if (!system || seen.has(system)) {
      return;
    }
    seen.add(system);
    orderedSystems.push({ system, source });
  };

  for (const value of input.explicitSystems ?? []) {
    append(normalizeDivin8System(value), "payload");
  }

  for (const value of input.analysisSystems ?? []) {
    append(normalizeDivin8System(value), "analysis");
  }

  for (const key of input.detectedSystemKeys ?? []) {
    append(normalizeDetectedSystemKey(key), "detected");
  }

  return orderedSystems.map(({ system, source }) => ({
    system,
    route: routeSystem(system),
    blueprintSystem: toBlueprintSystem(system),
    source,
  })) satisfies Divin8SystemExecutionPlan[];
}

export function listDeterministicSystems(plans: Divin8SystemExecutionPlan[]) {
  return uniqueSystems(
    plans
      .map((plan) => plan.system)
      .filter((system): system is Divin8DeterministicSystem => isDeterministicSystem(system)),
  ) satisfies Divin8DeterministicSystem[];
}

export function listInterpretiveSystems(plans: Divin8SystemExecutionPlan[]) {
  return uniqueSystems(
    plans
      .map((plan) => plan.system)
      .filter((system): system is Divin8InterpretiveSystem => !isDeterministicSystem(system)),
  ) satisfies Divin8InterpretiveSystem[];
}
