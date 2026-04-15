import { systemsConfigFromIncludeSystems, type BlueprintSystemName } from "@wisdom/utils";
import { resolveBirthLocationContext } from "../locationResolver.js";
import { assembleBlueprint } from "../../blueprint/index.js";
import { calculateAstrology, longitudeToSign } from "../../blueprint/swissEphemerisService.js";
import { normalizeEngineResultForInterpretation, type NormalizedEngineInterpretationContext } from "../normalizeEngineResultForInterpretation.js";
import { localToUtc } from "./astrologyUtils.js";
import { validateStrictAstrologyInput } from "./ephemeris.js";
import { logCoreSystemEvent, logCoreSystemResult, logRouteDecision } from "./logger.js";
import type { Divin8CoreSystemInput, Divin8CoreSystemResult, Divin8ResolvedBirthContext } from "./types.js";
import type { Divin8DeterministicSystem } from "../systemRouting.js";

function buildRequestContext(input: Divin8CoreSystemInput) {
  return {
    intent: input.requestIntent,
    requestedSystems: input.route.requestedSystems,
    focusAreas: input.focusAreas,
    comparisonRequested: input.comparisonRequested,
    timingPeriod: input.timingPeriod,
  };
}

function buildMissingBirthDataResult(input: Divin8CoreSystemInput, missingFields: string[]): Divin8CoreSystemResult {
  const result: Divin8CoreSystemResult = {
    status: "error",
    route: input.route,
    engineRun: "FAIL",
    errorCode: "MISSING_BIRTH_DATA",
    error: `${input.system} requires ${missingFields.join("; ")}.`,
    userMessage: `To run ${input.system === "western" ? "the western calculation path" : "a calculation-backed reading"} cleanly, I need your ${missingFields.join("; ")}. You can type it naturally and I will structure the rest.`,
  };
  logCoreSystemResult(result);
  return result;
}

async function resolveAstrologyBirthContext(input: Divin8CoreSystemInput) {
  const birthDate = input.profile.birthDate;
  const birthTime = input.profile.birthTime;
  const birthLocation = input.profile.birthLocation;

  if (!birthDate || !birthTime || !birthLocation) {
    return buildMissingBirthDataResult(input, [
      !birthDate ? "birth date (e.g. March 22, 1979)" : null,
      !birthTime ? "birth time (e.g. 7:08 PM)" : null,
      !birthLocation ? "birth location (e.g. Vancouver, BC, Canada)" : null,
    ].filter((value): value is string => Boolean(value)));
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
    const result: Divin8CoreSystemResult = {
      status: "error",
      route: input.route,
      engineRun: "FAIL",
      errorCode: "LOCATION_RESOLUTION_FAILED",
      error: `Location resolution failed for "${birthLocation}": ${message}`,
      userMessage:
        `I’m close to finishing the ${input.system} calculation. I couldn’t confidently lock in "${birthLocation}" yet. Share the birthplace as city, region/state, country (for example: "Port Alberni, British Columbia, Canada"), and I’ll run it immediately.`,
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
        ? `I need your ${fieldHints} to run the calculation cleanly. Just type them naturally, for example: "born March 22 1979 at 7:08pm in Vancouver BC".`
        : `Something about the birth data could not be parsed for the calculation path. Could you resend your birth date, time, and location in one message? Example: "March 22, 1979 at 7:08 PM, Port Alberni, BC, Canada"`,
    };
    logCoreSystemResult(result);
    return result;
  }

  return resolvedBirthContext;
}

function toBlueprintSystems(system: Divin8DeterministicSystem): BlueprintSystemName[] {
  switch (system) {
    case "vedic":
      return ["astrology"];
    case "numerology":
      return ["numerology"];
    case "chinese":
      return ["chinese"];
    default:
      return [];
  }
}

async function buildBlueprintInterpretation(
  input: Divin8CoreSystemInput,
  system: Exclude<Divin8DeterministicSystem, "western">,
  resolvedBirthContext: Divin8ResolvedBirthContext | null,
): Promise<NormalizedEngineInterpretationContext> {
  const includeSystems = toBlueprintSystems(system);
  const blueprint = await assembleBlueprint(
    {
      id: input.userId,
      fullBirthName: input.profile.fullName ?? "Client",
      birthDate: input.profile.birthDate!,
      birthTime: input.profile.birthTime,
      birthLocation: input.profile.birthLocation,
    },
    includeSystems,
    "initiate",
    systemsConfigFromIncludeSystems(includeSystems),
    resolvedBirthContext?.coordinates,
    undefined,
    resolvedBirthContext?.utcOffsetMinutes,
  );

  const context = normalizeEngineResultForInterpretation(blueprint, buildRequestContext(input));
  return {
    ...context,
    systemsUsed: system === "vedic" ? ["vedic"] : context.systemsUsed,
  };
}

