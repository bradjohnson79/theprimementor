import type { SystemName } from "../../blueprint/types.js";
import type { Divin8DetectedSystem } from "../divin8Orchestrator.js";
import type { Divin8RouteDecision } from "./types.js";

const ASTROLOGY_KEYS = new Set(["vedic_astrology", "astrology_general", "western_astrology"]);
const ASTROLOGY_SYSTEMS = new Set<SystemName>(["astrology"]);
const DETERMINISTIC_SYSTEMS = new Set<SystemName>(["astrology", "numerology", "chinese"]);

function normalizeConfidence(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function routeDivin8Request(input: {
  message: string;
  detectedSystems: Divin8DetectedSystem[];
  requestedSystems: SystemName[];
}): Divin8RouteDecision {
  const requestedAstrology = input.requestedSystems.some((system) => ASTROLOGY_SYSTEMS.has(system));
  const requestedDeterministic = input.requestedSystems.some((system) => DETERMINISTIC_SYSTEMS.has(system));
  const astrologySignals = input.detectedSystems.filter((system) => ASTROLOGY_KEYS.has(system.key));
  const highestSignal = astrologySignals[0]?.score ?? 0;
  const messageAstroHint = /\b(astrology|birth chart|chart|vedic|sidereal|jyotish|natal)\b/i.test(input.message);

  if (requestedDeterministic || requestedAstrology || astrologySignals.length > 0 || messageAstroHint) {
    const confidence = requestedDeterministic || requestedAstrology
      ? 0.98
      : astrologySignals.length > 0
        ? normalizeConfidence(0.55 + highestSignal / 25)
        : 0.62;

    const engineLabel = input.requestedSystems.length > 1
      ? "Multi-engine deterministic"
      : requestedAstrology
        ? "Swiss Ephemeris"
        : "Deterministic engine";
    const systemLabel = input.requestedSystems.length > 1
      ? "Multi-system"
      : requestedAstrology
        ? "Astrology"
        : "Deterministic";

    return {
      type: "ASTROLOGY",
      requiresEngine: true,
      strict: true,
      confidence,
      requestedSystems: input.requestedSystems,
      matchedSignals: astrologySignals.flatMap((system) => system.matchedKeywords),
      systemLabel,
      engineLabel,
    };
  }

  const confidence = input.requestedSystems.length === 0 ? 0.92 : 0.75;
  return {
    type: "GENERAL",
    requiresEngine: false,
    strict: false,
    confidence,
    requestedSystems: input.requestedSystems,
    matchedSignals: [],
    systemLabel: "General",
    engineLabel: "GPT",
  };
}
