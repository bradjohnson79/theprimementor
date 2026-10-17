import { and, asc, eq, inArray } from "drizzle-orm";
import { profiles, type Database } from "@wisdom/db";
import {
  MAX_DIVIN8_PROFILES_PER_MESSAGE,
  extractDivin8ProfileTags,
  mergeDivin8ActiveProfileTags,
  logger,
  type Divin8ProfileCreateRequest,
} from "@wisdom/utils";
import { normalizeBirthTimeToStorage } from "../blueprint/schemas.js";
import { createHttpError } from "../booking/errors.js";
import { assertValidDateString, assertValidTimeZone } from "../booking/timezoneService.js";
import {
  hasValidCoordinates,
  resolveIanaTimezoneFromCoordinates,
} from "../intake/ianaTimezoneFromCoordinates.js";
import { normalizeStructuredBirthplace } from "../intake/placeSelection.js";
import { inspectPostgresError, postgresErrorText } from "./postgresError.js";

type ProfileRow = typeof profiles.$inferSelect;

export interface ResolvedDivin8Profile {
  id: string;
  fullName: string;
  tag: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  lat: number;
  lng: number;
  timezone: string;
  createdAt: string;
}

function titleCaseSegment(segment: string) {
  if (!segment) {
    return "";
  }

  const lower = segment.toLocaleLowerCase();
  return `${lower.charAt(0).toLocaleUpperCase()}${lower.slice(1)}`;
}

export function generateDivin8ProfileTag(fullName: string) {
  const segments = fullName.match(/[\p{L}\p{N}]+/gu) ?? [];
  const normalized = segments.map(titleCaseSegment).join("");
  if (!normalized) {
    throw createHttpError(400, "Full name is required to generate a profile tag.");
  }
  return `@${normalized}`;
}

export function allocateDivin8ProfileTag(baseTag: string, existingTags: Iterable<string>) {
  const taken = new Set(existingTags);
  if (!taken.has(baseTag)) {
    return baseTag;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseTag}${index}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  throw createHttpError(409, "That profile tag is already in use. Please choose another tag.");
}

export function toSafeProfileSaveError(error: unknown): never {
  const inspected = inspectPostgresError(error);
  logger.error("divin8_profile_save_failed", {
    code: inspected.code,
    message: inspected.message,
    detail: inspected.detail,
    hint: inspected.hint,
    constraint: inspected.constraint,
    table: inspected.table,
    column: inspected.column,
  });

  const text = postgresErrorText(error);
  if (inspected.code === "23505" || /profiles_user_tag_uidx|duplicate key|unique constraint/i.test(text)) {
    throw createHttpError(409, "That profile tag is already in use. Please choose another tag.");
  }
  if (inspected.code === "23503" || /profiles_user_id_users_id_fk|foreign key/i.test(text)) {
    throw createHttpError(400, "Unable to save profile. The profile could not be added because its owner record is invalid.");
  }

  throw createHttpError(500, "Profile could not be saved due to a database error. The error has been logged for diagnosis.");
}

function normalizeProfileRow(row: ProfileRow): ResolvedDivin8Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    tag: row.tag,
    birthDate: String(row.birth_date),
    birthTime: row.birth_time,
    birthPlace: row.birth_place,
    lat: row.lat,
    lng: row.lng,
    timezone: row.timezone,
    createdAt: row.created_at.toISOString(),
  };
}

function validateProfileCreateInput(input: Divin8ProfileCreateRequest) {
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  if (!fullName) {
    throw createHttpError(400, "Full name is required.");
  }

  const birthDate = assertValidDateString(typeof input.birthDate === "string" ? input.birthDate.trim() : "");
  const birthTime = normalizeBirthTimeToStorage(typeof input.birthTime === "string" ? input.birthTime.trim() : "");
  if (!birthTime) {
    throw createHttpError(400, "Birth time is required.");
  }

  const birthplace = normalizeStructuredBirthplace({
    birthPlaceName: input.birthPlace,
    birthLat: input.lat,
    birthLng: input.lng,
  });

  if (!hasValidCoordinates(birthplace.lat, birthplace.lng)) {
    throw createHttpError(400, "Unable to resolve the selected birthplace/timezone. Please verify the birthplace.");
  }

  const geographicTimezone = resolveIanaTimezoneFromCoordinates(birthplace.lat, birthplace.lng);
  const submittedTimezone = typeof input.timezone === "string" ? input.timezone.trim() : "";
  const timezone = geographicTimezone
    ?? (submittedTimezone ? assertValidTimeZone(submittedTimezone) : null);
  if (!timezone) {
    throw createHttpError(400, "Unable to resolve the selected birthplace/timezone. Please verify the birthplace.");
  }

  return {
    fullName,
    baseTag: generateDivin8ProfileTag(fullName),
    birthDate,
    birthTime,
    birthPlace: birthplace.name,
    lat: birthplace.lat,
    lng: birthplace.lng,
    timezone: assertValidTimeZone(timezone),
  };
}