async function buildWesternInterpretation(
  input: Divin8CoreSystemInput,
  resolvedBirthContext: Divin8ResolvedBirthContext,
): Promise<NormalizedEngineInterpretationContext> {
  const birthDate = input.profile.birthDate!;
  const birthTime = input.profile.birthTime!;
  const [yearText, monthText, dayText] = birthDate.split("-");
  const [hourText, minuteText] = birthTime.split(":");
  const utc = localToUtc(
    Number(yearText),
    Number(monthText),
    Number(dayText),
    Number(hourText),
    Number(minuteText),
    resolvedBirthContext.utcOffsetMinutes,
  );
  const western = await calculateAstrology({
    year: utc.year,
    month: utc.month,
    day: utc.day,
    hour: utc.hour,
    minute: utc.minute,
  });
  const sun = longitudeToSign(western.planets.sun.longitude);
  const moon = longitudeToSign(western.planets.moon.longitude);

  return {
    requestIntent: input.requestIntent,
    requestedSystems: input.route.requestedSystems,
    focusAreas: input.focusAreas,
    comparisonRequested: input.comparisonRequested,
    timingPeriod: input.timingPeriod,
    systemsUsed: ["western"],
    summary: `Western chart backbone anchored with Sun in ${sun.sign} and Moon in ${moon.sign}.`,
    keyInsights: [
      `Sun emphasis lands in ${sun.sign}, shaping the visible style of will and identity.`,
      `Moon emphasis lands in ${moon.sign}, shaping instinctive emotional rhythm and needs.`,
      "This western path uses Swiss Ephemeris calculations for the chart backbone and keeps the interpretation grounded rather than speculative.",
    ],
    highlights: {
      sunSign: sun.sign,
      moonSign: moon.sign,
      sunDegree: `${sun.degree}deg ${sun.minute}m`,
      moonDegree: `${moon.degree}deg ${moon.minute}m`,
    },
    limitations: [
      "Western support currently uses a compact Swiss calculation backbone rather than the full tropical interpretation stack.",
    ],
  };
}

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

  try {
    let interpretation: NormalizedEngineInterpretationContext;
    let resolvedBirthContext: Divin8ResolvedBirthContext | null = null;

    if (input.system === "vedic" || input.system === "western") {
      const resolved = await resolveAstrologyBirthContext(input);
      if ("status" in resolved) {
        return resolved;
      }
      resolvedBirthContext = resolved;
      interpretation = input.system === "western"
        ? await buildWesternInterpretation(input, resolvedBirthContext)
        : await buildBlueprintInterpretation(input, "vedic", resolvedBirthContext);
    } else if (input.system === "numerology") {
      if (!input.profile.birthDate || !input.profile.fullName) {
        return buildMissingBirthDataResult(input, [
          !input.profile.fullName ? "full birth name" : null,
          !input.profile.birthDate ? "birth date" : null,
        ].filter((value): value is string => Boolean(value)));
      }
      interpretation = await buildBlueprintInterpretation(input, "numerology", null);
    } else if (input.system === "chinese") {
      if (!input.profile.birthDate) {
        return buildMissingBirthDataResult(input, ["birth date"]);
      }
      interpretation = await buildBlueprintInterpretation(input, "chinese", null);
    } else {
      const result: Divin8CoreSystemResult = {
        status: "error",
        route: input.route,
        engineRun: "FAIL",
        errorCode: "UNSUPPORTED_SYSTEM",
        error: `Unsupported system: ${input.system}`,
        userMessage: "That system is not available in the deterministic engine path yet.",
      };
      logCoreSystemResult(result);
      return result;
    }

    const result: Divin8CoreSystemResult = {
      status: "success",
      route: input.route,
      engineRun: "SUCCESS",
      data: {
        type: "ENGINE",
        system: input.system,
        interpretation,
        resolvedBirthContext,
      },
    };
    logCoreSystemResult(result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Deterministic system computation failed.";
    const result: Divin8CoreSystemResult = {
      status: "error",
      route: input.route,
      engineRun: "FAIL",
      errorCode: "STRICT_ENGINE_FAILED",
      error: `Deterministic computation error: ${message}`,
      userMessage:
        "The calculation path hit an unexpected error. I will not fabricate structured data. Please try again in a moment, or resend your birth info in one message so I can retry cleanly.",
    };
    logCoreSystemResult(result);
    return result;
  }
}
