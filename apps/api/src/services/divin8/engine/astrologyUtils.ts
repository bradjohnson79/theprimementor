import { parseBirthDate, parseBirthTime } from "../../blueprint/schemas.js";

export interface ParsedBirthMoment {
  localYear: number;
  localMonth: number;
  localDay: number;
  localHour: number;
  localMinute: number;
}

export function localToUtc(
  localYear: number,
  localMonth: number,
  localDay: number,
  localHour: number,
  localMinute: number,
  utcOffsetMinutes: number,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const localTotalMinutes = localHour * 60 + localMinute;
  const utcTotalMinutes = localTotalMinutes - utcOffsetMinutes;
  const base = new Date(Date.UTC(localYear, localMonth - 1, localDay, 0, utcTotalMinutes, 0));

  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
    hour: base.getUTCHours(),
    minute: base.getUTCMinutes(),
  };
}

export function parseRequiredBirthMoment(input: {
  birthDate: string | null;
  birthTime: string | null;
}): ParsedBirthMoment | null {
  if (!input.birthDate || !input.birthTime) {
    return null;
  }

  const parsedDate = parseBirthDate(input.birthDate);
  const parsedTime = parseBirthTime(input.birthTime);
  if (!parsedDate || !parsedTime) {
    return null;
  }

  return {
    localYear: parsedDate.year,
    localMonth: parsedDate.month,
    localDay: parsedDate.day,
    localHour: parsedTime.hour,
    localMinute: parsedTime.minute,
  };
}
