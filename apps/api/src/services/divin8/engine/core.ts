import { logger } from "@wisdom/utils";
import { resolveBirthLocationContext } from "../locationResolver.js";
import { buildAstrologyInterpreterContext } from "./astroInterpreter.js";
import { parseAstrologyChart } from "./astroParser.js";
import { runStrictAstrologyEphemeris, validateStrictAstrologyInput } from "./ephemeris.js";
import { logCoreSystemEvent, logCoreSystemResult, logRouteDecision } from "./logger.js";
import type { Divin8CoreSystemInput, Divin8CoreSystemResult, Divin8ResolvedBirthContext } from "./types.js";

export async function runCoreSystem(input: Divin8CoreSystemInput): Promise<Divin8CoreSystemResult> {
  logRouteDecision(input.route);
  logCoreSystemEvent("input", {
    threadId: input.threadId,
    userId: input.userId,
    route: input.route.type,
    strict: input.route.strict,
  });

  if (input.route.type === "GENERAL" || !input.route.requiresEngine) {
    const result: Divin8CoreSystemResult = {
      status: "success",
      route: input.route,
      engineRun: "SKIPPED",
      data: {
        type: "GENERAL",
        interpretation: null,
      },
    };
    logCoreSystemResult(result);
    return result;
  }

  const birthDate = input.profile.birthDate;
  const birthTime = input.profile.birthTime;
  const birthLocation = input.profile.birthLocation;

  if (!birthDate || !birthTime || !birthLocation) {
    const missingFields = [
      !birthDate ? "birth date (e.g. March 22, 1979)" : null,
      !birthTime ? "birth time (e.g. 7:08 PM)" : null,
      !birthLocation ? "birth location (e.g. Vancouver, BC, Canada)" : null,
    ].filter((value): value is string => Boolean(value));

    const result: Divin8CoreSystemResult = {
      status: "error",
      route: input.route,
      engineRun: "FAIL",
      errorCode: "MISSING_BIRTH_DATA",
      error: `Strict astrology requires ${missingFields.join("; ")}.`,
      userMessage: `To run a precise astrological calculation with Swiss Ephemeris, I need your ${missingFields.join("; ")}. You can type it naturally and I will figure out the rest.`,
    };
    logCoreSystemResult(result);
    return result;
  }

  let resolvedBirthContext: Divin8ResolvedBirthContext;
  try {
    resolvedBirthContext = input.resolvedBirthContext ?? await resolveBirthLocationContext({
      birthLocation,
      birthDate,
      birthTime,
      timezone: input.profile.timezone,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Birth location could not be resolved.";
    logger.error("divin8_core_location_resolution_failed", {
      birthLocation,
      timezone: input.profile.timezone,
      message,
    });
    const result: Divin8CoreSystemResult = {
      status: "error",
      route: input.route,
      engineRun: "FAIL",
      errorCode: "LOCATION_RESOLUTION_FAILED",
      error: `Location resolution failed for "${birthLocation}": ${message}`,
      userMessage:
        `I’m close to finishing the astrology calculation. I couldn’t confidently lock in "${birthLocation}" yet. Share the birthplace as city, region/state, country (for example: "Port Alberni, British Columbia, Canada"), and I’ll run it immediately.`,
    };
    logCoreSystemResult(result);
    return result;
  }

  const validation = validateStrictAstrologyInput({
    birthDate,
    birthTime,
    coordinates: resolvedBirthContext.coordinates,
    utcOffsetMinutes: resolvedBirthContext.utcOffsetMinutes,
  });

  if (validation.valid === false) {
    const validationError = validation.error;
    const fieldHints = validationError.missingFields?.length
      ? validationError.missingFields.join(", ")
      : "valid date, time, and coordinates";
    const result: Divin8CoreSystemResult = {
      status: "error",
      route: input.route,
      engineRun: "FAIL",
      errorCode: validationError.errorCode,
      error: `Input validation failed: ${validationError.error} (missing: ${fieldHints})`,
      userMessage: validationError.errorCode === "MISSING_BIRTH_DATA"
        ? `I need your ${fieldHints} to run the Swiss Ephemeris calculation. Just type them naturally, for example: "born March 22 1979 at 7:08pm in Vancouver BC".`
        : `Something about the birth data could not be parsed for the ephemeris engine. Could you resend your birth date, time, and location in one message? Example: "March 22, 1979 at 7:08 PM, Port Alberni, BC, Canada"`,
    };
    logCoreSystemResult(result);
    return result;
  }

  try {
    const ephemeris = await runStrictAstrologyEphemeris(validation.value);
    const parsed = parseAstrologyChart(ephemeris.astrology);
    const interpretation = buildAstrologyInterpreterContext({
      parsed,
      requestContext: {
        intent: input.requestIntent,
        requestedSystems: input.route.requestedSystems,
        focusAreas: input.focusAreas,
        comparisonRequested: input.comparisonRequested,
        timingPeriod: input.timingPeriod,
      },
    });

    const result: Divin8CoreSystemResult = {
      status: "success",
      route: input.route,
      engineRun: "SUCCESS",
      data: {
        type: "ASTROLOGY",
        astrology: ephemeris.astrology,
        parsed,
        interpretation,
        resolvedBirthContext,
      },
    };
    logCoreSystemResult(result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Strict astrology computation failed.";
    logger.error("divin8_core_ephemeris_failed", {
      threadId: input.threadId,
      message,
    });
    const result: Divin8CoreSystemResult = {
      status: "error",
      route: input.route,
      engineRun: "FAIL",
      errorCode: "STRICT_ENGINE_FAILED",
      error: `Ephemeris computation error: ${message}`,
      userMessage:
        "The Swiss Ephemeris calculation hit an unexpected error. I will not fabricate chart data. Please try again in a moment, or resend your birth info in one message so I can retry the calculation.",
    };
    logCoreSystemResult(result);
    return result;
  }
}
