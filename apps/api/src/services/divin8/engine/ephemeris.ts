import type { LocationCoordinates } from "../../blueprint/types.js";
import { calculateVedicAstrology } from "../../blueprint/vedicAstrologyService.js";
import { localToUtc, parseRequiredBirthMoment } from "./astrologyUtils.js";

export interface StrictAstrologyEphemerisInput {
  birthDate: string | null;
  birthTime: string | null;
  coordinates: LocationCoordinates | null;
  utcOffsetMinutes: number | null;
}

export interface StrictAstrologyValidationError {
  errorCode: "MISSING_BIRTH_DATA" | "INVALID_BIRTH_DATA";
  error: string;
  missingFields: string[];
}

export type ValidatedStrictAstrologyInput = {
  birthDate: string;
  birthTime: string;
  coordinates: LocationCoordinates;
  utcOffsetMinutes: number;
};

export function validateStrictAstrologyInput(
  input: StrictAstrologyEphemerisInput,
): { valid: true; value: ValidatedStrictAstrologyInput } | { valid: false; error: StrictAstrologyValidationError } {
  const missingFields: string[] = [];
  if (!input.birthDate) missingFields.push("birth date");
  if (!input.birthTime) missingFields.push("birth time");
  if (!input.coordinates) missingFields.push("birth location");
  if (typeof input.utcOffsetMinutes !== "number") missingFields.push("timezone");

  if (missingFields.length > 0) {
    return {
      valid: false,
      error: {
        errorCode: "MISSING_BIRTH_DATA",
        error: `Strict astrology requires ${missingFields.join(", ")}.`,
        missingFields,
      },
    };
  }

  const parsedMoment = parseRequiredBirthMoment({
    birthDate: input.birthDate,
    birthTime: input.birthTime,
  });
  if (!parsedMoment) {
    return {
      valid: false,
      error: {
        errorCode: "INVALID_BIRTH_DATA",
        error: "Birth date or birth time is invalid for strict astrology computation.",
        missingFields: [],
      },
    };
  }

  return {
    valid: true,
    value: {
      birthDate: input.birthDate!,
      birthTime: input.birthTime!,
      coordinates: input.coordinates!,
      utcOffsetMinutes: input.utcOffsetMinutes!,
    },
  };
}

export async function runStrictAstrologyEphemeris(input: ValidatedStrictAstrologyInput) {
  const parsedMoment = parseRequiredBirthMoment({
    birthDate: input.birthDate,
    birthTime: input.birthTime,
  });
  if (!parsedMoment) {
    throw new Error("Birth moment could not be parsed.");
  }

  const utcMoment = localToUtc(
    parsedMoment.localYear,
    parsedMoment.localMonth,
    parsedMoment.localDay,
    parsedMoment.localHour,
    parsedMoment.localMinute,
    input.utcOffsetMinutes,
  );

  const { latitude, longitude } = input.coordinates;
  const astrology = await calculateVedicAstrology(
    utcMoment.year,
    utcMoment.month,
    utcMoment.day,
    utcMoment.hour,
    utcMoment.minute,
    latitude,
    longitude,
    true,
  );

  return {
    astrology,
    utcMoment,
  };
}
