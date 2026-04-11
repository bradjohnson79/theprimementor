import type { EngineInterpretationRequestContext, NormalizedEngineInterpretationContext } from "../normalizeEngineResultForInterpretation.js";
import { formatAstrologyInterpretationContext } from "./formatter.js";
import type { ParsedAstrologyChart } from "./types.js";

export function buildAstrologyInterpreterContext(input: {
  parsed: ParsedAstrologyChart;
  requestContext: EngineInterpretationRequestContext;
}): NormalizedEngineInterpretationContext {
  return formatAstrologyInterpretationContext(input);
}
