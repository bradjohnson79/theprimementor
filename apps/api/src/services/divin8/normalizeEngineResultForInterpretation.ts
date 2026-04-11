import type { BlueprintData } from "../blueprint/types.js";
import { compressEngineData, type CompressedEngineData } from "./compressEngineData.js";

export interface EngineInterpretationRequestContext {
  intent: string;
  requestedSystems: string[];
  focusAreas: string[];
  comparisonRequested: boolean;
  timingPeriod: string | null;
}

export interface NormalizedEngineInterpretationContext {
  requestIntent: string;
  requestedSystems: string[];
  focusAreas: string[];
  comparisonRequested: boolean;
  timingPeriod: string | null;
  systemsUsed: string[];
  summary: string | null;
  keyInsights: string[];
  highlights: Record<string, unknown>;
  limitations: string[];
}

function uniqueList(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function buildLimitations(requestContext: EngineInterpretationRequestContext, compressed: CompressedEngineData) {
  const limitations: string[] = [];

  if (requestContext.comparisonRequested || requestContext.timingPeriod) {
    limitations.push(
      "The current engine result is a natal blueprint snapshot and does not include a dedicated transit or forecasting calculation for the requested timing window.",
    );
  }

  if (requestContext.focusAreas.includes("finance")) {
    limitations.push(
      "If discussing money or career, ground the answer in underlying patterns and tendencies from the blueprint rather than claiming guaranteed financial events.",
    );
  }

  if (compressed.systemsUsed.length === 0) {
    limitations.push("No explicit engine systems were recorded in the returned blueprint metadata.");
  }

  return uniqueList(limitations);
}

export function normalizeEngineResultForInterpretation(
  blueprint: BlueprintData,
  requestContext: EngineInterpretationRequestContext,
): NormalizedEngineInterpretationContext {
  const compressed = compressEngineData(blueprint);

  return {
    requestIntent: requestContext.intent,
    requestedSystems: requestContext.requestedSystems,
    focusAreas: requestContext.focusAreas,
    comparisonRequested: requestContext.comparisonRequested,
    timingPeriod: requestContext.timingPeriod,
    systemsUsed: compressed.systemsUsed,
    summary: compressed.summary,
    keyInsights: compressed.keyInsights,
    highlights: compressed.highlights,
    limitations: buildLimitations(requestContext, compressed),
  };
}

export function buildDeterministicEngineRecoveryMessage(
  context: NormalizedEngineInterpretationContext,
) {
  const opening =
    "Here is what comes through from the chart signals we have on hand—I'll keep it grounded and clear.";
  const summary = context.summary ? ` ${context.summary}` : "";
  const insights = context.keyInsights.length > 0
    ? ` Key signals: ${context.keyInsights.slice(0, 3).join("; ")}.`
    : "";
  const timing = context.timingPeriod
    ? ` You asked about ${context.timingPeriod}, so I would treat this as a chart-based tendency reading rather than a precise forecast unless a transit layer is added.`
    : "";
  const limitation = context.limitations[0] ? ` ${context.limitations[0]}` : "";

  return `${opening}${summary}${insights}${timing}${limitation}`.trim();
}