export async function listDivin8Profiles(db: Database, userId: string) {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.user_id, userId))
    .orderBy(asc(profiles.created_at));

  return {
    profiles: rows.map(normalizeProfileRow),
  };
}

export async function createDivin8Profile(db: Database, userId: string, input: Divin8ProfileCreateRequest) {
  const validated = validateProfileCreateInput(input);
  const existingRows = await db
    .select({ tag: profiles.tag })
    .from(profiles)
    .where(eq(profiles.user_id, userId));
  const tag = allocateDivin8ProfileTag(validated.baseTag, existingRows.map((row) => row.tag));

  try {
    const [created] = await db
      .insert(profiles)
      .values({
        user_id: userId,
        full_name: validated.fullName,
        tag,
        birth_date: validated.birthDate,
        birth_time: validated.birthTime,
        birth_place: validated.birthPlace,
        lat: validated.lat,
        lng: validated.lng,
        timezone: validated.timezone,
      })
      .returning();

    if (!created) {
      throw createHttpError(500, "Profile could not be saved due to a database error. The error has been logged for diagnosis.");
    }

    return normalizeProfileRow(created);
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    toSafeProfileSaveError(error);
  }
}

export async function deleteDivin8Profile(db: Database, userId: string, profileId: string) {
  const [deleted] = await db
    .delete(profiles)
    .where(and(
      eq(profiles.id, profileId),
      eq(profiles.user_id, userId),
    ))
    .returning({ id: profiles.id });

  if (!deleted) {
    throw createHttpError(404, "Profile not found.");
  }

  return {
    id: deleted.id,
    deleted: true as const,
  };
}

export interface Divin8ProfileResolutionOptions {
  explicitTags?: string[];
  conversationActiveTags?: string[];
}

export async function resolveDivin8ProfilesForMessage(
  db: Database,
  userId: string,
  message: string,
  optionsOrExplicitTags?: Divin8ProfileResolutionOptions | string[],
) {
  const parsedTags = extractDivin8ProfileTags(message);
  const options = Array.isArray(optionsOrExplicitTags)
    ? { explicitTags: optionsOrExplicitTags }
    : optionsOrExplicitTags;
  const mergedTags = mergeDivin8ActiveProfileTags(
    options?.conversationActiveTags,
    options?.explicitTags,
    parsedTags,
  );

  if (mergedTags.length > MAX_DIVIN8_PROFILES_PER_MESSAGE) {
    throw createHttpError(400, `Maximum of ${MAX_DIVIN8_PROFILES_PER_MESSAGE} profiles allowed per reading.`);
  }

  if (mergedTags.length === 0) {
    return {
      tags: [] as string[],
      profiles: [] as ResolvedDivin8Profile[],
    };
  }

  const rows = await db
    .select()
    .from(profiles)
    .where(and(
      eq(profiles.user_id, userId),
      inArray(profiles.tag, mergedTags),
    ));

  const mapped = rows.map(normalizeProfileRow);
  const byTag = new Map(mapped.map((profile) => [profile.tag, profile]));
  const orderedProfiles = mergedTags
    .map((tag) => byTag.get(tag))
    .filter((profile): profile is ResolvedDivin8Profile => Boolean(profile));

  if (orderedProfiles.length !== mergedTags.length) {
    const missing = mergedTags.filter((tag) => !byTag.has(tag));
    throw createHttpError(404, `Unknown profile tag${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
  }

  return {
    tags: mergedTags,
    profiles: orderedProfiles,
  };
}
