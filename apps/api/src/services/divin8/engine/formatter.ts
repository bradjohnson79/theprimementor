import type { EngineInterpretationRequestContext, NormalizedEngineInterpretationContext } from "../normalizeEngineResultForInterpretation.js";
import type { ParsedAstrologyChart, Divin8CoreSystemResult, Divin8EngineRunStatus, Divin8RouteDecision } from "./types.js";

function uniqueList(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function buildAstrologyLimitations(
  requestContext: EngineInterpretationRequestContext,
  parsed: ParsedAstrologyChart,
) {
  const limitations: string[] = [];

  if (requestContext.comparisonRequested || requestContext.timingPeriod) {
    limitations.push(
      "This result is based on a natal chart computation and does not include a transit or forecasting layer for the requested time window.",
    );
  }

  if (parsed.highlights.confidence !== "full") {
    limitations.push(
      "The chart was computed with reduced confidence. Ascendant-dependent details should be treated more cautiously.",
    );
  }

  if (requestContext.focusAreas.includes("finance")) {
    limitations.push(
      "Financial guidance should be framed as pattern-based interpretation from the chart, not guaranteed events.",
    );
  }

  return uniqueList(limitations);
}

export function formatAstrologyInterpretationContext(input: {
  parsed: ParsedAstrologyChart;
  requestContext: EngineInterpretationRequestContext;
}): NormalizedEngineInterpretationContext {
  return {
    requestIntent: input.requestContext.intent,
    requestedSystems: input.requestContext.requestedSystems,
    focusAreas: input.requestContext.focusAreas,
    comparisonRequested: input.requestContext.comparisonRequested,
    timingPeriod: input.requestContext.timingPeriod,
    systemsUsed: ["astrology"],
    summary: input.parsed.summary,
    keyInsights: input.parsed.keyInsights,
    highlights: input.parsed.highlights,
    limitations: buildAstrologyLimitations(input.requestContext, input.parsed),
  };
}

export function formatPipelineStages(input: {
  route: Divin8RouteDecision;
  engineRun: Divin8EngineRunStatus;
}) {
  return {
    input_received: true,
    routed: input.route.type,
    engine_required: input.route.requiresEngine,
    engine_run: input.engineRun,
    response_sent: true,
  } as const;
}

export function formatSystemDecisionLabel(route: Divin8RouteDecision) {
  return `System: ${route.systemLabel} / Engine: ${route.engineLabel}`;
}

export function getInterpretationContext(result: Divin8CoreSystemResult): NormalizedEngineInterpretationContext | null {
  if (result.status === "success" && result.data.type === "ASTROLOGY") {
    return result.data.interpretation;
  }
  return null;
}
